// xp-engine.js — leveling curve + XP/coin rewards for every gamified action.

const XP_REWARDS = {
  setLogged: 5,
  workoutComplete: 40,
  calorieGoalHit: 20,
  waterGoalHit: 15,
  medCheckOff: 5,
  prBase: 60,
};

const COIN_REWARDS = {
  setLogged: 1,
  workoutComplete: 15,
  calorieGoalHit: 8,
  waterGoalHit: 6,
  medCheckOff: 2,
  prBase: 20,
};

// Cumulative XP required to REACH a given level (level 1 starts at 0).
function xpForLevel(level) {
  return Math.round(100 * Math.pow(level - 1, 1.4));
}

function levelFromXp(totalXp) {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

function xpProgress(totalXp) {
  const level = levelFromXp(totalXp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { level, floor, ceil, current: totalXp - floor, needed: ceil - floor };
}

// Bigger PR jumps earn more coins. percentIncrease is e.g. 0.05 for a 5% jump.
function prReward(percentIncrease) {
  const coins = COIN_REWARDS.prBase + Math.round(Math.min(0.4, Math.max(0, percentIncrease)) * 200);
  return { xp: XP_REWARDS.prBase, coins };
}

window.LevelUpXP = { XP_REWARDS, COIN_REWARDS, xpForLevel, levelFromXp, xpProgress, prReward };
