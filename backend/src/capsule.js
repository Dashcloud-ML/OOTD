// src/capsule.js — the capsule wardrobe trip planner. Given a destination,
// trip length, and luggage constraint, designs a MINIMAL shared set of
// pieces that mix-and-match into a different outfit for every day.
//
// Deliberately self-contained (not sharing code with stylist.js) so this
// new feature can never regress the outfit stylist that's already working
// in production — some duplication, zero shared-code risk.

const SYSTEM_PROMPT = `You are OOTD's capsule wardrobe planner. Given a trip, design the smallest possible set of clothing pieces that mix-and-match into a complete, visibly different outfit for every day of the trip — the classic travel "capsule wardrobe" technique.

Rules:
- Respect the stated gender presentation, budget level, destination climate, and luggage constraint. "Carry-on only" or "backpack only" means fewer pieces; "checked bag" allows a bit more room.
- Aim for roughly (days + 3) to (days + 5) total pieces, never more than 12, regardless of trip length.
- Every piece must be reused across at least 2 different days — no single-use items.
- Each day's outfit must look visibly different from the others (vary the combination meaningfully, not just one accessory).
- Include weather-appropriate layering and no more than 2 pairs of shoes for the whole trip.
- If the traveler lists clothes they already own ("wardrobe mode"), build the capsule primarily from those, adding only the few essentials they're missing.

Respond with ONLY valid JSON, no markdown fences, no preamble:
{
  "reply": "one short friendly sentence about this trip capsule",
  "pieces": [
    {"id": "0001", "type": "shirt|tshirt|blouse|dress|jacket|blazer|sweater|pants|jeans|skirt|shorts|shoes|sneakers|boots|heels|loafers|watch|bag|belt|scarf|jewelry|sunglasses|hat", "name": "specific item, e.g. 'White linen shirt'", "color_hex": "#eeeeee"}
  ],
  "days": [
    {"day": 1, "label": "short label for this day, e.g. 'Arrival & beach walk'", "piece_ids": ["0001","0004","0007"], "why": "one sentence on why this combo works for that day", "image_query": "4-6 word photo search phrase for this look"}
  ]
}
Every id inside "piece_ids" must match a real id from "pieces". Include exactly one entry in "days" per day of the trip.`;

function buildTripMessage({ destination, days, luggage, gender, budget, weather, wardrobe }) {
  const prefs = [
    `destination: ${destination}`,
    `trip length: ${days} day${days === 1 ? "" : "s"}`,
    luggage && `luggage: ${luggage}`,
    gender && `style: ${gender}`,
    budget && `budget: ${budget}`,
    weather && `expected weather: ${weather}`,
    wardrobe && `wardrobe mode ON, items I own: ${wardrobe}`,
  ]
    .filter(Boolean)
    .join(", ");
  return `[Trip details — ${prefs}]\nPlan a capsule wardrobe for this trip.`;
}

/* ---------- Provider: Google Gemini (free tier) ---------- */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

async function callGemini(history, userContent) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userContent }] },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY.trim(),
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
}

/* ---------- Provider: Anthropic Claude (paid) ---------- */

const CLAUDE_MODEL = "claude-sonnet-4-6";

async function callClaude(history, userContent) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [...history, { role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

/* ---------- JSON salvage (same approach as stylist.js) ---------- */

function extractJson(text) {
  let t = (text || "").replace(/```json|```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) t = t.slice(start, end + 1);
  t = t.replace(/,\s*([}\]])/g, "$1");
  return t;
}

/* ---------- Public API ---------- */

export function activeProvider() {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

/**
 * Ask the AI to plan a capsule wardrobe for a trip.
 * @param {object} params - { destination, days, luggage, gender, budget, weather, wardrobe, history }
 * @returns {Promise<{reply: string, pieces: Array, days: Array, _raw: string, _userContent: string}>}
 */
export async function getCapsule(params) {
  const provider = activeProvider();
  if (!provider) {
    throw new Error("No LLM key configured. Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in backend/.env");
  }

  const userContent = buildTripMessage(params);
  const history = params.history || [];

  const call = provider === "gemini" ? callGemini : callClaude;
  const text = await call(history, userContent);
  const clean = extractJson(text);

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const repaired = await call(
      [],
      `Fix the following into valid JSON matching the intended structure. Respond with ONLY the JSON, nothing else:\n\n${clean}`
    );
    parsed = JSON.parse(extractJson(repaired));
  }

  return { ...parsed, _raw: clean, _userContent: userContent };
}