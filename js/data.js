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

async function getTodayLog(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb.from('daily_logs').select('*').eq('user_id', userId).eq('logged_on', today).maybeSingle();
  if (error) console.error(error);
  return data || { user_id: userId, logged_on: today, calories_eaten: null, water_ml: 0, meds_taken: {}, calorie_goal_rewarded: false, water_goal_rewarded: false };
}

async function upsertTodayLog(userId, fields) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb.from('daily_logs')
    .upsert({ user_id: userId, logged_on: today, ...fields }, { onConflict: 'user_id,logged_on' })
    .select().single();
  if (error) console.error(error);
  return data;
}

async function getPRs(userId) {
  const { data, error } = await sb.from('prs').select('*').eq('user_id', userId);
  if (error) console.error(error);
  return data || [];
}

async function upsertPR(userId, exerciseName, weightKg, reps) {
  const { data, error } = await sb.from('prs')
    .upsert({ user_id: userId, exercise_name: exerciseName, weight_kg: weightKg, reps, achieved_on: new Date().toISOString().slice(0, 10) },
      { onConflict: 'user_id,exercise_name' })
    .select().single();
  if (error) console.error(error);
  return data;
}

async function getOrCreateWeeklyPlan(userId, weekStartISO, generatorFn, workoutsPerWeek) {
  const { data: existing, error: readErr } = await sb.from('weekly_schedules').select('*')
    .eq('user_id', userId).eq('week_start', weekStartISO).maybeSingle();
  if (readErr) console.error(readErr);
  if (existing) return existing.plan;

  const plan = generatorFn(workoutsPerWeek);
  const { error: writeErr } = await sb.from('weekly_schedules').insert({ user_id: userId, week_start: weekStartISO, plan });
  if (writeErr) console.error(writeErr);
  return plan;
}

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

async function grantXpAndCoins(userId, xpDelta, coinDelta) {
  const profile = await getProfile(userId);
  const newXp = (profile.xp || 0) + xpDelta;
  const newCoins = (profile.coins || 0) + coinDelta;
  const newLevel = window.LevelUpXP.levelFromXp(newXp);
  return upsertProfile(userId, { xp: newXp, coins: newCoins, level: newLevel });
}

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

async function buyItem(userId, itemId, cost) {
  const profile = await getProfile(userId);
  if ((profile.coins || 0) < cost) return { ok: false, reason: 'not_enough_coins' };
  await sb.from('inventory').insert({ user_id: userId, item_id: itemId });
  await upsertProfile(userId, { coins: profile.coins - cost });
  return { ok: true };
}

async function equipItem(userId, itemId, category, allItemsInCategory) {
  // unequip everything else in this category, then equip the chosen one
  const others = allItemsInCategory.filter(i => i.item_id !== itemId).map(i => i.item_id);
  if (others.length) await sb.from('inventory').update({ equipped: false }).eq('user_id', userId).in('item_id', others);
  await sb.from('inventory').update({ equipped: true }).eq('user_id', userId).eq('item_id', itemId);
}

window.LevelUpData = {
  getProfile, upsertProfile, addWeightLog, getWeightLogs, getTodayLog, upsertTodayLog,
  getPRs, upsertPR, getOrCreateWeeklyPlan, logWorkout, getWorkoutLogs, grantXpAndCoins,
  getShopItems, getInventory, buyItem, equipItem,
};
