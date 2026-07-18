# OOTD — AI Outfit Stylist 👗✨

Never wonder what to wear again. Tell OOTD where you're going ("I'm going on a first date tonight") and get three complete outfit suggestions with images, item-by-item breakdowns, and a stylist's explanation of why each look works.

## Features

- **Chat-style AI stylist** powered by Claude — natural language in, structured outfits out
- **Refinement conversation** — "less formal", "cheaper", "different colors" (remembers context)
- **Real outfit photos** from Unsplash, with a color-swatch flat-lay fallback
- **Weather-aware** — enter a city for live weather (OpenWeatherMap), or use the manual dropdown
- **Wardrobe mode** — list what you own; OOTD styles only from those pieces
- **Budget & style filters** — Casual / Mid-range / Premium, Men / Women / Neutral
- **Lookbook** — save favorite outfits (session-only for now; see Roadmap)

## Project structure

```
ootd/
├── backend/            Express API server
│   ├── server.js       POST /api/style endpoint
│   ├── src/stylist.js  Claude prompt + JSON parsing (the brain)
│   ├── src/images.js   Unsplash photo search
│   ├── src/weather.js  OpenWeatherMap lookup
│   └── .env.example    API key template
└── frontend/           React app (Vite)
    └── src/
        ├── App.jsx     Full UI: landing, chat, outfit cards, lookbook
        └── api.js      Backend client
```

## Setup

You need Node.js 18+ (for built-in `fetch`).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env and paste your ANTHROPIC_API_KEY (required)
# UNSPLASH_ACCESS_KEY and OPENWEATHER_API_KEY are optional but recommended
npm run dev
```

The API runs on http://localhost:3001 — check http://localhost:3001/api/health

Test it directly:

```bash
curl -X POST http://localhost:3001/api/style \
  -H "Content-Type: application/json" \
  -d '{"message":"I have a first date at a café tonight","gender":"Men","budget":"Mid-range","weather":"Mild"}'
```

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the dev server proxies `/api` calls to the backend automatically.

## Deployment

**Backend → Render/Railway:** create a new web service from the `backend` folder, set the environment variables from `.env`, start command `npm start`.

**Frontend → Vercel/Netlify:** deploy the `frontend` folder, and set one environment variable:

```
VITE_API_URL=https://your-backend.onrender.com
```

Then in `backend/server.js`, tighten CORS to your frontend URL (see the comment on the `cors()` line).

## Security notes

- API keys live **only** in `backend/.env` — never in frontend code, never committed to git. Add `.env` to `.gitignore`.
- The backend caps message length and conversation history to keep costs bounded.

## Roadmap

- [ ] Persist Lookbook + Wardrobe with Supabase (anonymous user IDs first, accounts later)
- [ ] Shareable outfit cards (render card to image, Web Share API)
- [ ] Geolocation for automatic city detection
- [ ] Shopping links per item (affiliate APIs)
- [ ] Photo upload of your own clothes with AI recognition
