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

type CompanionLeaderboardPayload = {
  players?: CompanionPlayer[];
  total?: number;
  page?: number;
  perPage?: number;
};

const LEADERBOARDS = {
  "1v1": "rm_1v1",
  TG: "rm_team",
} as const;

const TRACKED_TG_BRAZIL_MIN_RATING = 1200;
const TRACKED_TG_WORLD_MIN_RATING = 1300;
const BRAZIL_800_PLUS_MIN_RATING = 800;
const BRAZIL_800_PLUS_MAX_RATING = 1400;
const TRACKER_PAGE_SIZE = 100;
const TRACKER_FETCH_CONCURRENCY = 4;

function normalizeDate(value?: string | Date) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePlayer(player: CompanionPlayer) {
  return {
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
    lastMatchTime: normalizeDate(player.lastMatchTime),
    avatarSmallUrl: player.avatarSmallUrl ?? null,
    avatarMediumUrl: player.avatarMediumUrl ?? null,
  };
}

function validPlayers(players?: CompanionPlayer[]) {
  return (Array.isArray(players) ? players : [])
    .filter((player) => Number.isSafeInteger(Number(player.profileId)) && Number(player.profileId) > 0);
}

async function fetchLeaderboardPage(
  leaderboardId: string,
  region: "WORLD" | "BR" | "BR_800_1400",
  page: number,
  perPage: number,
): Promise<CompanionLeaderboardPayload> {
  const url = new URL("https://data.aoe2companion.com/api/leaderboards/" + leaderboardId);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("language", "en");
  if (region !== "WORLD") url.searchParams.set("country", "BR");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AOE2-Game-Finder/1.0 (https://aoe2-game-finder.vercel.app)",
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("AoE2 Companion leaderboard network error", { page, error });
    throw new Error("Não foi possível conectar ao ranking do AoE II Companion.");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("AoE2 Companion leaderboard", { page, status: response.status, detail: detail.slice(0, 300) });
    throw new Error("O ranking do AoE II Companion está temporariamente indisponível.");
  }

  return await response.json() as CompanionLeaderboardPayload;
}

async function fetchPlayersInRatingRange(
  firstPage: CompanionLeaderboardPayload,
  leaderboardId: string,
  region: "WORLD" | "BR" | "BR_800_1400",
  minimumRating: number,
  maximumRating?: number,
) {
  const total = Math.max(0, Number(firstPage.total ?? validPlayers(firstPage.players).length));
  const perPage = Math.max(1, Number(firstPage.perPage ?? TRACKER_PAGE_SIZE));
  const pageCount = Math.ceil(total / perPage);
  const rawPlayers: CompanionPlayer[] = [...validPlayers(firstPage.players)];

  // Companion leaderboards are sorted from highest to lowest current rating.
  // Read pages in small parallel batches and stop once the lower ELO boundary is crossed.
  for (let batchStart = 2; batchStart <= pageCount; batchStart += TRACKER_FETCH_CONCURRENCY) {
    const pageNumbers = Array.from(
      { length: Math.min(TRACKER_FETCH_CONCURRENCY, pageCount - batchStart + 1) },
      (_, index) => batchStart + index,
    );
    const pages = await Promise.all(
      pageNumbers.map((page) => fetchLeaderboardPage(leaderboardId, region, page, perPage)),
    );

    let minimumReached = false;
    for (const payload of pages) {
      const pagePlayers = validPlayers(payload.players);
      rawPlayers.push(...pagePlayers);
      if (pagePlayers.some((player) => Number(player.rating ?? 0) < minimumRating)) {
        minimumReached = true;
      }
    }
    if (minimumReached) break;
  }

  const distinct = new Map<number, ReturnType<typeof normalizePlayer>>();
  for (const player of rawPlayers) {
    const normalized = normalizePlayer(player);
    if (normalized.rating < minimumRating) continue;
    if (typeof maximumRating === "number" && normalized.rating > maximumRating) continue;
    if (region !== "WORLD" && normalized.country && normalized.country !== "BR") continue;
    distinct.set(normalized.profileId, normalized);
  }

  return Array.from(distinct.values()).sort((a, b) =>
    (a.rank || Number.MAX_SAFE_INTEGER) - (b.rank || Number.MAX_SAFE_INTEGER) || b.rating - a.rating,
  );
}

export async function GET(request: NextRequest) {
  const modeParam = request.nextUrl.searchParams.get("mode") ?? "1v1";
  const regionParam = request.nextUrl.searchParams.get("region") ?? "WORLD";

  if (modeParam !== "1v1" && modeParam !== "TG") {
    return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });
  }
  if (regionParam !== "WORLD" && regionParam !== "BR" && regionParam !== "BR_800_1400") {
    return NextResponse.json({ error: "Região inválida." }, { status: 400 });
  }

  const leaderboardId = LEADERBOARDS[modeParam];

  try {
    const firstPage = await fetchLeaderboardPage(
      leaderboardId,
      regionParam,
      1,
      TRACKER_PAGE_SIZE,
    );
    const leaderboardPlayers = validPlayers(firstPage.players).map(normalizePlayer);
    const leaderboardTotal = Number(firstPage.total ?? leaderboardPlayers.length);

    const brazilRatingBand = regionParam === "BR_800_1400";
    const expandedTeamMode = modeParam === "TG";
    const trackingMinRating = brazilRatingBand
      ? BRAZIL_800_PLUS_MIN_RATING
      : regionParam === "BR"
        ? TRACKED_TG_BRAZIL_MIN_RATING
        : TRACKED_TG_WORLD_MIN_RATING;
    const trackingMaxRating = brazilRatingBand ? BRAZIL_800_PLUS_MAX_RATING : null;
    const needsExpandedPlayers = expandedTeamMode || brazilRatingBand;
    const trackedPlayers = needsExpandedPlayers
      ? await fetchPlayersInRatingRange(
          firstPage,
          leaderboardId,
          regionParam,
          trackingMinRating,
          trackingMaxRating ?? undefined,
        )
      : [];

    // Brasil 800+ lists the best 100 players inside the ELO band, while all eligible
    // profiles stay in the watchlist for queueing, live matches and recent history.
    const players = brazilRatingBand ? trackedPlayers.slice(0, 100) : leaderboardPlayers;
    const total = brazilRatingBand ? trackedPlayers.length : leaderboardTotal;

    return NextResponse.json(
      {
        players,
        total,
        trackedPlayers,
        trackedPlayersTotal: trackedPlayers.length,
        trackingMinRating: needsExpandedPlayers ? trackingMinRating : null,
        trackingMaxRating,
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
      { error: error instanceof Error ? error.message : "Não foi possível consultar o ranking agora.", sourceStatus: "unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
