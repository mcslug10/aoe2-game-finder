import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 20;

// The World's Edge community endpoint is undocumented and may change.
// Requests are server-side and cached to avoid making every visitor poll upstream.
const ENDPOINT = "https://aoe-api.worldsedgelink.com/community/advertisement/findAdvertisements?title=age2&start=0";
type RawLobby = {
  id?: number | string;
  name?: string;
  num_slots?: number;
  game_type?: number;
  map_type?: number;
  has_password?: boolean;
  players?: Array<{ name?: string; alias?: string; profile_id?: number; user_id?: number }>;
  slots?: Array<{ name?: string; alias?: string; profile_id?: number; user_id?: number; status?: number }>;
  region?: string;
  [key: string]: unknown;
};
function extractLobbies(payload: unknown): RawLobby[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const result = root.result && typeof root.result === "object" ? root.result as Record<string, unknown> : root;
  const candidates = [result.advertisements, result.matches, result.lobbies, root.advertisements, root.matches];
  const found = candidates.find(Array.isArray);
  return (found as RawLobby[] | undefined) ?? [];
}
function mapMode(value: number | undefined): string {
  const modes: Record<number, string> = { 0: "Random Map", 1: "Death Match", 2: "Empire Wars", 3: "Battle Royale" };
  return value == null ? "Modo não identificado" : modes[value] ?? `Modo ${value}`;
}
export async function GET() {
  try {
    const response = await fetch(ENDPOINT, {
      headers: { "Accept": "application/json", "User-Agent": "AOE2-Game-Finder/1.0 (community lobby browser)" },
      next: { revalidate: 20 },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return NextResponse.json({ lobbies: [], sourceStatus: "unavailable", message: "O serviço de lobbies está temporariamente indisponível." }, { status: 200 });
    }
    const payload: unknown = await response.json();
    const lobbies = extractLobbies(payload).map((item) => {
      const slots = Array.isArray(item.slots) ? item.slots : Array.isArray(item.players) ? item.players : [];
      const players = slots.map((slot) => slot.alias ?? slot.name ?? (slot.profile_id ? `Jogador ${slot.profile_id}` : null)).filter((name): name is string => Boolean(name));
      const id = String(item.id ?? "");
      return {
        id,
        name: String(item.name ?? "Partida sem título").trim() || "Partida sem título",
        players,
        playerCount: players.length,
        slots: Number.isFinite(item.num_slots) ? Number(item.num_slots) : slots.length,
        mode: mapMode(typeof item.game_type === "number" ? item.game_type : undefined),
        passwordProtected: Boolean(item.has_password),
        region: typeof item.region === "string" ? item.region : "Global",
        joinUrl: id ? `aoe2de://0/${encodeURIComponent(id)}` : null,
      };
    }).filter((item) => item.id && item.playerCount < item.slots);
    return NextResponse.json({ lobbies, sourceStatus: "ok", updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("public lobby browser", error);
    return NextResponse.json({ lobbies: [], sourceStatus: "unavailable", message: "Não foi possível consultar os lobbies globais agora." }, { status: 200 });
  }
}
