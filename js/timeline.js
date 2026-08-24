// timeline.js — builds the wake/meal/sleep tick marks shown under the
// calorie and water progress bars.
// Calorie ticks use the meal-percentage ranges (midpoints, which sum to
// 100%): breakfast 22.5%, lunch 32.5%, dinner 32.5%, snack 12.5%.
// Water is linear between wake (0%) and bedtime (100%).

const MEAL_PCT = { breakfast: 0.225, lunch: 0.325, dinner: 0.325, snack: 0.125 };

function parseHHMM(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatClock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${period}`;
}

/**
 * Returns an array of ticks sorted by time-of-day, each with the cumulative
 * calorie % (meal schedule) and water % (linear) expected by that time.
 */
function buildTimelinePoints(profile) {
  const wake = parseHHMM(profile.wake_time);
  const sleep = parseHHMM(profile.sleep_time);
  if (wake == null || sleep == null) return [];

  let sleepNorm = sleep <= wake ? sleep + 1440 : sleep;

  const raw = [
    { label: 'Wake', time: profile.wake_time, type: 'wake' },
    { label: 'Breakfast', time: profile.breakfast_time, type: 'breakfast' },
    { label: 'Lunch', time: profile.lunch_time, type: 'lunch' },
    { label: 'Snack', time: profile.snack_time, type: 'snack' },
    { label: 'Dinner', time: profile.dinner_time, type: 'dinner' },
    { label: 'Bed', time: profile.sleep_time, type: 'sleep' },
  ].filter(p => p.time);

  const withMinutes = raw.map(p => {
    let mins = parseHHMM(p.time);
    if (p.type !== 'wake' && mins < wake) mins += 1440; // late-night point, normalize into the wake->sleep span
    return { ...p, mins };
  }).sort((a, b) => a.mins - b.mins);

  let cumulativeCalPct = 0;
  const span = Math.max(1, sleepNorm - wake);

  return withMinutes.map(p => {
    if (MEAL_PCT[p.type]) cumulativeCalPct += MEAL_PCT[p.type];
    const waterPct = Math.min(1, Math.max(0, (p.mins - wake) / span));
    const calPct = p.type === 'sleep' ? 1 : Math.min(1, cumulativeCalPct);
    return { label: p.label, time: p.time, clock: formatClock(p.time), positionPct: waterPct * 100, waterPct, calPct };
  });
}

function renderTimelineRow(points, kind, goalValue, unit) {
  // kind: 'calories' | 'water'. unit: 'kcal' | 'oz'.
  if (!points.length) return '<p class="eyebrow">Set your wake/sleep/meal times in Settings to see timing markers.</p>';
  const marks = points.map(p => {
    const pct = kind === 'calories' ? p.calPct : p.waterPct;
    const value = Math.round(pct * goalValue);
    return `<div class="timeline-tick" style="left:${p.positionPct.toFixed(1)}%;">
      <span class="timeline-dot"></span>
      <span class="timeline-label">${p.clock}<br>${Math.round(pct * 100)}% · ${value}${unit}</span>
    </div>`;
  }).join('');
  return `<div class="timeline-row">${marks}</div>`;
}

window.LevelUpTimeline = { buildTimelinePoints, renderTimelineRow, formatClock, MEAL_PCT };
