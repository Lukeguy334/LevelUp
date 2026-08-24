// data.js — thin CRUD layer over Supabase tables. Every function assumes
// the caller already has an authenticated session.

async function getProfile(userId) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') console.error(error);
  return data;
}

async function upsertProfile(userId, fields) {
  const { data, error } = await sb.from('profiles').upsert({ id: userId, ...fields }).select().single();
  if (error) console.error(error);
  return data;
}

async function addWeightLog(userId, weightKg, date) {
  const { error } = await sb.from('weight_logs').insert({ user_id: userId, weight_kg: weightKg, logged_on: date });
  if (error) console.error(error);
}

async function getWeightLogs(userId, limit = 90) {
  const { data, error } = await sb.from('weight_logs').select('*').eq('user_id', userId)
    .order('logged_on', { ascending: true }).limit(limit);
  if (error) console.error(error);
  return data || [];
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

async function getTodayLog(userId) {
  const today = todayISO();
  const { data, error } = await sb.from('daily_logs').select('*').eq('user_id', userId).eq('logged_on', today).maybeSingle();
  if (error) console.error(error);
  return data || {
    user_id: userId, logged_on: today, calories_eaten: 0, water_ml: 0, meds_taken: {},
    calorie_goal_rewarded: false, water_goal_rewarded: false, meds_collected: false, combo_rewarded: false,
  };
}

async function upsertTodayLog(userId, fields) {
  const today = todayISO();
  const { data, error } = await sb.from('daily_logs')
    .upsert({ user_id: userId, logged_on: today, ...fields }, { onConflict: 'user_id,logged_on' })
    .select().single();
  if (error) console.error(error);
  return data;
}

async function getDailyLogsRange(userId, startISO, endISO) {
  const { data, error } = await sb.from('daily_logs').select('*').eq('user_id', userId)
    .gte('logged_on', startISO).lte('logged_on', endISO);
  if (error) console.error(error);
  return data || [];
}

// ── Meals (calorie logging is now a running list that sums into daily_logs.calories_eaten) ─
async function getMealsForToday(userId) {
  const today = todayISO();
  const { data, error } = await sb.from('meal_logs').select('*').eq('user_id', userId)
    .eq('logged_on', today).order('logged_at', { ascending: true });
  if (error) console.error(error);
  return data || [];
}

async function addMealLog(userId, name, calories, mealSlot) {
  const { error } = await sb.from('meal_logs').insert({ user_id: userId, logged_on: todayISO(), name, calories, meal_slot: mealSlot || null });
  if (error) console.error(error);
  return recomputeTodayCalories(userId);
}

async function deleteMealLog(userId, mealId) {
  const { error } = await sb.from('meal_logs').delete().eq('id', mealId).eq('user_id', userId);
  if (error) console.error(error);
  return recomputeTodayCalories(userId);
}

async function recomputeTodayCalories(userId) {
  const meals = await getMealsForToday(userId);
  const total = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const todayLog = await upsertTodayLog(userId, { calories_eaten: total });
  return { meals, total, todayLog };
}

// ── PRs ──────────────────────────────────────────────────────────────────
async function getPRs(userId) {
  const { data, error } = await sb.from('prs').select('*').eq('user_id', userId);
  if (error) console.error(error);
  return data || [];
}

async function upsertPR(userId, exerciseName, weightKg, reps) {
  const { data, error } = await sb.from('prs')
    .upsert({ user_id: userId, exercise_name: exerciseName, weight_kg: weightKg, reps, achieved_on: todayISO() },
      { onConflict: 'user_id,exercise_name' })
    .select().single();
  if (error) console.error(error);
  return data;
}

// ── Weekly schedules ─────────────────────────────────────────────────────
async function getWeeklyPlanRaw(userId, weekStartISO) {
  const { data, error } = await sb.from('weekly_schedules').select('*').eq('user_id', userId).eq('week_start', weekStartISO).maybeSingle();
  if (error) console.error(error);
  return data ? data.plan : null;
}

async function getOrCreateWeeklyPlan(userId, weekStartISO, generatorFn, workoutsPerWeek) {
  const existing = await getWeeklyPlanRaw(userId, weekStartISO);
  if (existing) return existing;
  const plan = generatorFn(workoutsPerWeek);
  const { error: writeErr } = await sb.from('weekly_schedules').insert({ user_id: userId, week_start: weekStartISO, plan });
  if (writeErr) console.error(writeErr);
  return plan;
}

async function saveWeeklyPlan(userId, weekStartISO, plan) {
  const { error } = await sb.from('weekly_schedules').upsert({ user_id: userId, week_start: weekStartISO, plan }, { onConflict: 'user_id,week_start' });
  if (error) console.error(error);
  return plan;
}

// ── Workouts ─────────────────────────────────────────────────────────────
async function logWorkout(userId, { muscleGroups, sets, durationMin, xpEarned, coinsEarned }) {
  const { error } = await sb.from('workout_logs').insert({
    user_id: userId, muscle_groups: muscleGroups, sets, duration_min: durationMin,
    xp_earned: xpEarned, coins_earned: coinsEarned,
  });
  if (error) console.error(error);
}

async function getWorkoutLogs(userId, limit = 60) {
  const { data, error } = await sb.from('workout_logs').select('*').eq('user_id', userId)
    .order('logged_on', { ascending: false }).limit(limit);
  if (error) console.error(error);
  return data || [];
}

async function getWorkoutLogsRange(userId, startISO, endISO) {
  const { data, error } = await sb.from('workout_logs').select('*').eq('user_id', userId)
    .gte('logged_on', startISO).lte('logged_on', endISO);
  if (error) console.error(error);
  return data || [];
}

async function getWorkoutLogForDate(userId, dateISO) {
  const { data, error } = await sb.from('workout_logs').select('*').eq('user_id', userId).eq('logged_on', dateISO).maybeSingle();
  if (error) console.error(error);
  return data;
}

// ── XP / coins ───────────────────────────────────────────────────────────
async function grantXpAndCoins(userId, xpDelta, coinDelta) {
  const profile = await getProfile(userId);
  const newXp = Math.max(0, (profile.xp || 0) + xpDelta);
  const newCoins = Math.max(0, (profile.coins || 0) + coinDelta);
  const newLevel = window.LevelUpXP.levelFromXp(newXp, profile.prestige || 0);
  return upsertProfile(userId, { xp: newXp, coins: newCoins, level: newLevel });
}

// ── Shop / inventory ─────────────────────────────────────────────────────
async function getShopItems() {
  const { data, error } = await sb.from('shop_items').select('*').order('cost', { ascending: true });
  if (error) console.error(error);
  return data || [];
}

async function getInventory(userId) {
  const { data, error } = await sb.from('inventory').select('*, shop_items(*)').eq('user_id', userId);
  if (error) console.error(error);
  return data || [];
}

async function getEquippedItems(userId) {
  const inv = await getInventory(userId);
  return inv.filter(i => i.equipped).map(i => i.shop_items);
}

async function buyItem(userId, itemId, cost) {
  const profile = await getProfile(userId);
  if ((profile.coins || 0) < cost) return { ok: false, reason: 'not_enough_coins' };
  await sb.from('inventory').insert({ user_id: userId, item_id: itemId });
  await upsertProfile(userId, { coins: profile.coins - cost });
  return { ok: true };
}

async function grantItemFree(userId, itemId) {
  const { data: existing } = await sb.from('inventory').select('*').eq('user_id', userId).eq('item_id', itemId).maybeSingle();
  if (existing) return { ok: false, reason: 'already_owned' };
  await sb.from('inventory').insert({ user_id: userId, item_id: itemId });
  return { ok: true };
}

async function equipItem(userId, itemId, category, allItemsInCategory) {
  const others = allItemsInCategory.filter(i => i.item_id !== itemId).map(i => i.item_id);
  if (others.length) await sb.from('inventory').update({ equipped: false }).eq('user_id', userId).in('item_id', others);
  await sb.from('inventory').update({ equipped: true }).eq('user_id', userId).eq('item_id', itemId);
}

window.LevelUpData = {
  getProfile, upsertProfile, addWeightLog, getWeightLogs, getTodayLog, upsertTodayLog, getDailyLogsRange,
  getMealsForToday, addMealLog, deleteMealLog, recomputeTodayCalories,
  getPRs, upsertPR,
  getWeeklyPlanRaw, getOrCreateWeeklyPlan, saveWeeklyPlan,
  logWorkout, getWorkoutLogs, getWorkoutLogsRange, getWorkoutLogForDate,
  grantXpAndCoins,
  getShopItems, getInventory, getEquippedItems, buyItem, grantItemFree, equipItem,
};
