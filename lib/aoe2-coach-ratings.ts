import { companionGet } from "@/lib/aoe2-coach";

export type RatingHistoryPoint = {
  date: string;
  rating: number;
  ratingDiff: number | null;
  games: number | null;
};

export type RatingHistorySeries = {
  leaderboardId: number;
  leaderboardName: string;
  points: RatingHistoryPoint[];
  currentRating: number | null;
  bestRating: number | null;
  ratingChange: number | null;
};

export type RatingHistory = {
  oneVsOne: RatingHistorySeries;
  teamGames: RatingHistorySeries;
  updatedAt: string;
};

type CompanionRatingPoint = {
  leaderboardId?: number;
  profileId?: number;
  games?: number;
  rating?: number;
  ratingDiff?: number;
  date?: string | number | Date;
};
type CompanionRatingGroup = {
  leaderboardId?: string | number;
  leaderboardName?: string;
  abbreviation?: string;
  ratings?: CompanionRatingPoint[];
};

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeRatingPoint(point: CompanionRatingPoint): RatingHistoryPoint | null {
  const rating = Number(point.rating);
  if (!Number.isFinite(rating) || rating <= 0 || point.date === undefined || point.date === null) return null;
  let date: Date;
  if (point.date instanceof Date) date = point.date;
  else if (typeof point.date === "number") date = new Date(point.date < 10_000_000_000 ? point.date * 1000 : point.date);
  else date = new Date(point.date);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: date.toISOString(),
    rating: Math.round(rating),
    ratingDiff: typeof point.ratingDiff === "number" && Number.isFinite(point.ratingDiff) ? point.ratingDiff : null,
    games: typeof point.games === "number" ? point.games : null,
  };
}

function makeRatingSeries(
  groups: CompanionRatingGroup[],
  leaderboardId: number,
  fallbackName: string,
  fallbackNames: string[],
): RatingHistorySeries {
  const group = groups.find((item) => {
    const id = Number(item.leaderboardId);
    const name = normalizeText(item.leaderboardName ?? item.abbreviation ?? "");
    return id === leaderboardId || fallbackNames.some((term) => name.includes(term));
  });
  const points = (group?.ratings ?? [])
    .map(normalizeRatingPoint)
    .filter((point): point is RatingHistoryPoint => point !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-100);
  const values = points.map((point) => point.rating);
  return {
    leaderboardId,
    leaderboardName: group?.leaderboardName ?? fallbackName,
    points,
    currentRating: points.length ? points[points.length - 1].rating : null,
    bestRating: values.length ? Math.max(...values) : null,
    ratingChange: points.length >= 2 ? points[points.length - 1].rating - points[0].rating : null,
  };
}

export async function getCompanionRatingHistory(profileId: number): Promise<RatingHistory> {
  const payload = await companionGet(`profiles/${profileId}/ratings`, { language: "en" });
  const groups = Array.isArray(payload.ratings) ? payload.ratings as CompanionRatingGroup[] : [];
  const oneVsOne = makeRatingSeries(groups, 3, "1v1 Random Map", ["1v1 rm", "rm 1v1", "1v1 random map", "random map 1v1"]);
  const teamGames = makeRatingSeries(groups, 4, "Team Random Map", ["team rm", "rm team", "team random map", "random map team"]);
  return { oneVsOne, teamGames, updatedAt: new Date().toISOString() };
}
