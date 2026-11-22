import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MatchPlayer = {
  profileId?: number;
  name?: string;
  country?: string;
  rating?: number;
  replay?: boolean;
  won?: boolean;
  civName?: string;
  civ?: string;
  team?: number;
};

type CompanionMatch = {
  matchId?: number;
  started?: string | Date;
  finished?: string | Date;
  leaderboardId?: string;
  leaderboardName?: string;
  gameModeName?: string;
  gameMode?: string;
  mapName?: string;
  map?: string;
  players?: MatchPlayer[];
  teams?: Array<{ teamId?: number; players?: MatchPlayer[] }>;
};

function matchesMode(match: CompanionMatch, mode: "1v1" | "TG", players: MatchPlayer[]) {
  const label = [
    match.leaderboardId,
    match.leaderboardName,
    match.gameModeName,
    match.gameMode,
  ].filter(Boolean).join(" ").toLowerCase();

  if (mode === "1v1") {
    if (/rm_1v1|1v1|one.?vs.?one/.test(label)) return true;
    if (/rm_team|team|2v2|3v3|4v4/.test(label)) return false;
    return players.length === 2;
  }

  if (/rm_team|team|2v2|3v3|4v4/.test(label)) return true;
  if (/rm_1v1|1v1|one.?vs.?one/.test(label)) return false;
  return players.length > 2;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { profileIds?: unknown; mode?: unknown };
    const mode = body.mode === "TG" ? "TG" : body.mode === "1v1" ? "1v1" : null;
    if (!mode) {
      return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });
    }

    const profileIds = Array.from(new Set(
      (Array.isArray(body.profileIds) ? body.profileIds : [])
        .map((value) => Number(value))
        .filter((value) => Number.isSafeInteger(value) && value > 0),
    )).slice(0, 800);

    if (!profileIds.length) return NextResponse.json({ matches: [] });

    const url = new URL("https://data.aoe2companion.com/api/matches");
    url.searchParams.set("profile_ids", profileIds.join(","));
    url.searchParams.set("leaderboard_ids", mode === "1v1" ? "rm_1v1" : "rm_team");
    url.searchParams.set("use_enums", "true");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("language", "en");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AOE2-Game-Finder/1.0 (https://aoe2-game-finder.vercel.app)",
      },
      next: { revalidate: 45 },
      signal: AbortSignal.timeout(18_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("AoE2 Companion recent matches", { status: response.status, detail: detail.slice(0, 250) });
      return NextResponse.json(
        { error: "O histórico de partidas do AoE II Companion está temporariamente indisponível." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const payload = await response.json() as { matches?: CompanionMatch[] };
    const monitored = new Set(profileIds);
    const cutoff = Date.now() - 30 * 60 * 1000;
    const now = Date.now();

    const matches = (Array.isArray(payload.matches) ? payload.matches : [])
      .filter((match) => Number.isSafeInteger(Number(match.matchId)) && Number(match.matchId) > 0)
      .map((match) => {
        const players = Array.isArray(match.players)
          ? match.players
          : (match.teams ?? []).flatMap((team) => team.players ?? []);
        const finishedAt = match.finished ? new Date(match.finished).getTime() : NaN;
        return { match, players, finishedAt };
      })
      .filter(({ match, players, finishedAt }) =>
        Number.isFinite(finishedAt) &&
        finishedAt >= cutoff &&
        finishedAt <= now + 60_000 &&
        players.some((player) => monitored.has(Number(player.profileId))) &&
        matchesMode(match, mode, players),
      )
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, 60)
      .map(({ match, players }) => ({
        matchId: Number(match.matchId),
        started: match.started ? new Date(match.started).toISOString() : null,
        finished: match.finished ? new Date(match.finished).toISOString() : null,
        leaderboardId: match.leaderboardId ?? null,
        leaderboardName: match.leaderboardName ?? null,
        gameModeName: match.gameModeName ?? null,
        gameMode: match.gameMode ?? null,
        mapName: match.mapName ?? match.map ?? null,
        players: players.map((player) => ({
          profileId: Number(player.profileId),
          name: String(player.name ?? "Jogador"),
          country: String(player.country ?? "").toUpperCase(),
          rating: typeof player.rating === "number" ? player.rating : null,
          replay: typeof player.replay === "boolean" ? player.replay : null,
          won: typeof player.won === "boolean" ? player.won : null,
          civName: player.civName ?? null,
          civ: player.civ ?? null,
          team: typeof player.team === "number" ? player.team : null,
        })),
      }));

    return NextResponse.json(
      { matches, checkedPlayers: profileIds.length, windowMinutes: 30 },
      { headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("Live tracker recent matches request", error);
    return NextResponse.json(
      { error: error instanceof Error && error.name === "TimeoutError"
        ? "A consulta do histórico demorou mais que o esperado. Tente novamente."
        : "Não foi possível carregar as partidas encerradas agora." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
