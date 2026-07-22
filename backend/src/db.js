// src/db.js — persistence for the Lookbook and Wardrobe, via Supabase's
// auto-generated REST API (PostgREST). No SDK needed — plain fetch, the
// same style as the rest of this backend (stylist.js, images.js, weather.js).
//
// Uses the Supabase SERVICE ROLE key, which bypasses all database rules.
// Keep it in backend/.env only — never send it to the browser, exactly
// like the Gemini/Anthropic keys.

function baseUrl() {
  return (process.env.SUPABASE_URL || "").replace(/\/$/, "");
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function lookbookConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

async function pgrest(path, options = {}) {
  const res = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase error ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ---------- Lookbook (saved outfits) ---------- */

export async function listLookbook(userId) {
  const rows = await pgrest(
    `lookbook?user_id=eq.${encodeURIComponent(userId)}&select=id,outfit,created_at&order=created_at.desc`
  );
  return rows || [];
}

export async function addLookbookItem(userId, outfit) {
  const rows = await pgrest("lookbook", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, outfit }),
  });
  return rows[0];
}

export async function removeLookbookItem(userId, id) {
  await pgrest(
    `lookbook?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

/* ---------- Wardrobe (per-user "items I own" text) ---------- */

export async function getWardrobeProfile(userId) {
  const rows = await pgrest(`profiles?user_id=eq.${encodeURIComponent(userId)}&select=wardrobe`);
  return rows?.[0]?.wardrobe || "";
}

export async function saveWardrobeProfile(userId, wardrobe) {
  await pgrest("profiles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: userId, wardrobe, updated_at: new Date().toISOString() }),
  });
}