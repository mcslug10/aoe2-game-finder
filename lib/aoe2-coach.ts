const BASE_URL = "https://data.aoe2companion.com/api/";
const USER_AGENT = "AOE2-Game-Finder/1.0 (https://aoe2-game-finder.vercel.app)";

type CompanionProfile = {
  profileId?: number;
  name?: string;
  country?: string;
  games?: number;
};

type CompanionPlayer = {
  profileId?: number;
  name?: string;
  rating?: number;
  ratingDiff?: number;
  civ?: string;
  civName?: string;
  won?: boolean;
  country?: string;
};

type CompanionMatch = {
  matchId?: number;
  name?: string;
  started?: string;
  finished?: string;
  map?: string;
  mapName?: string;
  gameModeName?: string;
  leaderboardName?: string;
  teams?: Array<{ teamId?: number; players?: CompanionPlayer[] }>;
};

type CompanionAnalysisPlayer = {
  profileId?: number;
  name?: string;
  civilization?: string;
  eapm?: number;
  eapmPerMinute?: Record<string, number>;
  winner?: boolean;
  uptimes?: Array<{ timestamp: string; age: string }>;
  queuedUnits?: Array<{ timestamp: string; unit: string; amount?: number }>;
  queuedTechs?: Array<{ timestamp: string; unit: string }>;
  queuedBuildings?: Array<{ timestamp: string; unit: string }>;
  timeseries?: Array<{ timestamp: string; totalObjects: number; totalResources: number }>;
  resignation?: { timestamp: string };
};

type CompanionAnalysis = {
  error?: string;
  source?: "replay" | "upload";
  version?: string;
  duration?: string;
  map?: { name?: string };
  players?: CompanionAnalysisPlayer[];
};

function makeUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function companionGet(path: string, params: Record<string, string> = {}) {
  const url = makeUrl(path, params);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("AoE2 Companion network request failed", {
      host: url.host,
      path,
      cause: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Não foi possível conectar ao serviço de estatísticas do AoE II Companion. Tente novamente em instantes.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
    if (response.status === 404) throw new Error("A partida ou análise ainda não está disponível no serviço de estatísticas.");
    if (response.status === 429) throw new Error("O serviço de estatísticas está limitando as consultas. Aguarde um pouco e tente novamente.");
    throw new Error(body.message ?? body.error ?? `AoE II Companion respondeu HTTP ${response.status}.`);
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("O serviço de estatísticas retornou uma resposta inválida.");
  return data as Record<string, unknown>;
}

export async function searchCompanionProfiles(nickname: string) {
  const payload = await companionGet("profiles", { search: nickname, page: "1" });
  const rows = Array.isArray(payload.profiles) ? payload.profiles as CompanionProfile[] : [];
  const profiles = rows
    .filter((row) => Number.isSafeInteger(Number(row.profileId)) && Number(row.profileId) > 0 && typeof row.name === "string")
    .map((row) => ({
      profile_id: Number(row.profileId),
      alias: String(row.name),
      country: typeof row.country === "string" ? row.country : undefined,
      games: typeof row.games === "number" ? row.games : undefined,
    }));
  return { profiles };
}

export async function getCompanionRecentMatches(profileId: number) {
  const payload = await companionGet("matches", {
    profile_ids: String(profileId),
    use_enums: "true",
    page: "1",
  });
  const rows = Array.isArray(payload.matches) ? payload.matches as CompanionMatch[] : [];
  const matches = rows
    .filter((match) => Number.isSafeInteger(Number(match.matchId)))
    .map((match) => {
      const participants = (match.teams ?? []).flatMap((team) => (team.players ?? []).map((player) => ({
        profileId: Number(player.profileId ?? 0),
        nickname: String(player.name ?? "Jogador"),
        country: player.country ?? null,
        civilizationId: null,
        civilizationName: player.civName ?? player.civ ?? null,
        teamId: team.teamId ?? null,
        won: player.won === true,
      })));
      const selected = participants.find((player) => player.profileId === profileId);
      const started = match.started ? new Date(match.started) : null;
      const finished = match.finished ? new Date(match.finished) : null;
      const duration = started && finished && finished.getTime() > started.getTime()
        ? Math.floor((finished.getTime() - started.getTime()) / 1000)
        : null;
      const rawMap = String(match.mapName ?? match.map ?? "Mapa não identificado");
      const ratingDiff = (match.teams ?? []).flatMap((team) => team.players ?? [])
        .find((player) => Number(player.profileId) === profileId)?.ratingDiff;
      return {
        id: String(match.matchId),
        title: String(match.name ?? match.gameModeName ?? "Partida concluída"),
        map: rawMap,
        mapRaw: String(match.map ?? rawMap),
        gameTypeId: null,
        playerCount: participants.length,
        startedAt: started && !Number.isNaN(started.getTime()) ? started.toISOString() : null,
        completedAt: finished && !Number.isNaN(finished.getTime()) ? finished.toISOString() : null,
        durationSeconds: duration,
        result: selected?.won === true ? "win" as const : selected?.won === false ? "loss" as const : "unknown" as const,
        civilizationId: null,
        civilizationName: selected?.civilizationName ?? null,
        ratingBefore: null,
        ratingAfter: null,
        ratingChange: typeof ratingDiff === "number" ? ratingDiff : null,
        participants,
        includesPlayer: Boolean(selected),
      };
    })
    .filter((match) => match.includesPlayer)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return { matches: matches.slice(0, 20) };
}

function timestampToSeconds(value: string | undefined) {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length >= 3 && parts.every((part) => Number.isFinite(Number(part)))) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2].replace(",", "."));
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed / 1000;
}

