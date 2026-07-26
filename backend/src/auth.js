// src/auth.js — verifies Supabase Auth tokens for logged-in users.
//
// Design: login is OPTIONAL. If a request carries a valid Bearer token, we
// trust the verified user id from Supabase over anything the client claims.
// If there's no token (or it's invalid), we fall back to the anonymous
// userId the client sends — exactly the pre-login behavior, unchanged.
//
// Uses the same plain-fetch style as the rest of this backend — no new SDK.

export async function verifySupabaseToken(token) {
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_SERVICE_KEY,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}

/**
 * Resolves which user id a request should act as.
 * @param {import('express').Request} req
 * @returns {Promise<{userId: string|undefined, verified: boolean}>}
 */
export async function resolveUserId(req) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    const user = await verifySupabaseToken(token);
    if (user) return { userId: user.id, verified: true };
  }

  // No valid token — anonymous mode, exactly as before login existed.
  const anonId = req.query.userId || req.body?.userId;
  return { userId: anonId, verified: false };
}