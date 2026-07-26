// src/supabaseClient.js — the browser's connection to Supabase Auth.
//
// IMPORTANT DISTINCTION from every other key in this app: this uses the
// "anon" / "public" key, NOT the service_role key from the backend's .env.
// The anon key is *designed* to be shipped to browsers — Supabase's Row
// Level Security policies are what protect data, not secrecy of this key.
// The service_role key must still never leave the backend.
//
// If these env vars aren't set, `supabase` is null and the app falls back
// to anonymous-only mode — logging in just won't be available yet.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

if (!supabase && import.meta.env.DEV) {
  console.warn(
    "Login is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env to enable it."
  );
}