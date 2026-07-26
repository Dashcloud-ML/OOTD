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

export async function fetchLookbook(userId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}/api/lookbook?userId=${encodeURIComponent(userId)}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data; // { items, configured }
}

export async function saveToLookbook(userId, outfit, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/lookbook`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, outfit }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data; // { item }
}

export async function removeFromLookbook(userId, id, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}/api/lookbook/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function fetchWardrobe(userId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}/api/wardrobe?userId=${encodeURIComponent(userId)}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data; // { wardrobe, configured }
}

export async function saveWardrobe(userId, wardrobe, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/wardrobe`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, wardrobe }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function claimAnonymousData(anonymousUserId, token) {
  const res = await fetch(`${BASE}/api/claim-anonymous-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ anonymousUserId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function requestCapsule(payload) {
  const res = await fetch(`${BASE}/api/capsule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data; // { reply, pieces, days, weatherUsed, history }
}