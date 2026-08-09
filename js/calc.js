// calc.js — recommendation math for calories and water.
// All weights are stored in kg internally; UI converts to/from lb for display.

const KG_PER_LB = 0.453592;
const KCAL_PER_LB_FAT = 3500;

const RATE_LB_PER_MONTH = { slow: 0.5, moderate: 1, fast: 1.75 };

function bmrMifflinStJeor({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

function activityMultiplier(workoutsPerWeek) {
  if (workoutsPerWeek <= 0) return 1.2;
  if (workoutsPerWeek <= 2) return 1.375;
  if (workoutsPerWeek <= 4) return 1.55;
  if (workoutsPerWeek <= 6) return 1.725;
  return 1.9;
}

function recommendedCalories({ weightKg, heightCm, age, sex, workoutsPerWeek, goalDirection, goalRate }) {
  const bmr = bmrMifflinStJeor({ weightKg, heightCm, age, sex });
  const tdee = bmr * activityMultiplier(workoutsPerWeek);
  if (goalDirection === 'maintain') return Math.round(tdee);

  const lbPerMonth = RATE_LB_PER_MONTH[goalRate] ?? RATE_LB_PER_MONTH.moderate;
  const dailyDelta = (lbPerMonth * KCAL_PER_LB_FAT) / 30;
  const signedDelta = goalDirection === 'gain' ? dailyDelta : -dailyDelta;
  return Math.round(tdee + signedDelta);
}

function recommendedWaterMl({ weightKg, workoutsPerWeek }) {
  const base = weightKg * 33; // ~33ml per kg bodyweight, a common baseline
  const trainingBonus = workoutsPerWeek * 350; // extra per weekly training session
  return Math.round((base + trainingBonus) / 50) * 50; // round to nearest 50ml
}

window.LevelUpCalc = {
  KG_PER_LB,
  RATE_LB_PER_MONTH,
  bmrMifflinStJeor,
  activityMultiplier,
  recommendedCalories,
  recommendedWaterMl,
};
