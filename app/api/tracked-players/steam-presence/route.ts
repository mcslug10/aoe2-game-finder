import { NextResponse } from "next/server";
import { TRACKED_PLAYERS } from "@/lib/tracked-players";
import { getSteamPresenceForProfileIds } from "@/lib/steam-presence";

export const runtime = "nodejs";

export async function GET() {
  try {
    const presence = await getSteamPresenceForProfileIds(TRACKED_PLAYERS.map((player) => player.profileId));
    return NextResponse.json(
      { presence, source: "Steam Web API", updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "private, max-age=0, s-maxage=30, stale-while-revalidate=15" } },
    );
  } catch (error) {
    console.error("tracked Steam presence", error);
    return NextResponse.json({ error: "Não foi possível consultar a presença na Steam." }, { status: 502 });
  }
}
