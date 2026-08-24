// game-logic.js — orchestration for every "system" that isn't plain CRUD:
// daily login bonus, meds collect-once + streak, workout streak (scheduled
// days only), nutrition streak, the all-goals combo bonus, and the weekly
// spin wheel. Everything here calls through js/data.js and js/xp-engine.js.

function todayISO_() { return new Date().toISOString().slice(0, 10); }

function isoDaysAgo_(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoWeekStart_(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

function dateFromWeekAndDayName_(weekStartISO, dayName) {
  const idx = window.LevelUpWorkoutEngine.DAY_NAMES.indexOf(dayName);
  const d = new Date(weekStartISO + 'T00:00:00');
  d.setDate(d.getDate() + idx);
  return d.toISOString().slice(0, 10);
}

function buildAwardCtx(profile, equippedItems, overrides = {}) {
  return {
    level: profile.level || 1,
    prestige: profile.prestige || 0,
    medsStreak: profile.meds_streak_count || 0,
    workoutStreak: profile.workout_streak_count || 0,
    nutritionStreak: profile.nutrition_streak_count || 0,
    activeBoosts: window.LevelUpXP.pruneExpiredBoosts(profile.active_boosts || []),
    equippedItems: equippedItems || [],
    ...overrides,
  };
}

// ── Daily login bonus + login streak (unlocks weekly spins) ────────────────
async function dailyLoginCheck(userId) {
  const D = window.LevelUpData, X = window.LevelUpXP;
  const profile = await D.getProfile(userId);
  const today = todayISO_();
  if (profile.last_login_date === today) return { alreadyAwarded: true, profile };

  const yesterday = isoDaysAgo_(1);
  const newStreak = profile.login_streak_last_date === yesterday ? (profile.login_streak_count || 0) + 1 : 1;

  const equipped = await D.getEquippedItems(userId);
  const ctx = buildAwardCtx(profile, equipped);
  const award = X.computeAward('login', X.XP_REWARDS.login, X.COIN_REWARDS.login, ctx);
  await D.grantXpAndCoins(userId, award.xp, award.coins);

  let spinGranted = false;
  let spinsAvailable = profile.spins_available || 0;
  let lastMilestone = profile.last_spin_streak_milestone || 0;
  if (newStreak % 7 === 0 && newStreak !== lastMilestone) {
    spinsAvailable += 1;
    lastMilestone = newStreak;
    spinGranted = true;
  }

  const updated = await D.upsertProfile(userId, {
    last_login_date: today,
    login_streak_count: newStreak,
    login_streak_last_date: today,
    spins_available: spinsAvailable,
    last_spin_streak_milestone: lastMilestone,
  });

  return { alreadyAwarded: false, award, newStreak, spinGranted, profile: updated };
}

// ── Meds: check-once boxes + collect-once bonus + streak ───────────────────
function allMedsChecked(profile, todayLog) {
  const meds = profile.med_names || [];
  if (!meds.length) return false;
  return meds.every(m => todayLog.meds_taken && todayLog.meds_taken[m]);
}

async function collectMedsXp(userId) {
  const D = window.LevelUpData, X = window.LevelUpXP;
  const profile = await D.getProfile(userId);
  const todayLog = await D.getTodayLog(userId);
  if (todayLog.meds_collected) return { ok: false, reason: 'already_collected' };
  if (!allMedsChecked(profile, todayLog)) return { ok: false, reason: 'not_all_checked' };

  const yesterday = isoDaysAgo_(1);
  const newStreak = profile.meds_streak_last_date === yesterday ? (profile.meds_streak_count || 0) + 1 : 1;

  const equipped = await D.getEquippedItems(userId);
  const ctx = buildAwardCtx(profile, equipped, { medsStreak: newStreak });
  const bonusCoins = X.medsStreakCoinBonus(newStreak);
  const award = X.computeAward('meds', X.XP_REWARDS.medsAllCollected, bonusCoins, ctx);

  await D.grantXpAndCoins(userId, award.xp, award.coins);
  await D.upsertTodayLog(userId, { meds_collected: true });
  await D.upsertProfile(userId, { meds_streak_count: newStreak, meds_streak_last_date: todayISO_() });

  await maybeAwardComboBonus(userId);
  return { ok: true, award, newStreak };
}

// ── Workout streak: consecutive SCHEDULED training days, off-days ignored ──
async function getPreviousScheduledDate(userId, todayDate) {
  const D = window.LevelUpData;
  const todayStr = todayDate.toISOString().slice(0, 10);
  const curWeekStart = isoWeekStart_(todayDate);
  const curPlan = await D.getWeeklyPlanRaw(userId, curWeekStart);
  let candidates = [];
  if (curPlan) {
    Object.keys(curPlan).forEach(dayName => {
      const dateStr = dateFromWeekAndDayName_(curWeekStart, dayName);
      if (dateStr < todayStr) candidates.push(dateStr);
    });
  }
  if (!candidates.length) {
    const prevWeekStartDate = new Date(curWeekStart + 'T00:00:00');
    prevWeekStartDate.setDate(prevWeekStartDate.getDate() - 7);
    const prevWeekStart = prevWeekStartDate.toISOString().slice(0, 10);
    const prevPlan = await D.getWeeklyPlanRaw(userId, prevWeekStart);
    if (prevPlan) {
      Object.keys(prevPlan).forEach(dayName => candidates.push(dateFromWeekAndDayName_(prevWeekStart, dayName)));
    }
  }
  if (!candidates.length) return null;
  candidates.sort();
  return candidates[candidates.length - 1];
}

// Returns the streak value to use for TODAY's workout award (does not persist —
// call commitWorkoutStreak after the workout is actually saved).
async function previewWorkoutStreak(userId, todayDate, isScheduledToday) {
  const D = window.LevelUpData;
  const profile = await D.getProfile(userId);
  if (!isScheduledToday) return profile.workout_streak_count || 0; // off-day: streak unaffected
  const todayStr = todayDate.toISOString().slice(0, 10);
  if (profile.workout_streak_last_scheduled_date === todayStr) return profile.workout_streak_count || 0; // already counted today

  const prevScheduled = await getPreviousScheduledDate(userId, todayDate);
  if (!prevScheduled) return 1;
  const prevLog = await D.getWorkoutLogForDate(userId, prevScheduled);
  return prevLog ? (profile.workout_streak_count || 0) + 1 : 1;
}

async function commitWorkoutStreak(userId, todayDate, isScheduledToday, newStreak) {
  const D = window.LevelUpData;
  if (!isScheduledToday) return; // off-days never change the stored streak
  const profile = await D.getProfile(userId);
  const todayStr = todayDate.toISOString().slice(0, 10);
  if (profile.workout_streak_last_scheduled_date === todayStr) return; // already committed today
  await D.upsertProfile(userId, { workout_streak_count: newStreak, workout_streak_last_scheduled_date: todayStr });
}

// ── Nutrition streak: both calorie AND water goals hit, N days running ─────
async function maybeUpdateNutritionStreak(userId) {
  const D = window.LevelUpData;
  const profile = await D.getProfile(userId);
  const todayLog = await D.getTodayLog(userId);
  const today = todayISO_();
  if (!(todayLog.calorie_goal_rewarded && todayLog.water_goal_rewarded)) return;
  if (profile.nutrition_streak_last_date === today) return; // already updated today

  const yesterday = isoDaysAgo_(1);
  const newStreak = profile.nutrition_streak_last_date === yesterday ? (profile.nutrition_streak_count || 0) + 1 : 1;
  await D.upsertProfile(userId, { nutrition_streak_count: newStreak, nutrition_streak_last_date: today });
}

// ── All-goals combo bonus (calorie + water + workout + meds, same day) ─────
async function maybeAwardComboBonus(userId) {
  const D = window.LevelUpData, X = window.LevelUpXP;
  const profile = await D.getProfile(userId);
  const todayLog = await D.getTodayLog(userId);
  if (todayLog.combo_rewarded) return { awarded: false };

  const medsOk = !(profile.med_names && profile.med_names.length) || todayLog.meds_collected;
  const workoutToday = await D.getWorkoutLogForDate(userId, todayISO_());
  const allDone = todayLog.calorie_goal_rewarded && todayLog.water_goal_rewarded && medsOk && !!workoutToday;
  if (!allDone) return { awarded: false };

  const equipped = await D.getEquippedItems(userId);
  const ctx = buildAwardCtx(profile, equipped);
  const award = X.computeAward('general', X.XP_REWARDS.allGoalsComboBonus, X.COIN_REWARDS.allGoalsComboBonus, ctx);
  await D.grantXpAndCoins(userId, award.xp, award.coins);
  await D.upsertTodayLog(userId, { combo_rewarded: true });
  return { awarded: true, award };
}

// ── Spin wheel ───────────────────────────────────────────────────────────
const SPIN_PRIZES = [
  { id: 'free_item', label: 'Free Shop Item', weight: 10 },
  { id: 'boost_1_5x_2d', label: '1.5x XP — 2 days', weight: 15 },
  { id: 'boost_1_75x_1d', label: '1.75x XP — 1 day', weight: 10 },
  { id: 'boost_1_2x_1w', label: '1.2x XP + Coins — 1 week', weight: 8 },
  { id: 'xp_25', label: '25 XP', weight: 20 },
  { id: 'xp_50', label: '50 XP', weight: 12 },
  { id: 'coins_10', label: '10 Coins', weight: 15 },
  { id: 'coins_25', label: '25 Coins', weight: 7 },
  { id: 'coins_50', label: '50 Coins', weight: 3 },
];

function pickWeighted_(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    if (roll < item.weight) return item;
    roll -= item.weight;
  }
  return items[items.length - 1];
}

function hoursFromNow_(h) { return new Date(Date.now() + h * 3600 * 1000).toISOString(); }

async function spinWheel(userId) {
  const D = window.LevelUpData, X = window.LevelUpXP;
  const profile = await D.getProfile(userId);
  if ((profile.spins_available || 0) <= 0) return { ok: false, reason: 'no_spins' };

  const prize = pickWeighted_(SPIN_PRIZES);
  const equipped = await D.getEquippedItems(userId);
  const ctx = buildAwardCtx(profile, equipped);
  let resultDetail = {};

  if (prize.id === 'free_item') {
    const [items, inv] = await Promise.all([D.getShopItems(), D.getInventory(userId)]);
    const ownedIds = new Set(inv.map(i => i.item_id));
    const eligible = items.filter(i => !ownedIds.has(i.id) && profile.level >= i.min_level).sort((a, b) => a.cost - b.cost);
    if (eligible.length) {
      await D.grantItemFree(userId, eligible[0].id);
      resultDetail = { itemName: eligible[0].name, itemEmoji: eligible[0].emoji };
    } else {
      // nothing left to grant — fall back to a flat coin prize instead
      const fallback = X.computeAward('general', 0, 25, ctx);
      await D.grantXpAndCoins(userId, fallback.xp, fallback.coins);
      resultDetail = { fallbackCoins: fallback.coins };
    }
  } else if (prize.id.startsWith('boost_')) {
    const boostMap = {
      boost_1_5x_2d: { type: 'xp', multiplier: 1.5, hours: 48 },
      boost_1_75x_1d: { type: 'xp', multiplier: 1.75, hours: 24 },
      boost_1_2x_1w: { type: 'xp_coin', multiplier: 1.2, hours: 168 },
    };
    const b = boostMap[prize.id];
    const boosts = X.pruneExpiredBoosts(profile.active_boosts || []);
    boosts.push({ id: prize.id + '_' + Date.now(), type: b.type, category: 'general', multiplier: b.multiplier, expires_at: hoursFromNow_(b.hours) });
    await D.upsertProfile(userId, { active_boosts: boosts });
    resultDetail = { boost: b };
  } else if (prize.id === 'xp_25' || prize.id === 'xp_50') {
    const base = prize.id === 'xp_25' ? 25 : 50;
    const award = X.computeAward('general', base, 0, ctx);
    await D.grantXpAndCoins(userId, award.xp, award.coins);
    resultDetail = { award };
  } else if (prize.id.startsWith('coins_')) {
    const base = parseInt(prize.id.split('_')[1], 10);
    const award = X.computeAward('general', 0, base, ctx);
    await D.grantXpAndCoins(userId, award.xp, award.coins);
    resultDetail = { award };
  }

  await D.upsertProfile(userId, { spins_available: (profile.spins_available || 0) - 1 });
  return { ok: true, prize, resultDetail };
}

// ── Schedule shifting ────────────────────────────────────────────────────
async function swapScheduleDays(userId, weekStartISO, dayA, dayB) {
  const D = window.LevelUpData;
  const plan = (await D.getWeeklyPlanRaw(userId, weekStartISO)) || {};
  const tmp = plan[dayA];
  if (plan[dayB]) plan[dayA] = plan[dayB]; else delete plan[dayA];
  if (tmp) plan[dayB] = tmp; else delete plan[dayB];
  await D.saveWeeklyPlan(userId, weekStartISO, plan);
  return plan;
}

window.LevelUpGame = {
  todayISO_, isoDaysAgo_, isoWeekStart_, dateFromWeekAndDayName_, buildAwardCtx,
  dailyLoginCheck, allMedsChecked, collectMedsXp,
  getPreviousScheduledDate, previewWorkoutStreak, commitWorkoutStreak,
  maybeUpdateNutritionStreak, maybeAwardComboBonus,
  SPIN_PRIZES, spinWheel, swapScheduleDays,
};
