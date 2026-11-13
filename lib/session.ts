import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "aoe2_guest";
function signature(playerId: string) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is missing.");
  return createHmac("sha256", secret).update(playerId).digest("hex");
}
export function signPlayer(playerId: string) { return `${playerId}.${signature(playerId)}`; }
export function verifyPlayer(token?: string | null) {
  if (!token) return null;
  const [playerId, supplied] = token.split(".");
  if (!playerId || !supplied || !/^[0-9a-f-]{36}$/i.test(playerId)) return null;
  const expected = signature(playerId);
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? playerId : null;
}
export async function currentPlayerId() {
  const store = await cookies();
  return verifyPlayer(store.get(COOKIE)?.value);
}
export const guestCookieName = COOKIE;
