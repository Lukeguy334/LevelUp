// xp-engine.js — leveling curve, level names/multipliers, prestige, streaks,
// active boosts, and the single computeAward() function everything routes
// through so every multiplier stacks consistently and rounding happens once.

// ── Base XP/coin amounts for each source ────────────────────────────────────
const XP_REWARDS = {
  setLogged: 1,
  exerciseCompleted: 5,
  workoutComplete: 20,
  calorieGoalHit: 20,
  waterGoalHit: 15,
  medsAllCollected: 5,
  login: 5,
  allGoalsComboBonus: 50,
};
const COIN_REWARDS = {
  setLogged: 0,
  exerciseCompleted: 0,
  workoutComplete: 15,
  calorieGoalHit: 8,
  waterGoalHit: 6,
  medsAllCollected: 0,
  login: 0,
  allGoalsComboBonus: 10,
};

// ── Level curve: XP needed to go FROM each level TO the next ───────────────
// Index 1 = xp needed to go from level 1 to level 2, etc. Level 20 is max.
const LEVEL_STEP_XP = {
  1: 100, 2: 400, 3: 600, 4: 800, 5: 1000, 6: 1500, 7: 1800, 8: 2000, 9: 2500,
  10: 3200, 11: 3500, 12: 4200, 13: 5000, 14: 5500, 15: 6500, 16: 8000,
  17: 10000, 18: 12000, 19: 15000,
};
const MAX_LEVEL = 20;

