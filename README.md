# OOTD — AI Outfit Stylist 👗✨

**Never wonder what to wear again.** Tell OOTD where you're going — a first date, a job interview, a wedding — and it designs three complete, distinct outfits with an itemized breakdown, styling rationale, and shopping links, tuned to your style, your budget, and the actual weather.

🔗 **Live:** https://ootd-rose.vercel.app
💻 **Source:** this repo

---

## What it does

- **Conversational AI stylist** — describe an occasion in plain language, get 3 genuinely different outfits back, each with a "why this works" note. Ask for refinements ("less formal," "cheaper," "bolder") and it adjusts the existing looks rather than starting over.
- **Photo-based personalization** — attach a selfie and the stylist tailors color and style choices to your coloring, build, and vibe.
- **Live weather awareness** — enter a city and real weather data (via OpenWeatherMap) shapes fabric and layering choices, not just a static season guess.
- **Wardrobe mode** — list clothes you already own and OOTD builds outfits only from those, plus basics anyone owns.
- **Capsule wardrobe / trip planner** — give it a destination, trip length, and luggage constraint, and it designs a small shared set of pieces (not three unrelated outfits) that mix and match into a different look every day.
- **Shopping links** — every item links out to an Amazon.in / Myntra / Flipkart search.
- **Shareable story cards** — export any outfit as an Instagram-story-shaped image, rendered entirely in-browser via Canvas, with a native share sheet on mobile.
- **Real accounts** — email/password login via Supabase Auth. Fully optional: anonymous mode works exactly the same, and logging in later migrates anything you saved anonymously onto your new account automatically.
- **Persistent, cross-device Lookbook** — save outfits, and they're there next time, on any device, once logged in.
- **Installable PWA** — custom app icon, works offline for static assets, "Add to Home Screen" on both iOS and Android.
- **Dark mode**, a locked editorial visual design (Bodoni Moda + Outfit, one violet accent), and proper URL-based routing so the browser back button and mobile back gesture behave the way they should on any real website.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite, deployed on Vercel |
| Backend | Node.js + Express, deployed on Render |
| AI | Google Gemini (free tier) — provider-agnostic, Claude also supported |
| Database & Auth | Supabase (Postgres + Auth) |
| Images | Unsplash API |
| Weather | OpenWeatherMap API |

The AI layer is intentionally provider-agnostic: `backend/src/stylist.js` auto-detects whether `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` is set and calls whichever is present, with identical behavior either way.

## Project structure

```
ootd/
├── backend/
│   ├── server.js              Express app — all API routes
│   ├── src/
│   │   ├── stylist.js         Outfit generation (Gemini/Claude, dual-provider)
│   │   ├── capsule.js         Trip planner / capsule wardrobe generation
│   │   ├── images.js          Unsplash photo matching, with broader-query fallback
│   │   ├── weather.js         Live weather lookup
│   │   ├── db.js              Supabase persistence (Lookbook, wardrobe, migration)
│   │   └── auth.js            Supabase Auth token verification
│   ├── supabase-schema.sql    Run once in Supabase's SQL editor
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx             Entire UI — stylist, trip planner, lookbook, auth
    │   ├── api.js               Backend client
    │   ├── shareCard.js         Canvas-based shareable story card generator
    │   └── supabaseClient.js   Browser Supabase Auth client
    ├── public/
    │   ├── manifest.json, sw.js, icons/   PWA assets
    ├── vercel.json              SPA routing rewrite + service worker cache headers
    └── .env.example
```

## Setup

Requires Node.js 18+.

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:
- `GEMINI_API_KEY` — free, from [aistudio.google.com](https://aistudio.google.com)
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — from your Supabase project settings (the **service_role** secret key — backend only, never expose it)
- `UNSPLASH_ACCESS_KEY`, `OPENWEATHER_API_KEY` — both optional, both free

```bash
npm run dev
```
Confirm it's alive: `http://localhost:3001/api/health` should show `{"ok":true,"provider":"gemini","db":true}`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Fill in `.env`:
- `VITE_API_URL` — `http://localhost:3001` locally, your deployed backend URL in production
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — the **anon/public** key this time, safe for the browser (protected by Row Level Security, not secrecy — never confuse this with the backend's service_role key)

```bash
npm run dev
```

### Database

Run `backend/supabase-schema.sql` once in your Supabase project's SQL editor to create the `lookbook` and `profiles` tables.

## Deployment

- **Backend → Render.** Root directory `backend`, build `npm install`, start `npm start`. Add all four backend env vars in Render's Environment tab.
- **Frontend → Vercel.** Root directory `frontend`, framework auto-detects as Vite. Add the three frontend env vars in Vercel's Environment Variables. `vercel.json` handles SPA routing and service worker cache headers automatically.

Both platforms auto-redeploy on every push to `main`.

**Free-tier quirk worth knowing:** Render sleeps after ~15 minutes of inactivity (first request after a lull takes 30-60s to wake up), and Supabase free projects pause after about a week of no activity. A free uptime pinger (e.g. UptimeRobot) hitting the backend every 10-14 minutes avoids the Render sleep entirely.

## Honest limitations

- Running on free-tier infrastructure — see the cold-start note above.
- CORS is currently open to any origin, and there's no rate limiting yet — fine for a personal project, worth tightening before wider traffic.
- Email confirmation is disabled for easier testing; no "forgot password" flow exists yet.
- Outfit photos are stock images matched by AI-generated search terms, not real photos of the exact suggested items.
- The Trip Planner is one-shot — no follow-up refinement chat like the main Stylist has.
- Shopping links are generic searches, not tracked affiliate links (yet).
- No automated tests, CI pipeline, or usage analytics.

## Roadmap

Real affiliate revenue, push notifications, group styling for coordinated events, an account settings page, and a CI pipeline are the natural next steps whenever there's time for them.

