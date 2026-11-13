const HOSTS = [
  "https://aoe-api.worldsedgelink.com",
  "https://aoe-api.reliclink.com",
];
const USER_AGENT = "AOE2-Game-Finder/1.0 (+https://aoe2-game-finder.vercel.app)";

export type AoEProfile = {
  profile_id: number;
  alias: string;
  name?: string;
  country?: string;
  level?: number;
};

export type AoEMatch = {
  id: number | string;
  description?: string;
  mapname?: string;
  matchtype_id?: number;
  maxplayers?: number;
  startgametime?: number;
  completiontime?: number;
  matchhistoryreportresults?: Array<{
    profile_id: number;
    resulttype?: number;
    teamid?: number;
    civilization_id?: number;
  }>;
  matchhistorymember?: Array<{
    profile_id: number;
    oldrating?: number;
    newrating?: number;
    wins?: number;
    losses?: number;
    streak?: number;
  }>;
};

async function requestJson(path: string, params: Record<string, string>) {
  let lastError: unknown = null;
  for (const host of HOSTS) {
    const url = new URL(path, host);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        next: { revalidate: 180 },
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 429) {
        throw new Error("O serviço de estatísticas está limitando as consultas. Aguarde alguns minutos e tente novamente.");
      }
      if (!response.ok) {
        lastError = new Error(`Serviço de estatísticas respondeu HTTP ${response.status}.`);
        continue;
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") {
        lastError = new Error("Resposta inválida do serviço de estatísticas.");
        continue;
      }
      const result = (payload as { result?: { code?: number; message?: string } }).result;
      if (result && typeof result.code === "number" && result.code !== 0) {
        throw new Error(result.message || "O serviço não encontrou os dados solicitados.");
      }
      return payload as Record<string, unknown>;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.includes("limitando")) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Não foi possível consultar o serviço de Age of Empires II.");
}

export async function resolveAoEProfile(alias: string) {
  const payload = await requestJson("/community/leaderboard/getPersonalStat", {
    title: "age2",
    aliases: JSON.stringify([alias]),
  });
  const profiles = Array.isArray(payload.profiles) ? payload.profiles as AoEProfile[] : [];
  const normalized = profiles
    .filter((profile) => Number.isInteger(Number(profile.profile_id)))
    .map((profile) => ({
      profile_id: Number(profile.profile_id),
      alias: String(profile.alias ?? alias),
      name: typeof profile.name === "string" ? profile.name : undefined,
      country: typeof profile.country === "string" ? profile.country : undefined,
      level: typeof profile.level === "number" ? profile.level : undefined,
    }));
  return { profiles: normalized };
}

export async function getAoERecentMatches(profileId: number) {
  const payload = await requestJson("/community/leaderboard/getRecentMatchHistory", {
    title: "age2",
    profile_ids: JSON.stringify([profileId]),
  });
  const matches = Array.isArray(payload.matchHistoryStats) ? payload.matchHistoryStats as AoEMatch[] : [];
  const profiles = Array.isArray(payload.profiles) ? payload.profiles as AoEProfile[] : [];
  const profileMap = new Map<number, AoEProfile>(profiles.map((profile): [number, AoEProfile] => [Number(profile.profile_id), profile]));

  const normalized = matches
    .filter((match) => match.completiontime && match.id !== undefined)
    .map((match) => {
      const report = (match.matchhistoryreportresults ?? []).find((row) => Number(row.profile_id) === profileId);
      const rating = (match.matchhistorymember ?? []).find((row) => Number(row.profile_id) === profileId);
      const participants = (match.matchhistoryreportresults ?? []).map((row) => {
        const profile = profileMap.get(Number(row.profile_id));
        return {
          profileId: Number(row.profile_id),
          nickname: profile?.alias ?? `Jogador ${row.profile_id}`,
          country: profile?.country ?? null,
          civilizationId: row.civilization_id ?? null,
          teamId: row.teamid ?? null,
          won: row.resulttype === 1,
        };
      });
      const start = Number(match.startgametime ?? 0);
      const completion = Number(match.completiontime ?? 0);
      const mapRaw = String(match.mapname ?? "Mapa não identificado");
      const mapName = mapRaw.replace(/\.(rms|scn)$/i, "").replace(/([a-z])([A-Z])/g, "$1 $2");
      return {
        id: String(match.id),
        title: String(match.description ?? "Partida concluída"),
        map: mapName,
        mapRaw,
        gameTypeId: match.matchtype_id ?? null,
        playerCount: participants.length,
        startedAt: start ? new Date(start * 1000).toISOString() : null,
        completedAt: completion ? new Date(completion * 1000).toISOString() : null,
        durationSeconds: start && completion && completion > start ? completion - start : null,
        result: report?.resulttype === 1 ? "win" : report?.resulttype === 0 ? "loss" : "unknown",
        civilizationId: report?.civilization_id ?? null,
        ratingBefore: rating?.oldrating ?? null,
        ratingAfter: rating?.newrating ?? null,
        ratingChange: typeof rating?.oldrating === "number" && typeof rating?.newrating === "number"
          ? rating.newrating - rating.oldrating
          : null,
        participants,
        includesPlayer: Boolean(report),
      };
    })
    .filter((match) => match.includesPlayer)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  return { matches: normalized.slice(0, 30) };
}