const LEVEL_META = {
  1: { name: 'Shrimp', mult: 1 },
  2: { name: 'Novice', mult: 1 },
  3: { name: 'Beginner', mult: 1.1 },
  4: { name: 'Apprentice', mult: 1.2 },
  5: { name: 'Adept', mult: 1.4 },
  6: { name: 'Avid Gym-goer', mult: 1.6 },
  7: { name: 'Curl Connoisseur', mult: 2 },
  8: { name: 'Chad', mult: 2.25 },
  9: { name: 'Crayon Eater', mult: 2.5 },
  10: { name: 'Competitive Lifter', mult: 2.75 },
  11: { name: 'Bronze', mult: 3 },
  12: { name: 'Silver', mult: 3.25 },
  13: { name: 'Gym Guru', mult: 3.5 },
  14: { name: 'Weight Junkie', mult: 3.75 },
  15: { name: 'Gold', mult: 4 },
  16: { name: 'Platinum', mult: 4.25 },
  17: { name: 'Diamond', mult: 4.5 },
  18: { name: 'Champion', mult: 4.75 },
  19: { name: 'Titan', mult: 5 },
  20: { name: 'Olympian', mult: 5 },
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function toRoman(n) { return ROMAN[n] || String(n); }

// XP needed to go from `level` to `level+1`, scaled 1.2x per prestige.
function stepXpForLevel(level, prestige = 0) {
  const base = LEVEL_STEP_XP[level] || 0;
  return Math.round(base * Math.pow(1.2, prestige));
}

// Cumulative XP required to REACH a given level, within the current prestige.
function xpForLevel(level, prestige = 0) {
  let total = 0;
  for (let l = 1; l < level; l++) total += stepXpForLevel(l, prestige);
  return total;
}

function levelFromXp(totalXp, prestige = 0) {
  let level = 1;
  while (level < MAX_LEVEL && xpForLevel(level + 1, prestige) <= totalXp) level++;
  return level;
}

function xpProgress(totalXp, prestige = 0) {
  const level = levelFromXp(totalXp, prestige);
  const floor = xpForLevel(level, prestige);
  if (level >= MAX_LEVEL) {
    return { level, floor, ceil: floor, current: 0, needed: 0, maxed: true };
  }
  const ceil = xpForLevel(level + 1, prestige);
  return { level, floor, ceil, current: totalXp - floor, needed: ceil - floor, maxed: false };
}

function levelMultiplier(level) {
  return (LEVEL_META[level] || LEVEL_META[1]).mult;
}

function levelDisplayName(level, prestige = 0) {
  const base = (LEVEL_META[level] || LEVEL_META[1]).name;
  return prestige > 0 ? `${base} ${toRoman(prestige)}` : base;
}

function prestigeMultiplier(prestige = 0) {
  return prestige > 0 ? 1.5 + (prestige - 1) * 0.2 : 1;
}

// ── Streak multipliers ──────────────────────────────────────────────────────
// Meds: only counts if EVERY med was collected that day.
function medsStreakMultiplier(streakDays) {
  if (streakDays >= 10) return 2;
  if (streakDays >= 4) return 1.4;
  return 1;
}
function medsStreakCoinBonus(streakDays) {
  return streakDays >= 10 ? 1 : 0;
}

// Workout: counts consecutive SCHEDULED training days completed (off days don't break it).
function workoutStreakMultiplier(streakDays) {
  if (streakDays > 50) return 1.75;
  if (streakDays >= 20) return 1.5;
  if (streakDays >= 10) return 1.4;
  if (streakDays >= 3) return 1.2;
  return 1;
}

// Nutrition: hitting BOTH calorie and water goals, N days in a row.
function nutritionStreakMultiplier(streakDays) {
  return streakDays >= 5 ? 1.2 : 1;
}

// ── Active boosts (from the spin wheel) ─────────────────────────────────────
// Each boost: { id, type: 'xp'|'xp_coin', category: 'general', multiplier, expires_at (ISO) }
function activeBoostMultiplier(activeBoosts, field) {
  // field: 'xp' or 'coin'
  const now = Date.now();
  return (activeBoosts || [])
    .filter(b => new Date(b.expires_at).getTime() > now)
    .filter(b => b.type === 'xp' ? field === 'xp' : (b.type === 'xp_coin'))
    .reduce((mult, b) => mult * b.multiplier, 1);
}

function pruneExpiredBoosts(activeBoosts) {
  const now = Date.now();
  return (activeBoosts || []).filter(b => new Date(b.expires_at).getTime() > now);
}

// ── Equipped item passive effects ───────────────────────────────────────────
// equippedItems: array of shop_items rows (already filtered to equipped=true)
function equippedEffectMultiplier(equippedItems, field, category) {
  return (equippedItems || [])
    .filter(i => i.effect_type === (field === 'xp' ? 'xp_mult' : 'coin_mult'))
    .filter(i => i.effect_category === category || i.effect_category === 'general')
    .reduce((mult, i) => mult * (1 + Number(i.effect_value || 0)), 1);
}

/**
 * The single place every XP/coin award flows through.
 * @param {string} category - 'login' | 'meds' | 'workout' | 'general'
 * @param {number} baseXp
 * @param {number} baseCoins
 * @param {object} ctx - { level, prestige, medsStreak, workoutStreak, nutritionStreak, activeBoosts, equippedItems }
 */
function computeAward(category, baseXp, baseCoins, ctx) {
  const lvlMult = levelMultiplier(ctx.level || 1);
  const prMult = prestigeMultiplier(ctx.prestige || 0);

  let streakMultXp = 1;
  if (category === 'meds') streakMultXp = medsStreakMultiplier(ctx.medsStreak || 0);
  if (category === 'workout') streakMultXp = workoutStreakMultiplier(ctx.workoutStreak || 0);

  const nutritionMult = nutritionStreakMultiplier(ctx.nutritionStreak || 0); // applies broadly

  const boostXpMult = activeBoostMultiplier(ctx.activeBoosts, 'xp');
  const boostCoinMult = activeBoostMultiplier(ctx.activeBoosts, 'coin');

  const equipXpMult = equippedEffectMultiplier(ctx.equippedItems, 'xp', category);
  const equipCoinMult = equippedEffectMultiplier(ctx.equippedItems, 'coin', category);

  const totalXpMult = lvlMult * prMult * streakMultXp * nutritionMult * boostXpMult * equipXpMult;
  const totalCoinMult = prMult * boostCoinMult * equipCoinMult;

  return {
    xp: Math.round(baseXp * totalXpMult),
    coins: Math.round(baseCoins * totalCoinMult),
    breakdown: { lvlMult, prMult, streakMultXp, nutritionMult, boostXpMult, equipXpMult, boostCoinMult, equipCoinMult },
  };
}

window.LevelUpXP = {
  XP_REWARDS, COIN_REWARDS, LEVEL_STEP_XP, LEVEL_META, MAX_LEVEL,
  toRoman, stepXpForLevel, xpForLevel, levelFromXp, xpProgress,
  levelMultiplier, levelDisplayName, prestigeMultiplier,
  medsStreakMultiplier, medsStreakCoinBonus, workoutStreakMultiplier, nutritionStreakMultiplier,
  activeBoostMultiplier, pruneExpiredBoosts, equippedEffectMultiplier, computeAward,
};
