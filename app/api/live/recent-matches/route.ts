import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MatchPlayer = {
  profileId?: number;
  name?: string;
  country?: string;
  rating?: number;
  ratingDiff?: number;
  replay?: boolean;
  won?: boolean | null;
  civName?: string;
  civ?: string;
  team?: number;
};

type MatchTeam = {
  teamId?: number;
  players?: MatchPlayer[];
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
  teams?: MatchTeam[];
};

function playersFromMatch(match: CompanionMatch): MatchPlayer[] {
  if (Array.isArray(match.teams) && match.teams.length) {
    return match.teams.flatMap((team) =>
      (team.players ?? []).map((player) => ({
        ...player,
        team: typeof player.team === "number" ? player.team : team.teamId,
      })),
    );
  }
  return Array.isArray(match.players) ? match.players : [];
}

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

function resolvePlayerResults(players: MatchPlayer[]) {
  const teamResults = new Map<number, boolean>();
  const playersByTeam = new Map<number, MatchPlayer[]>();

  for (const player of players) {
    if (typeof player.team !== "number") continue;
    const team = playersByTeam.get(player.team) ?? [];
    team.push(player);
    playersByTeam.set(player.team, team);
  }

  // First trust the explicit outcome in the per-player match record.
  for (const [teamId, teamPlayers] of playersByTeam) {
    const explicit = [...new Set(
      teamPlayers
        .map((player) => player.won)
        .filter((won): won is boolean => typeof won === "boolean"),
    )];
    if (explicit.length === 1) teamResults.set(teamId, explicit[0]);
  }

  // Some summary records omit the outcome, but keep the signed rating change.
  // Use it only when every opposing team has a clear, opposite sign.
  if (playersByTeam.size >= 2) {
    const teamSigns = Array.from(playersByTeam.entries()).map(([teamId, teamPlayers]) => {
      const changes = teamPlayers
        .map((player) => Number(player.ratingDiff))
        .filter((value) => Number.isFinite(value) && value !== 0);
      const mean = changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : 0;
      return { teamId, sign: mean > 0 ? 1 : mean < 0 ? -1 : 0 };
    });
    const signs = new Set(teamSigns.map((item) => item.sign));
    if (teamSigns.every((item) => item.sign !== 0) && signs.has(1) && signs.has(-1)) {
      for (const item of teamSigns) {
        if (!teamResults.has(item.teamId)) teamResults.set(item.teamId, item.sign > 0);
      }
    }
  }

  // In a standard two-team match, if one team's result is explicit and the
  // opposing team's result is missing, the opposite outcome is unambiguous.
  if (playersByTeam.size === 2 && teamResults.size === 1) {
    const knownOutcome = [...teamResults.values()][0];
    for (const teamId of playersByTeam.keys()) {
      if (!teamResults.has(teamId)) teamResults.set(teamId, !knownOutcome);
    }
  }

  return players.map((player) => {
    if (typeof player.won === "boolean") return player;
    if (typeof player.team === "number" && teamResults.has(player.team)) {
      return { ...player, won: teamResults.get(player.team) };
    }
    if (typeof player.ratingDiff === "number" && player.ratingDiff !== 0 && playersByTeam.size <= 1) {
      return { ...player, won: player.ratingDiff > 0 };
    }
    return { ...player, won: null };
  });
}

async function fetchMatchDetails(matchId: number): Promise<CompanionMatch | null> {
  const url = new URL("https://data.aoe2companion.com/api/matches/" + matchId);
  url.searchParams.set("use_enums", "true");
  url.searchParams.set("language", "en");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AOE2-Game-Finder/1.0 (https://aoe2-game-finder.vercel.app)",
      },
      next: { revalidate: 45 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      console.warn("AoE2 Companion match detail unavailable", { matchId, status: response.status });
      return null;
    }
    return await response.json() as CompanionMatch;
  } catch (error) {
    console.warn("AoE2 Companion match detail request failed", { matchId, error });
    return null;
  }
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
    )).slice(0, 15000);

    if (!profileIds.length) {
      return NextResponse.json({ matches: [], checkedPlayers: 0, windowMinutes: 30 });
    }

    const profileChunks: number[][] = [];
    for (let index = 0; index < profileIds.length; index += 800) {
      profileChunks.push(profileIds.slice(index, index + 800));
    }

    const fetchedMatches: CompanionMatch[] = [];
    for (let start = 0; start < profileChunks.length; start += 2) {
      const batch = profileChunks.slice(start, start + 2);
      const payloads = await Promise.all(batch.map(async (profileChunk) => {
        const url = new URL("https://data.aoe2companion.com/api/matches");
        url.searchParams.set("profile_ids", profileChunk.join(","));
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
          throw new Error("O histórico de partidas do AoE II Companion está temporariamente indisponível.");
        }

        return await response.json() as { matches?: CompanionMatch[] };
      }));

      for (const payload of payloads) {
        fetchedMatches.push(...(Array.isArray(payload.matches) ? payload.matches : []));
      }
    }

    const monitored = new Set(profileIds);
    const cutoff = Date.now() - 30 * 60 * 1000;
    const now = Date.now();
    const uniqueFetchedMatches = Array.from(new Map(
      fetchedMatches.filter((match) => Number(match.matchId) > 0)
        .map((match) => [Number(match.matchId), match]),
    ).values());

    const candidates = uniqueFetchedMatches
      .map((match) => {
        const players = playersFromMatch(match);
        const finishedAt = match.finished ? new Date(String(match.finished)).getTime() : NaN;
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
      .slice(0, 60);

    const detailedMatches: Array<{ match: CompanionMatch; players: MatchPlayer[] }> = [];
    for (let start = 0; start < candidates.length; start += 5) {
      const batch = candidates.slice(start, start + 5);
      const details = await Promise.all(batch.map(({ match }) => fetchMatchDetails(Number(match.matchId))));
      batch.forEach((candidate, index) => {
        const detail = details[index];
        const source = detail && playersFromMatch(detail).length ? detail : candidate.match;
        const players = resolvePlayerResults(playersFromMatch(source));
        detailedMatches.push({
          match: { ...candidate.match, ...(detail ?? {}) },
          players,
        });
      });
    }

    const matches = detailedMatches.map(({ match, players }) => ({
      matchId: Number(match.matchId),
      started: match.started ? new Date(String(match.started)).toISOString() : null,
      finished: match.finished ? new Date(String(match.finished)).toISOString() : null,
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
        ratingDiff: typeof player.ratingDiff === "number" ? player.ratingDiff : null,
        replay: typeof player.replay === "boolean" ? player.replay : null,
        won: typeof player.won === "boolean" ? player.won : null,
        team: typeof player.team === "number" ? player.team : null,
        civName: player.civName ?? null,
        civ: player.civ ?? null,
      })),
    }));

    return NextResponse.json(
      { matches, checkedPlayers: profileIds.length, windowMinutes: 30, resultDetailsFetched: detailedMatches.length },
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
