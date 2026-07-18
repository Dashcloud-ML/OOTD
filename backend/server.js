// server.js — OOTD backend entry point.
// One core endpoint: POST /api/style
//   body: { message, gender, budget, weather, city, wardrobe, history }
//   returns: { reply, outfits[ {name, items, why, tags, budget, image} ], history }

import "dotenv/config";
import express from "express";
import cors from "cors";
import { getOutfits, activeProvider } from "./src/stylist.js";
import { attachImages } from "./src/images.js";
import { getWeather } from "./src/weather.js";

const app = express();
app.use(cors()); // for production, restrict: cors({ origin: "https://your-frontend.vercel.app" })
app.use(express.json({ limit: "10mb" })); // room for base64 photos

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "OOTD backend", provider: activeProvider() });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`OOTD backend running on http://localhost:${PORT}`);
});