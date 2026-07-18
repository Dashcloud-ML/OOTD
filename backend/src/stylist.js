// src/stylist.js — the brain of OOTD.
// Supports TWO providers, chosen automatically by which key exists in .env:
//   - GEMINI_API_KEY     → Google Gemini (FREE tier, recommended to start)
//   - ANTHROPIC_API_KEY  → Claude (paid, easy upgrade later)
// Everything else in the app is provider-agnostic.

const SYSTEM_PROMPT = `You are OOTD, a warm, confident personal fashion stylist. The user tells you an occasion; you suggest outfits.

Rules:
- Respect the user's stated gender presentation, budget level, and weather. If the user lists clothes they own ("wardrobe mode"), build outfits ONLY from those items plus basics anyone owns.
- Never repeat an outfit already suggested in this conversation. On refinement requests ("less formal", "cheaper"), adjust the previous outfits accordingly.
- Keep the "why" note specific to the occasion, one or two sentences, friendly.
- If the user attaches a photo of themselves, tailor the outfits to what flatters them (coloring, build, hair, overall vibe) and briefly mention that personalization in "reply". Be warm and positive — never criticize their appearance.

Respond with ONLY valid JSON, no markdown fences, no preamble:
{
  "reply": "one short friendly stylist sentence reacting to the request",
  "outfits": [
    {
      "name": "outfit name (3-5 words)",
      "items": [
        {"type": "shirt|tshirt|blouse|dress|jacket|blazer|sweater|pants|jeans|skirt|shorts|shoes|sneakers|boots|heels|loafers|watch|bag|belt|scarf|jewelry|sunglasses|hat", "name": "specific item, e.g. 'Slim navy chinos'", "color_hex": "#334466"}
      ],
      "why": "why this works for the occasion",
      "tags": ["2-4 short style tags"],
      "budget": "casual|mid-range|premium",
      "image_query": "a 4-6 word photo search phrase for this outfit, e.g. 'man smart casual navy blazer street style'"
    }
  ]
}
Give exactly 3 outfits, each with 4-6 items. color_hex must be the real dominant color of that item.`;

function buildUserMessage({ message, gender, budget, weather, wardrobe }) {
  const prefs = [
    gender && `style: ${gender}`,
    budget && `budget: ${budget}`,
    weather && `weather: ${weather}`,
    wardrobe && `wardrobe mode ON, items I own: ${wardrobe}`,
  ]
    .filter(Boolean)
    .join(", ");
  return `[Preferences — ${prefs || "none"}]\n${message}`;
}

/* ---------- Photo handling ---------- */

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i.exec(dataUrl || "");
  return m ? { mime: m[1], data: m[2] } : null;
}

/* ---------- Provider: Google Gemini (free tier) ---------- */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

async function callGemini(history, userContent, photo) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  // Gemini uses roles "user" and "model" (not "assistant").
  const img = parseDataUrl(photo);
  const userParts = [{ text: userContent }];
  if (img) userParts.push({ inline_data: { mime_type: img.mime, data: img.data } });

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: userParts },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY.trim(), // header auth works for both old (AIzaSy...) and new (AQ....) key formats
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json", // ask Gemini for pure JSON
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
  return text;
}

/* ---------- Provider: Anthropic Claude (paid) ---------- */

const CLAUDE_MODEL = "claude-sonnet-4-6";

async function callClaude(history, userContent, photo) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        ...history,
        {
          role: "user",
          content: (() => {
            const img = parseDataUrl(photo);
            return img
              ? [
                  { type: "image", source: { type: "base64", media_type: img.mime, data: img.data } },
                  { type: "text", text: userContent },
                ]
              : userContent;
          })(),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/* ---------- JSON salvage ----------
   LLM output is usually clean JSON, but can arrive with markdown fences,
   preamble text, or trailing commas. Extract the outermost {...} and tidy it. */

function extractJson(text) {
  let t = (text || "").replace(/```json|```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) t = t.slice(start, end + 1);
  // remove trailing commas before } or ] (common LLM glitch)
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
 * Ask the AI stylist for outfits.
 * @param {object} params - { message, gender, budget, weather, wardrobe, history }
 * @returns {Promise<{reply: string, outfits: Array, _raw: string, _userContent: string}>}
 */
export async function getOutfits(params) {
  const provider = activeProvider();
  if (!provider) {
    throw new Error("No LLM key configured. Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in backend/.env");
  }

  const userContent = buildUserMessage(params);
  const history = params.history || [];

  const call = provider === "gemini" ? callGemini : callClaude;
  const text = await call(history, userContent, params.photo);
  const clean = extractJson(text);

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // One retry: ask the same model to repair its own output into valid JSON.
    const repaired = await call(
      [],
      `Fix the following into valid JSON matching the intended structure. Respond with ONLY the JSON, nothing else:\n\n${clean}`
    );
    parsed = JSON.parse(extractJson(repaired));
  }

  return { ...parsed, _raw: clean, _userContent: userContent };
}