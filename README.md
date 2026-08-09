# LevelUp

A gamified all-in-one fitness tracker: gym log, calorie/water/meds tracking,
an RPG character that levels up, and a shop you buy gear with workout coins.

## 1. Set up the backend (Supabase — free)

Your phone and computer need to see the *same* data, and GitHub Pages only
serves static files — it can't run a database. Supabase gives you auth +
a Postgres database for free and works fine from plain HTML/JS.

1. Go to https://supabase.com → New Project (free tier is plenty).
2. Once it's created, open **SQL Editor** → paste in everything from
   `supabase/schema.sql` → Run. This creates all tables, security rules,
   and the starter shop inventory.
3. Go to **Settings → API**. Copy the **Project URL** and the **anon public
   key**.
4. Open `js/supabase-client.js` and paste them in:
   ```js
   const SUPABASE_URL = 'https://xxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```
5. In Supabase, go to **Authentication → Providers → Email** and turn off
   "Confirm email" if you want to skip the verification-email step for
   your own single-user app (optional, easier to just log in and go).

## 2. Deploy to GitHub Pages

1. Create a new GitHub repo, push this whole folder to it.
2. Repo → **Settings → Pages** → Source: `main` branch, root folder.
3. Your app will be live at `https://<username>.github.io/<repo>/`.

## 3. First run

1. Open the site → **Create Account** with any email/password (this is
   just for you, so it doesn't need to be a real inbox unless you left
   email confirmation on).
2. You'll land on the setup screen: height, weight, age, sex, workout
   frequency, and your weight goal. It calculates a recommended calorie
   and water target (Mifflin-St Jeor + activity multiplier) that you can
   override with your own number.
3. From then on:
   - **On your phone**: open the site, hit **Start Workout** (only reveals
     that day's exercises when you press it — no scrolling ahead), log
     your sets, track water/calories/meds.
   - **On your computer**: open `dashboard.html` (linked from the top
     nav, which only shows on wider screens) for your weight chart,
     workout history, PRs, character, and the shop.

## How the pieces work

- **Workout generator** (`js/workout-engine.js`): builds your week fresh
  each Sunday. It picks muscle groups per day so the same group isn't
  hit again for at least 2 full rest days (core is exempt — abs recover
  faster), mixes big + small groups in the same session like you asked
  (squats + bench + pull-ups can land on one day), and stops adding
  exercises once a day would run past ~55 min.
- **XP / leveling** (`js/xp-engine.js`): every logged set, finished
  workout, hit goal, med check-off, and PR gives XP + coins. PRs scale
  their coin bonus with how big the jump was.
- **Character** (`js/character.js`): the silhouette gets visibly more
  built at level 6 and level 12, and equipped shop items (hats, outfits,
  pets, accessories) layer on top.
- **Desktop-only log**: this is a soft restriction (screen-width +
  pointer-type check), not real security — it's just there so your phone
  view stays focused on quick logging instead of a full chart. Anyone
  could bypass it by resizing a browser window; that was the tradeoff
  you asked for to keep things simple.

## Notes / things you may want to tweak later

- The "2 rest days" muscle-group rule and the ~55 min session cap are
  both constants at the top of `workout-engine.js` if you want to loosen
  or tighten them.
- The exercise list is a starting set — add more to `EXERCISES` in the
  same file to get more variety in what the generator can pick.
- Calorie-goal XP triggers when logged calories land within 10% of your
  goal for the day; water XP triggers once you cross the goal. Both only
  fire once per day.
