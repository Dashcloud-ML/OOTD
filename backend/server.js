// server.js — OOTD backend entry point.
// One core endpoint: POST /api/style
//   body: { message, gender, budget, weather, city, wardrobe, history }
//   returns: { reply, outfits[ {name, items, why, tags, budget, image} ], history }

import "dotenv/config";
import express from "express";
import cors from "cors";
import { getOutfits, activeProvider } from "./src/stylist.js";
import { getCapsule } from "./src/capsule.js";
import { attachImages } from "./src/images.js";
import { getWeather } from "./src/weather.js";
import {
  lookbookConfigured, listLookbook, addLookbookItem, removeLookbookItem,
  getWardrobeProfile, saveWardrobeProfile, reassignUserData,
} from "./src/db.js";
import { resolveUserId, verifySupabaseToken } from "./src/auth.js";

const app = express();
app.use(cors()); // for production, restrict: cors({ origin: "https://your-frontend.vercel.app" })
app.use(express.json({ limit: "10mb" })); // room for base64 photos

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "OOTD backend", provider: activeProvider(), db: lookbookConfigured() });
});

app.post("/api/style", async (req, res) => {
  try {
    const { message, gender, budget, weather, city, wardrobe, history, photo } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Field 'message' is required." });
    }
    if (!activeProvider()) {
      return res.status(500).json({ error: "No LLM key configured. Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in backend/.env — see .env.example." });
    }

    // Live weather beats the manual dropdown when a city is given and the key exists.
    const liveWeather = await getWeather(city);
    const effectiveWeather = liveWeather || weather;

    // Photo is optional: must be a data-URL image, capped in size. Never stored — passed straight to the LLM.
    const safePhoto =
      typeof photo === "string" && photo.startsWith("data:image/") && photo.length < 6_000_000
        ? photo
        : undefined;

    const result = await getOutfits({
      message: message.trim().slice(0, 1000),
      photo: safePhoto,
      gender,
      budget,
      weather: effectiveWeather,
      wardrobe: wardrobe?.slice(0, 1000),
      history: Array.isArray(history) ? history.slice(-12) : [], // keep context bounded
    });

    const outfitsWithImages = await attachImages(result.outfits || []);

    // Send back updated history so the frontend can pass it on the next turn (stateless server).
    const newHistory = [
      ...(Array.isArray(history) ? history.slice(-12) : []),
      { role: "user", content: result._userContent },
      { role: "assistant", content: result._raw },
    ];

    res.json({
      reply: result.reply,
      outfits: outfitsWithImages,
      weatherUsed: effectiveWeather || null,
      history: newHistory,
    });
  } catch (err) {
    console.error("style error:", err.message);
    res.status(502).json({ error: "The stylist couldn't process that request. Please try again." });
  }
});

/* ---------- Lookbook & wardrobe: optional Supabase persistence ----------
   If SUPABASE_URL/SUPABASE_SERVICE_KEY aren't set, GET routes return
   configured:false so the frontend falls back to in-memory only — nothing
   breaks for anyone who hasn't set up Supabase yet. */

app.get("/api/lookbook", async (req, res) => {
  try {
    const { userId } = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId is required." });
    if (!lookbookConfigured()) return res.json({ items: [], configured: false });
    const items = await listLookbook(userId);
    res.json({ items, configured: true });
  } catch (err) {
    console.error("lookbook list error:", err.message);
    res.status(502).json({ error: "Couldn't load your Lookbook right now." });
  }
});

app.post("/api/lookbook", async (req, res) => {
  try {
    const { outfit } = req.body || {};
    const { userId } = await resolveUserId(req);
    if (!userId || !outfit) return res.status(400).json({ error: "userId and outfit are required." });
    if (!lookbookConfigured()) return res.status(503).json({ error: "Lookbook sync isn't set up yet." });
    const item = await addLookbookItem(userId, outfit);
    res.json({ item });
  } catch (err) {
    console.error("lookbook save error:", err.message);
    res.status(502).json({ error: "Couldn't save that look right now." });
  }
});

app.delete("/api/lookbook/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId is required." });
    if (!lookbookConfigured()) return res.status(503).json({ error: "Lookbook sync isn't set up yet." });
    await removeLookbookItem(userId, id);
    res.json({ ok: true });
  } catch (err) {
    console.error("lookbook delete error:", err.message);
    res.status(502).json({ error: "Couldn't remove that look right now." });
  }
});

app.get("/api/wardrobe", async (req, res) => {
  try {
    const { userId } = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId is required." });
    if (!lookbookConfigured()) return res.json({ wardrobe: "", configured: false });
    const wardrobe = await getWardrobeProfile(userId);
    res.json({ wardrobe, configured: true });
  } catch (err) {
    console.error("wardrobe get error:", err.message);
    res.status(502).json({ error: "Couldn't load your wardrobe." });
  }
});

app.post("/api/wardrobe", async (req, res) => {
  try {
    const { wardrobe } = req.body || {};
    const { userId } = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId is required." });
    if (!lookbookConfigured()) return res.status(503).json({ error: "Wardrobe sync isn't set up yet." });
    await saveWardrobeProfile(userId, wardrobe || "");
    res.json({ ok: true });
  } catch (err) {
    console.error("wardrobe save error:", err.message);
    res.status(502).json({ error: "Couldn't save your wardrobe." });
  }
});

/* ---------- Account login: migrate anonymous data on first sign-in ---------- */

app.post("/api/claim-anonymous-data", async (req, res) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const user = token && (await verifySupabaseToken(token));
    if (!user) return res.status(401).json({ error: "Not logged in." });

    const { anonymousUserId } = req.body || {};
    if (!anonymousUserId) return res.status(400).json({ error: "anonymousUserId is required." });
    if (!lookbookConfigured()) return res.status(503).json({ error: "Not configured." });

    await reassignUserData(anonymousUserId, user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("claim-anonymous-data error:", err.message);
    res.status(502).json({ error: "Couldn't migrate your saved data, but you're logged in fine." });
  }
});

/* ---------- Capsule wardrobe trip planner ---------- */

app.post("/api/capsule", async (req, res) => {
  try {
    const { destination, days, luggage, gender, budget, weather, city, wardrobe, history } = req.body || {};

    if (!destination || typeof destination !== "string" || !destination.trim()) {
      return res.status(400).json({ error: "Field 'destination' is required." });
    }
    if (!activeProvider()) {
      return res.status(500).json({ error: "No LLM key configured. Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in backend/.env — see .env.example." });
    }

    const liveWeather = await getWeather(city);
    const effectiveWeather = liveWeather || weather;
    const safeDays = Math.max(1, Math.min(14, Number(days) || 3)); // sanity cap — no 300-day capsules

    const result = await getCapsule({
      destination: destination.trim().slice(0, 100),
      days: safeDays,
      luggage,
      gender,
      budget,
      weather: effectiveWeather,
      wardrobe: wardrobe?.slice(0, 1000),
      history: Array.isArray(history) ? history.slice(-6) : [],
    });

    const daysWithImages = await attachImages(result.days || []);

    const newHistory = [
      ...(Array.isArray(history) ? history.slice(-6) : []),
      { role: "user", content: result._userContent },
      { role: "assistant", content: result._raw },
    ];

    res.json({
      reply: result.reply,
      pieces: result.pieces || [],
      days: daysWithImages,
      weatherUsed: effectiveWeather || null,
      history: newHistory,
    });
  } catch (err) {
    console.error("capsule error:", err.message);
    res.status(502).json({ error: "The capsule planner couldn't process that request. Please try again." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`OOTD backend running on http://localhost:${PORT}`);
});