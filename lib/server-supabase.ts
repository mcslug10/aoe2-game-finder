import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

export function getAdminSupabase() {
  if (!url || !secret) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
