// workout-engine.js
// Owns the exercise database and the weekly split generator.
// Rule enforced: a muscle group cannot be trained again until at least
// 2 full rest days have passed (so Monday -> earliest repeat is Thursday).
// Core/abs are treated as low-fatigue and allowed a 1-day gap instead.

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'core'];

// Big groups get scheduled more often since most splits hit them 2x/week.
const GROUP_WEIGHT = { legs: 3, back: 3, chest: 3, shoulders: 2, biceps: 2, triceps: 2, core: 1 };
const MIN_GAP_DAYS = { chest: 2, back: 2, legs: 2, shoulders: 2, biceps: 2, triceps: 2, core: 1 };

const EXERCISES = [
  { name: 'Barbell Back Squat', group: 'legs', compound: true, min: 12 },
  { name: 'Romanian Deadlift', group: 'legs', compound: true, min: 12 },
  { name: 'Bulgarian Split Squat', group: 'legs', compound: true, min: 10 },
  { name: 'Leg Press', group: 'legs', compound: true, min: 10 },
  { name: 'Walking Lunges', group: 'legs', compound: false, min: 8 },
  { name: 'Leg Curl', group: 'legs', compound: false, min: 7 },
  { name: 'Calf Raise', group: 'legs', compound: false, min: 6 },

  { name: 'Barbell Bench Press', group: 'chest', compound: true, min: 12 },
  { name: 'Incline Dumbbell Press', group: 'chest', compound: true, min: 11 },
  { name: 'Weighted Dip', group: 'chest', compound: true, min: 9 },
  { name: 'Cable Fly', group: 'chest', compound: false, min: 7 },
  { name: 'Push-Up (weighted or AMRAP)', group: 'chest', compound: false, min: 6 },

  { name: 'Pull-Up', group: 'back', compound: true, min: 10 },
  { name: 'Barbell Row', group: 'back', compound: true, min: 11 },
  { name: 'Lat Pulldown', group: 'back', compound: true, min: 9 },
  { name: 'Seated Cable Row', group: 'back', compound: false, min: 8 },
  { name: 'Deadlift', group: 'back', compound: true, min: 14 },
  { name: 'Face Pull', group: 'back', compound: false, min: 6 },

  { name: 'Overhead Press', group: 'shoulders', compound: true, min: 11 },
  { name: 'Dumbbell Lateral Raise', group: 'shoulders', compound: false, min: 7 },
  { name: 'Arnold Press', group: 'shoulders', compound: true, min: 10 },
  { name: 'Rear Delt Fly', group: 'shoulders', compound: false, min: 6 },

  { name: 'Barbell Curl', group: 'biceps', compound: false, min: 7 },
  { name: 'Hammer Curl', group: 'biceps', compound: false, min: 7 },
  { name: 'Incline Dumbbell Curl', group: 'biceps', compound: false, min: 7 },

  { name: 'Close-Grip Bench Press', group: 'triceps', compound: true, min: 9 },
  { name: 'Rope Pushdown', group: 'triceps', compound: false, min: 6 },
  { name: 'Overhead Triceps Extension', group: 'triceps', compound: false, min: 7 },

  { name: 'Hanging Leg Raise', group: 'core', compound: false, min: 6 },
  { name: 'Cable Woodchopper', group: 'core', compound: false, min: 6 },
  { name: 'Plank (timed)', group: 'core', compound: false, min: 5 },
  { name: 'Ab Wheel Rollout', group: 'core', compound: false, min: 6 },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TARGET_MINUTES = 55; // keep sessions around an hour or less

function pickTrainingDayIndices(count) {
  // Spread N training days across a 7-day week as evenly as possible.
  count = Math.min(Math.max(count, 1), 6);
  const spacing = 7 / count;
  const days = [];
  for (let i = 0; i < count; i++) days.push(Math.round(i * spacing));
  return [...new Set(days)];
}

function exercisesFor(group, usedNames) {
  return EXERCISES.filter(e => e.group === group && !usedNames.has(e.name));
}

function buildDayWorkout(groupsForDay, usedNamesGlobal) {
  const sets = [];
  let minutes = 0;
  const usedToday = new Set();
  for (const group of groupsForDay) {
    const pool = exercisesFor(group, usedToday);
    if (!pool.length) continue;
    // Prefer one compound lift per group, then fill with an accessory if time allows.
    const compound = pool.find(e => e.compound) || pool[0];
    sets.push({ exercise: compound.name, muscle_group: group, target_sets: 4, target_reps: compound.compound ? '5-8' : '10-12' });
    usedToday.add(compound.name);
    minutes += compound.min;

    const accessory = pool.find(e => !e.compound && e.name !== compound.name);
    if (accessory && minutes + accessory.min <= TARGET_MINUTES) {
      sets.push({ exercise: accessory.name, muscle_group: group, target_sets: 3, target_reps: '10-15' });
      usedToday.add(accessory.name);
      minutes += accessory.min;
    }
  }
  return { sets, est_minutes: Math.min(minutes, TARGET_MINUTES + 5) };
}

/**
 * Generate a full week's plan.
 * @param {number} workoutsPerWeek
 * @returns {object} plan keyed by day name, e.g. { Mon: {muscle_groups, sets, est_minutes}, ... }
 */
function generateWeeklyPlan(workoutsPerWeek) {
  const trainingDays = pickTrainingDayIndices(workoutsPerWeek); // array of 0-6 (Sun-Sat)
  const lastTrained = {}; // group -> day index it was last scheduled
  const plan = {};
  const usedNamesGlobal = new Set();

  trainingDays.forEach((dayIdx, sessionNum) => {
    // Which groups are eligible today given their rest requirement?
    const eligible = MUSCLE_GROUPS.filter(g => {
      if (!(g in lastTrained)) return true;
      return (dayIdx - lastTrained[g]) >= (MIN_GAP_DAYS[g] + 1);
    });

    // Rank eligible groups: prioritize ones never trained yet, then by weight, then by how long since trained.
    eligible.sort((a, b) => {
      const aNew = !(a in lastTrained), bNew = !(b in lastTrained);
      if (aNew !== bNew) return aNew ? -1 : 1;
      const staleA = aNew ? 999 : dayIdx - lastTrained[a];
      const staleB = bNew ? 999 : dayIdx - lastTrained[b];
      if (staleA !== staleB) return staleB - staleA;
      return GROUP_WEIGHT[b] - GROUP_WEIGHT[a];
    });

    // Take 2-3 groups per day, mixing a big group with a smaller one when possible.
    const groupsForDay = eligible.slice(0, 3);
    if (groupsForDay.length < 2 && eligible.length >= 2) groupsForDay.push(eligible[groupsForDay.length]);

    groupsForDay.forEach(g => { lastTrained[g] = dayIdx; });

    const { sets, est_minutes } = buildDayWorkout(groupsForDay, usedNamesGlobal);
    plan[DAY_NAMES[dayIdx]] = { muscle_groups: groupsForDay, sets, est_minutes };
  });

  return plan;
}

window.LevelUpWorkoutEngine = { generateWeeklyPlan, EXERCISES, MUSCLE_GROUPS, DAY_NAMES };
