// src/api.js — the only place the frontend talks to the backend.
// In dev, Vite proxies /api to localhost:3001. In production, set
// VITE_API_URL to your deployed backend, e.g. https://ootd-backend.onrender.com

const BASE = import.meta.env.VITE_API_URL || "";

export async function requestOutfits(payload) {
  const res = await fetch(`${BASE}/api/style`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data; // { reply, outfits, weatherUsed, history }
}