function timeLabel(value: string | undefined) {
  const seconds = timestampToSeconds(value);
  if (seconds === null) return null;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
}

export async function getCompanionMatchAnalysis(matchId: number, profileId: number) {
  const payload = await companionGet(`matches/${matchId}/analysis`, { language: "en" }) as CompanionAnalysis;
  if (payload.error) throw new Error(payload.error);
  const selected = (payload.players ?? []).find((player) => Number(player.profileId) === profileId);
  if (!selected) throw new Error("A análise desta partida não contém o perfil selecionado. O replay pode estar indisponível ou não incluir esse participante.");

  const ageUps = (selected.uptimes ?? []).map((uptime) => ({
    age: String(uptime.age).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    timeSeconds: timestampToSeconds(uptime.timestamp),
    time: timeLabel(uptime.timestamp),
  })).sort((a, b) => (a.timeSeconds ?? 0) - (b.timeSeconds ?? 0));

  const timeline: Array<{ timeSeconds: number | null; time: string | null; type: string; detail: string | null }> = [];
  for (const unit of selected.queuedUnits ?? []) timeline.push({
    timeSeconds: timestampToSeconds(unit.timestamp), time: timeLabel(unit.timestamp), type: "Unidade na fila",
    detail: String(unit.unit) + (unit.amount && unit.amount > 1 ? ` ×${unit.amount}` : ""),
  });
  for (const tech of selected.queuedTechs ?? []) timeline.push({
    timeSeconds: timestampToSeconds(tech.timestamp), time: timeLabel(tech.timestamp), type: "Pesquisa", detail: String(tech.unit),
  });
  for (const building of selected.queuedBuildings ?? []) timeline.push({
    timeSeconds: timestampToSeconds(building.timestamp), time: timeLabel(building.timestamp), type: "Construção", detail: String(building.unit),
  });
  for (const age of ageUps) timeline.push({
    timeSeconds: age.timeSeconds, time: age.time, type: "Avanço de idade", detail: `Era ${age.age}`,
  });
  timeline.sort((a, b) => (a.timeSeconds ?? 0) - (b.timeSeconds ?? 0));

  const units = selected.queuedUnits ?? [];
  const villagers = units.filter((item) => item.unit.toLowerCase().includes("villager"));
  const military = units.filter((item) => !item.unit.toLowerCase().includes("villager"));
  const techs = selected.queuedTechs ?? [];
  const buildings = selected.queuedBuildings ?? [];
  const eapmPoints = Object.values(selected.eapmPerMinute ?? {});
  const averageEapm = eapmPoints.length
    ? Math.round(eapmPoints.reduce((sum, value) => sum + Number(value || 0), 0) / eapmPoints.length)
    : selected.eapm ?? null;

  const positives: Array<{ title: string; detail: string }> = [];
  const review: Array<{ title: string; detail: string }> = [];
  if (ageUps.length) positives.push({
    title: "Transições de idade identificadas",
    detail: ageUps.map((age) => `${age.age}: ${age.time ?? "tempo indisponível"}`).join(" · "),
  });
  if (villagers.length) positives.push({
    title: "Produção de aldeões observada",
    detail: `O replay registrou ${villagers.length} entradas de aldeões na fila de produção.`,
  });
  if (military.length) positives.push({
    title: "Produção militar observada",
    detail: `O replay registrou ${military.length} entradas de unidades não classificadas como aldeões.`,
  });
  if (techs.length) positives.push({
    title: "Pesquisas registradas",
    detail: `${techs.length} comandos de pesquisa aparecem na sequência da partida.`,
  });
  if (averageEapm !== null) positives.push({
    title: "eAPM calculado pelo parser",
    detail: `Média aproximada de ${averageEapm} ações efetivas por minuto nos intervalos retornados pelo serviço.`,
  });
  if (!ageUps.length) review.push({
    title: "Transições de idade não disponíveis",
    detail: "A análise não retornou os tempos de avanço de idade para este perfil.",
  });
  if (!villagers.length) review.push({
    title: "Fila de aldeões não identificada",
    detail: "Não foram retornadas entradas de aldeões na fila. Isso pode indicar uma limitação da análise e não prova, isoladamente, que a produção parou.",
  });
  review.push({
    title: "Compare a sequência com sua estratégia",
    detail: "A linha do tempo permite revisar a ordem de unidades, construções e pesquisas. Depois vamos comparar esses eventos com uma build order escolhida.",
  });

  const durationParts = String(payload.duration ?? "").split(":").map(Number);
  const durationSeconds = durationParts.length >= 3 && durationParts.every(Number.isFinite)
    ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
    : durationParts.length === 2 && durationParts.every(Number.isFinite)
      ? durationParts[0] * 60 + durationParts[1] : 0;

  return {
    fileName: `Match_${matchId}`, parser: "AoE II Companion",
    parserVersion: String(payload.version ?? "API"), map: payload.map?.name ?? null,
    gameType: null, completed: true, rated: null, durationSeconds,
    selectedPlayer: {
      number: 0, name: String(selected.name ?? "Jogador"), civilization: selected.civilization ?? null,
      winner: typeof selected.winner === "boolean" ? selected.winner : null,
      eapm: averageEapm, profileId, teamId: null,
    },
    metrics: {
      durationSeconds, actionCount: 0, apm: null, eapm: averageEapm,
      villagerQueueCommands: villagers.length, militaryQueueCommands: military.length,
      buildingCommands: buildings.length, researchCommands: techs.length,
    },
    ageUps, timeline: timeline.slice(0, 250), insights: { positives, review },
    limitations: [
      "eAPM é uma medida de atividade de comandos, não uma nota isolada de habilidade.",
      "As entradas de fila refletem comandos observados; não garantem, por si só, a quantidade final de unidades concluídas.",
      "A avaliação de aldeões ociosos no Centro da Cidade e a curva exata de recursos ainda exigem métricas adicionais e comparação com o estado do jogo.",
      "A nota global de habilidade será calculada somente após comparação com uma build order e um plano de jogo escolhidos.",
    ],
  };
}
