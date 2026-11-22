import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;

type CompanionPlayer = {
  profileId?: number;
  name?: string;
  country?: string;
  rank?: number;
  rankCountry?: number;
  rating?: number;
  maxRating?: number;
  wins?: number;
  losses?: number;
  games?: number;
  streak?: number;
  lastMatchTime?: string | Date;
  avatarSmallUrl?: string;
  avatarMediumUrl?: string;
};

const LEADERBOARDS = {
  "1v1": "rm_1v1",
  TG: "rm_team",
} as const;

export async function GET(request: NextRequest) {
  const modeParam = request.nextUrl.searchParams.get("mode") ?? "1v1";
  const regionParam = request.nextUrl.searchParams.get("region") ?? "WORLD";

  if (modeParam !== "1v1" && modeParam !== "TG") {
    return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });
  }
  if (regionParam !== "WORLD" && regionParam !== "BR") {
    return NextResponse.json({ error: "Região inválida." }, { status: 400 });
  }

  const leaderboardId = LEADERBOARDS[modeParam];
  const url = new URL("https://data.aoe2companion.com/api/leaderboards/" + leaderboardId);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("language", "en");
  if (regionParam === "BR") url.searchParams.set("country", "BR");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AOE2-Game-Finder/1.0 (https://aoe2-game-finder.vercel.app)",
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("AoE2 Companion leaderboard", response.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: "O ranking do AoE II Companion está temporariamente indisponível.", sourceStatus: "unavailable" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const payload = await response.json() as { players?: CompanionPlayer[]; total?: number; page?: number; perPage?: number };
    const players = (Array.isArray(payload.players) ? payload.players : [])
      .filter((player) => Number.isSafeInteger(Number(player.profileId)) && Number(player.profileId) > 0)
      .map((player) => ({
        profileId: Number(player.profileId),
        name: String(player.name ?? "Jogador desconhecido"),
        country: String(player.country ?? "").toUpperCase(),
        rank: Number(player.rank ?? 0),
        rankCountry: Number(player.rankCountry ?? 0),
        rating: Number(player.rating ?? 0),
        maxRating: Number(player.maxRating ?? 0),
        wins: Number(player.wins ?? 0),
        losses: Number(player.losses ?? 0),
        games: Number(player.games ?? (Number(player.wins ?? 0) + Number(player.losses ?? 0))),
        streak: Number(player.streak ?? 0),
        lastMatchTime: player.lastMatchTime ? new Date(String(player.lastMatchTime)).toISOString() : null,
        avatarSmallUrl: player.avatarSmallUrl ?? null,
        avatarMediumUrl: player.avatarMediumUrl ?? null,
      }));

    return NextResponse.json(
      {
        players,
        total: Number(payload.total ?? players.length),
        mode: modeParam,
        region: regionParam,
        leaderboardId,
        source: "AoE II Companion",
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error("Live tracker leaderboard request", error);
    return NextResponse.json(
      { error: "Não foi possível consultar o ranking agora. Tente novamente em instantes.", sourceStatus: "unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
