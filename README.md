[README.md](https://github.com/user-attachments/files/31396163/README.md)
# LevelUp

A gamified all-in-one fitness tracker: gym log, meal-based calorie tracking,
water/meds tracking with streaks, an RPG character with 20 levels + prestige,
a five-rarity shop, a weekly spin wheel, and a schedule you can reshuffle.

## Updating an existing deployment (you already have this live)

Your Supabase project already has real data in it, so **don't re-run
`schema.sql`** — instead:

1. Open your Supabase project → **SQL Editor**.
2. Open `supabase/migration_v2.sql` from this folder, copy all of it, paste
   into the SQL Editor, and click **Run**. This only *adds* new columns and
   tables (meal logging, streaks, prestige, spin wheel, shop rarities/effects)
   — it does not touch your existing workouts, PRs, weight logs, XP, or coins.
3. Replace every file in your GitHub repo with the files in this folder.
   **`js/supabase-client.js` is a fresh copy with placeholder keys** — open it
   and paste your real Supabase URL/anon key back in before you push, or
   login will break.
4. Push to GitHub. Give Pages a minute to redeploy, then reload the site.

If this is a first-time setup instead, follow the original steps: create a
Supabase project, run `schema.sql` (not the migration), paste your keys into
`js/supabase-client.js`, then push to GitHub and turn on Pages.

## What's new in this update

**Calories are now meal-based.** Log each meal by name + calories; they sum
into a running total against your goal, same pattern as water.

**Timing-aware progress bars.** Set your wake/sleep/meal times (onboarding,
or Settings on the dashboard) and both the calorie and water bars show tick
marks for wake, breakfast, lunch, snack, dinner, and bed — each with the %
and the expected value (kcal or oz) at that point in your day. Water fills
linearly from wake to bed; calories follow meal-sized jumps (breakfast
22.5%, lunch 32.5%, dinner 32.5%, snack 12.5% — the midpoints of the ranges
you gave me, since they need to add up to 100%).

**Meds/vitamins**: each box can only be checked once a day (checking it
greys it out; there's no unchecking). Once every box for the day is
checked, a **Collect XP** button appears — that's the only way the 5 XP
(scaled by your meds streak) gets paid out, so there's no more toggling for
free XP.

**Five new streak systems**, each shown on-screen (app page header + the
dashboard's Streaks panel):
- **Meds streak** — 1x (days 1-3) → 1.4x (days 4-9) → 2x + 1 coin/day
  (day 10+). Missing a full day of meds resets it to day 1.
- **Workout streak** — counts consecutive *scheduled* training days you
  actually completed. Off days (rest days in your plan) don't break it, and
  working out on an off day doesn't add to it either. 1x → 1.2x (day 3+) →
  1.4x (day 10+) → 1.5x (day 20+) → 1.75x (day 50+).
- **Nutrition streak** — hit both your calorie and water goal, every day, 5
  days running, for a 1.2x multiplier on all XP that stays active as long as
  you keep hitting both.
- **Login streak** — logging in daily pays 5 XP once per day and, every 7
  consecutive days, unlocks a spin on the wheel.
- **Combo bonus** — hit calorie, water, workout, and meds all in the same
  day for a flat 50 XP bonus (once per day).

**Weekly spin wheel** shows up on the app page whenever you have a spin
banked. Prizes: a free shop item (cheapest one you don't own yet), a 1.5x
XP boost (2 days), a 1.75x XP boost (1 day), a 1.2x XP+coins boost (1
week), 25 or 50 XP (scales with your level, like any other XP), or 10/25/50
coins.

**Workout XP** is now 1 XP per set, 5 XP per exercise you complete all sets
of, and 20 XP for finishing the workout — with a summary breakdown shown
right after you finish.

**20 levels**, each with a name and its own XP multiplier (Shrimp at 1x up
through Champion at 4.75x and Titan at 5x). Olympian (level 20, the max
level) shares Titan's 5x rather than getting a higher tier of its own,
since there's nowhere further to level up into. Full table and thresholds
are in `LEVEL_META` in `js/xp-engine.js`.

**Prestige**: once you hit level 20 (max), a Prestige button appears on the
dashboard. It resets you to level 1 with a fresh (1.2x steeper) XP curve,
in exchange for a permanent multiplier — 1.5x the first time, +0.2x every
prestige after. Your rank name gets a roman numeral (Shrimp II, Bronze III,
etc.) once you've prestiged at least once. Items you already own stay
equippable even if a prestige puts your level below their unlock level —
only *new* purchases are level-gated.

**Shop**: five rarities (common → mythical). A handful of ultra rare and
mythical items carry a passive effect while equipped — e.g. Phoenix Aura
gives +25% workout XP, Iron Halo gives +40% login XP. Only one piece per
slot (hat/outfit/pet/accessory) can be equipped at a time, same as before.

**Schedule tab** (new nav link): a weekly calendar with a dot for each day
— green if you hit your calorie goal, blue for water, orange for meds — plus
a 🏋️ if that day is a scheduled training day and a ✅ if you actually logged
a workout. Tap **Swap** on one day, then **Swap** on another day in the same
week, to trade which day carries which workout. This only reveals *which
days* are training days, not the exercises themselves — the exercise list
is still hidden until you hit Start Workout, so the core surprise mechanic
is untouched.

**How every multiplier stacks**: level multiplier × prestige multiplier ×
(meds streak, but only for meds XP) × (workout streak, but only for workout
XP) × nutrition streak × any active spin-wheel boost × any equipped
mythical item effect that matches the category — all multiplied together,
then rounded once at the end. That's all in the single `computeAward()`
function in `js/xp-engine.js` if you want to see or change the exact math.

## Files touched in this update

- `supabase/migration_v2.sql` — new, run this once
- `js/xp-engine.js`, `js/data.js`, `js/game-logic.js` (new), `js/timeline.js`
  (new) — all the systems above
- `app.html`, `dashboard.html` — rebuilt for the new features
- `schedule.html` — new page
- `onboarding.html` — added the wake/sleep/meal time fields
- `css/style.css` — timeline markers + shop rarity colors added
- `js/supabase-client.js`, `js/auth.js`, `js/calc.js`, `js/character.js`,
  `js/workout-engine.js` — untouched
