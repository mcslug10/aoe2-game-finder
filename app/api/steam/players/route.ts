import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STEAM_APP_ID = 813780;
const STEAM_API_URL =
  "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=" +
  STEAM_APP_ID;

type SteamPlayerCountPayload = {
  response?: {
    player_count?: number;
    result?: number;
  };
};

export async function GET() {
  try {
    const response = await fetch(STEAM_API_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error("Steam current player count request failed", { status: response.status });
      return NextResponse.json(
        { error: "A Steam API está temporariamente indisponível." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const payload = await response.json() as SteamPlayerCountPayload;
    const playerCount = Number(payload.response?.player_count);

    if (!Number.isSafeInteger(playerCount) || playerCount < 0) {
      console.error("Steam current player count response was invalid", payload);
      return NextResponse.json(
        { error: "A Steam API retornou uma contagem inválida." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const updatedAt = new Date().toISOString();
    return NextResponse.json(
      {
        appId: STEAM_APP_ID,
        playerCount,
        updatedAt,
        source: "Steam Web API",
        scope: "Steam-connected players only",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("Steam current player count error", error);
    return NextResponse.json(
      {
        error: error instanceof Error && error.name === "TimeoutError"
          ? "A consulta à Steam demorou mais que o esperado."
          : "Não foi possível consultar os jogadores online da Steam.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
