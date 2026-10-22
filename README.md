# The Trip: golf trip app

Live scoring, trip handicaps and team standings for the Myrtle Beach golf trip (April 1–3, 2027). It works like 18Birdies: everyone opens the same link on their phone, enters scores hole by hole, and the leaderboard updates for everybody right away.

## What's in it

- **Score**: one hole at a time, big +/– buttons, two players from each team in every foursome. Scores save hole by hole, so two groups can never overwrite each other. With no signal, scores wait on the phone and send themselves later.
- **Leaderboard**: team standings plus individual net/gross for each round and the whole trip. Tap anyone to see their scorecard.
- **Players**: starting handicaps and how they've moved on the trip.
- **Trip**: trip and team names, team format (best ball, match play or aggregate), and the real scorecards for all four courses (par, hole handicaps, tee ratings and slopes), all editable.

## How trip handicaps work

Each player enters their own starting handicap. It counts as 20 rounds of history. After every finished round the app works out that round's score differential (the USGA formula, using the course rating and slope), swaps it in for the oldest round, and averages the last 20. No single round can move a handicap more than 1 stroke. Each round's course handicap is index × slope / 113 + (rating − par).

## Setup (one time)

1. **Database**: in Supabase, open SQL Editor → New query, paste all of [`supabase/setup.sql`](supabase/setup.sql) and press Run.
2. **Keys**: the Supabase Project URL and anon public key go in `src/config.js` (or as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` on Vercel). Without them the app runs in demo mode on one phone.
3. **Website**: in Vercel, Add New → Project → import `golf-trip-app` → Deploy. Every update to the `main` branch republishes automatically.

## For developers

```
npm install
npm run dev                      # local app
npm test                         # golf math tests
node scripts/make-setup-sql.js   # rebuild setup.sql after editing src/lib/courses.js
```
