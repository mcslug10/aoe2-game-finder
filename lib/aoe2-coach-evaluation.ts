type QueueItem = { timestamp: string; unit: string; amount?: number };
type AgeItem = { timestamp: string; age: string };
type PlayerAnalysis = {
  profileId?: number;
  name?: string;
  civilization?: string;
  eapm?: number;
  eapmPerMinute?: Record<string, number>;
  winner?: boolean;
  uptimes?: AgeItem[];
  queuedUnits?: QueueItem[];
  queuedTechs?: QueueItem[];
  queuedBuildings?: QueueItem[];
  queuedWalls?: Array<{ timestamp: string }>;
};
type MatchTeam = { teamId?: number; players?: Array<{ profileId?: number }> };
type MatchContext = {
  map?: string;
  gameModeName?: string;
  speedName?: string;
  speedFactor?: number;
  leaderboardName?: string;
  teams?: MatchTeam[];
};

export type EvaluationCategory = {
  id: string;
  title: string;
  score: number | null;
  max: number;
  reason: string;
  status: "scored" | "not_applicable" | "insufficient_data";
};
export type CoachingTip = {
  severity: "high" | "medium" | "positive";
  time: string | null;
  title: string;
  detail: string;
  action: string;
};
export type MatchEvaluation = {
  overallScore: number | null;
  overallLabel: string;
  confidence: "high" | "medium" | "low";
  coverage: number;
  strategy: {
    name: string;
    confidence: "high" | "medium" | "low";
    reason: string;
    evidence: string[];
    alternatives: string[];
  };
  categories: EvaluationCategory[];
  reaction: {
    opponentUnit: string | null;
    opponentTime: string | null;
    responseUnit: string | null;
    responseTime: string | null;
    delaySeconds: number | null;
    score: number | null;
    summary: string;
  };
  strengths: string[];
  tips: CoachingTip[];
  benchmark: {
    applicable: boolean;
    note: string;
    feudalTime: string | null;
    targetFeudalTime: string | null;
  };
};

function norm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function seconds(value: string | undefined) {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length >= 3 && parts.every((part) => Number.isFinite(Number(part)))) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2].replace(",", "."));
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed / 1000;
}
function clock(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  const total = Math.max(0, Math.floor(value));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
function quantity(item: QueueItem) {
  return Math.max(1, Number(item.amount ?? 1) || 1);
}
function hasName(events: Array<{ unit: string }>, names: string[]) {
  return events.some((event) => names.some((name) => norm(event.unit).includes(name)));
}
function countNames(events: QueueItem[], names: string[]) {
  return events.reduce((sum, event) => sum + (names.some((name) => norm(event.unit).includes(name)) ? quantity(event) : 0), 0);
}
function eventAge(time: number, feudal: number | null, castle: number | null, imperial: number | null) {
  if (feudal !== null && time < feudal) return "dark";
  if (feudal !== null && time >= feudal && (castle === null || time < castle)) return "feudal";
  if (castle !== null && time >= castle && (imperial === null || time < imperial)) return "castle";
  if (imperial !== null && time >= imperial) return "imperial";
  return "unknown";
}
function includesAny(value: string, terms: string[]) {
  const n = norm(value);
  return terms.some((term) => n.includes(term));
}
function category(
  id: string, title: string, score: number | null, max: number, reason: string,
  status: EvaluationCategory["status"] = score === null ? "insufficient_data" : "scored",
): EvaluationCategory {
  return { id, title, score, max, reason, status };
}
function confidenceFromStrength(strength: number): "high" | "medium" | "low" {
  if (strength >= 3) return "high";
  if (strength === 2) return "medium";
  return "low";
}

export function evaluateAoE2Match(
  selected: PlayerAnalysis,
  allPlayers: PlayerAnalysis[],
  match: MatchContext,
): MatchEvaluation {
  const ownUnits = (selected.queuedUnits ?? []).map((item) => ({ ...item, at: seconds(item.timestamp) }))
    .filter((item): item is QueueItem & { at: number } => item.at !== null)
    .sort((a, b) => a.at - b.at);
  const ownBuildings = (selected.queuedBuildings ?? []).map((item) => ({ ...item, at: seconds(item.timestamp) }))
    .filter((item): item is { timestamp: string; unit: string; at: number } => item.at !== null)
    .sort((a, b) => a.at - b.at);
  const ownTechs = (selected.queuedTechs ?? []).map((item) => ({ ...item, at: seconds(item.timestamp) }))
    .filter((item): item is { timestamp: string; unit: string; at: number } => item.at !== null)
    .sort((a, b) => a.at - b.at);
  const ageTimes = (selected.uptimes ?? []).map((item) => ({ age: norm(item.age), at: seconds(item.timestamp) }))
    .filter((item): item is { age: string; at: number } => item.at !== null)
    .sort((a, b) => a.at - b.at);
  const ageTime = (needle: string) => ageTimes.find((item) => item.age.includes(needle))?.at ?? null;
  const feudal = ageTime("feudal");
  const castle = ageTime("castle");
  const imperial = ageTime("imperial");
  const unitsByAge = (age: string) => ownUnits.filter((item) => eventAge(item.at, feudal, castle, imperial) === age);
  const buildingsByAge = (age: string) => ownBuildings.filter((item) => eventAge(item.at, feudal, castle, imperial) === age);
  const darkUnits = unitsByAge("dark");
  const feudalUnits = unitsByAge("feudal");
  const castleUnits = unitsByAge("castle");
  const feudalBuildings = buildingsByAge("feudal");
  const castleBuildings = buildingsByAge("castle");
  const darkMilitia = countNames(darkUnits, ["militia"]);
  const feudalArchers = countNames(feudalUnits, ["archer", "crossbow"]);
  const feudalMaa = countNames(feudalUnits, ["militia", "man at arms"]);
  const feudalScouts = countNames(feudalUnits, ["scout cavalry", "light cavalry"]);
  const feudalSkirms = countNames(feudalUnits, ["skirmisher"]);
  const feudalSpears = countNames(feudalUnits, ["spearman", "pikeman"]);
  const feudalSerjeants = countNames(feudalUnits, ["serjeant"]);
  const feudalTowers = feudalBuildings.filter((item) => includesAny(item.unit, ["watch tower", "guard tower", "keep"])).length;
  const hasRange = hasName(feudalBuildings, ["archery range"]);
  const hasStable = hasName(feudalBuildings, ["stable"]);
  const hasSiegeWorkshop = hasName(feudalBuildings, ["siege workshop"]);
  const hasMonastery = hasName(feudalBuildings, ["monastery"]);
  const hasDonjon = hasName(feudalBuildings, ["donjon"]);
  const hasCastleTC = hasName(castleBuildings, ["town center"]);
  const castleElephants = countNames(castleUnits, ["battle elephant"]);
  const castleScorpions = countNames(castleUnits, ["scorpion"]);
  const castleRams = countNames(castleUnits, ["battering ram", "capped ram", "siege ram"]);
  const feudalArmy = feudalArchers + feudalMaa + feudalScouts;
  const fastCastle = feudal !== null && castle !== null && castle - feudal < 9 * 60 && feudalArmy < 4;
  const civ = norm(selected.civilization ?? "");
  const evidence: string[] = [];
  let strategy = "Estratégia não identificada";
  let strategyStrength = 0;
  let strategyReason = "Os eventos não formaram um padrão suficientemente claro para classificar a abertura.";
  let strategyScore: number | null = null;

  // Opening rules are adapted from the public MIT-licensed aoe2-openings project.
  if (civ.includes("sicilian") && (hasDonjon || feudalSerjeants >= 2)) {
    strategy = "Serjeant Rush"; strategyStrength = 3; evidence.push("Sicilianos com Donjon ou 2+ Serjeants na Era Feudal.");
  } else if (["khmer", "burmese", "malay", "vietnamese"].some((name) => civ.includes(name)) && castleElephants >= 4) {
    strategy = "Elephant Rush"; strategyStrength = 3; evidence.push("4+ Battle Elephants enfileirados na Era dos Castelos.");
  } else if (civ.includes("cuman") && feudalBuildings.filter((item) => norm(item.unit).includes("town center")).length) {
    strategy = "2TC Feudal Boom"; strategyStrength = 3; evidence.push("Segundo Centro da Cidade construído ainda na Era Feudal.");
  } else if (civ.includes("roman") && castleScorpions >= 2 && castleRams >= 1) {
    strategy = "Scorpions & Rams"; strategyStrength = 3; evidence.push("2+ Scorpions e um aríete na Era dos Castelos.");
  } else if (hasSiegeWorkshop) {
    strategy = "Hoang Rush / pressão de cerco"; strategyStrength = 2; evidence.push("Oficina de Cerco construída na Era Feudal.");
  } else if (feudalTowers >= 3) {
    strategy = "Tower Rush"; strategyStrength = 3; evidence.push(`${feudalTowers} torres construídas na Era Feudal.`);
  } else if (darkMilitia >= 3 && fastCastle) {
    strategy = "Drush Fast Castle"; strategyStrength = 3; evidence.push(`${darkMilitia} Militia na Era Sombria e avanço rápido aos Castelos.`);
  } else if (darkMilitia >= 3 && feudalArchers >= 3) {
    strategy = "Drush Archers"; strategyStrength = 3; evidence.push(`${darkMilitia} Militia na Era Sombria, seguidos de ${feudalArchers} arqueiros na Feudal.`);
  } else if (darkMilitia >= 3 && feudalMaa >= 2) {
    strategy = "Drush Men-at-Arms"; strategyStrength = 3; evidence.push(`${darkMilitia} Militia na Era Sombria e ${feudalMaa} unidades da linha Militia na Feudal.`);
  } else if (darkMilitia >= 3) {
    strategy = "Drush"; strategyStrength = 3; evidence.push(`${darkMilitia} Militia enfileirados antes da Era Feudal.`);
  } else if (feudalMaa >= 2 && feudalArchers >= 3) {
    strategy = "Men-at-Arms → Archers"; strategyStrength = 3; evidence.push(`${feudalMaa} unidades da linha Militia e ${feudalArchers} arqueiros na Feudal.`);
  } else if (feudalMaa >= 4) {
    strategy = "Men-at-Arms Rush"; strategyStrength = 3; evidence.push(`${feudalMaa} unidades da linha Militia enfileiradas na Feudal.`);
  } else if (feudalArchers >= 4) {
    strategy = "Archer Rush"; strategyStrength = 3; evidence.push(`${feudalArchers} arqueiros/Crossbowmen enfileirados na Feudal.`);
  } else if (feudalScouts >= 3 && hasStable) {
    strategy = "Scout Rush"; strategyStrength = 3; evidence.push(`${feudalScouts} Scouts/Light Cavalry e Stable na Feudal.`);
  } else if (feudalMaa >= 2 && feudalScouts >= 2) {
    strategy = "Men-at-Arms + Scouts"; strategyStrength = 3; evidence.push("Men-at-Arms e Scouts combinados na Era Feudal.");
  } else if (feudalSkirms >= 2 && feudalSpears >= 2) {
    strategy = "Pike + Skirm"; strategyStrength = 3; evidence.push("Composição defensiva de Spearmen e Skirmishers na Feudal.");
  } else if (fastCastle && hasCastleTC) {
    strategy = "Fast Castle → Boom"; strategyStrength = 3; evidence.push("Transição Feudal–Castelos em menos de 9 minutos e novo Centro da Cidade nos Castelos.");
  } else if (fastCastle) {
    strategy = "Fast Castle"; strategyStrength = 3; evidence.push("Transição Feudal–Castelos em menos de 9 minutos com exército Feudal reduzido.");
  } else if (hasMonastery && feudalArchers < 2 && feudalMaa < 2 && feudalScouts < 2) {
    strategy = "Monk / Relic Opening"; strategyStrength = 2; evidence.push("Monastery cedo e pouca produção militar Feudal.");
  } else if (feudalArchers >= 2 && hasRange) {
    strategy = "Archer Opening"; strategyStrength = 2; evidence.push("Archery Range e pelo menos 2 arqueiros na Feudal.");
  } else if (feudalScouts >= 2 && hasStable) {
    strategy = "Scout Opening"; strategyStrength = 2; evidence.push("Stable e pelo menos 2 Scouts na Feudal.");
  } else if (feudalMaa >= 2) {
    strategy = "Men-at-Arms Opening"; strategyStrength = 2; evidence.push("Pelo menos 2 unidades da linha Militia na Feudal.");
  } else if (hasRange && !hasStable) {
    strategy = "Archer Opening (building signal)"; strategyStrength = 1; evidence.push("Archery Range na Feudal, sem Stable detectado.");
  } else if (hasStable && !hasRange) {
    strategy = "Scout Opening (building signal)"; strategyStrength = 1; evidence.push("Stable na Feudal, sem Archery Range detectado.");
  } else if (hasStable && hasRange) {
    strategy = "Scouts into Archers"; strategyStrength = 1; evidence.push("Stable e Archery Range construídos na Feudal.");
  }

  if (strategyStrength >= 3) {
    strategyScore = 23;
    strategyReason = "A abertura foi classificada por sinais concretos de unidade e/ou construção, e não apenas pelo resultado da partida.";
  } else if (strategyStrength === 2) {
    strategyScore = 18;
    strategyReason = "Há sinais de composição e construções compatíveis, mas a quantidade de unidades ainda deixa margem para outra leitura.";
  } else if (strategyStrength === 1) {
    strategyScore = 13;
    strategyReason = "A classificação depende principalmente das construções; não há unidades suficientes para confirmar a abertura.";
  }
  if (feudal !== null) evidence.push(`Feudal iniciada em ${clock(feudal)} no tempo bruto do replay.`);
  if (castle !== null) evidence.push(`Castelos iniciada em ${clock(castle)} no tempo bruto do replay.`);

  const alternatives: string[] = [];
  if (strategy.includes("Archer") && hasStable) alternatives.push("Pode ser uma transição Scouts → Archers.");
  if (strategy.includes("Scout") && hasRange) alternatives.push("Pode ser uma transição Scouts → Archers.");
  if (strategy === "Fast Castle" && hasCastleTC) alternatives.push("Pode ser Fast Castle → Boom.");
  if (strategy === "Men-at-Arms Rush" && hasRange) alternatives.push("Pode ser Men-at-Arms → Archers, caso arqueiros tenham sido enfileirados depois.");

  const ownTechNames = ownTechs.map((item) => norm(item.unit));
  const hasTech = (...names: string[]) => ownTechNames.some((tech) => names.some((name) => tech.includes(name)));
  const militaryCount = ownUnits.filter((item) => !includesAny(item.unit, ["villager", "trade cart", "fishing ship", "transport ship", "cow", "sheep"])).length;
  const productionBuildings = ownBuildings.filter((item) => includesAny(item.unit, ["barracks", "archery range", "stable", "siege workshop", "castle"])).length;
  let militaryScore: number | null = null;
  let militaryReason = "Não há eventos suficientes de produção militar para avaliar a coerência da composição.";
  if (militaryCount >= 2 && productionBuildings > 0) {
    militaryScore = 10;
    if (strategy.includes("Archer") && hasTech("fletching", "bodkin arrow", "bracer")) militaryScore += 5;
    else if ((strategy.includes("Scout") || strategy.includes("Elephant")) && hasTech("bloodlines", "forging", "scale barding", "chain barding")) militaryScore += 5;
    else if (strategy.includes("Men-at-Arms") && hasTech("forging", "scale mail", "squires")) militaryScore += 5;
    else if (strategy.includes("Fast Castle") && (hasTech("knight", "crossbow", "redemption", "sanctity") || castleUnits.length > 0)) militaryScore += 5;
    else if (strategy === "Tower Rush" && feudalTowers >= 3) militaryScore += 5;
    militaryReason = `${militaryCount} ordens de produção militar e ${productionBuildings} construções militares foram identificadas. ${militaryScore > 10 ? "Também há pesquisa/tecnologia que apoia o plano observado." : "Não foi detectada uma melhoria militar claramente associada à abertura."}`;
  }

  const villagerEvents = ownUnits.filter((item) => includesAny(item.unit, ["villager"])).sort((a, b) => a.at - b.at);
  const earlyGameSeconds = 15 * 60 / Math.max(1, match.speedFactor ?? 1.7);
  const earlyVillagers = villagerEvents.filter((item) => item.at <= earlyGameSeconds);
  const villagerGaps: Array<{ from: number; to: number; gap: number }> = [];
  for (let i = 1; i < earlyVillagers.length; i++) {
    const previous = earlyVillagers[i - 1];
    const expectedQueueEnd = previous.at + quantity(previous) * 25;
    const gap = earlyVillagers[i].at - expectedQueueEnd;
    if (gap > 45) villagerGaps.push({ from: expectedQueueEnd, to: earlyVillagers[i].at, gap });
  }
  const economyScore = earlyVillagers.length >= 5
    ? Math.max(0, Math.min(20, 20 - villagerGaps.reduce((sum, gap) => sum + Math.min(6, 2 + Math.floor(gap.gap / 60)), 0)))
    : null;
  const economyReason = earlyVillagers.length >= 5
    ? villagerGaps.length
      ? `${earlyVillagers.length} entradas de aldeões encontradas antes dos 18 minutos do replay; ${villagerGaps.length} possível(is) intervalo(s) após o tempo estimado da fila. Isso é um indício, não uma medição exata de TC idle.`
      : `${earlyVillagers.length} entradas de aldeões encontradas antes dos 18 minutos do replay, sem grandes lacunas aparentes entre comandos.`
    : "Poucos comandos de aldeões foram retornados para estimar a regularidade da produção.";

  const selectedProfileId = Number(selected.profileId ?? 0);
  let selectedTeam: number | null = null;
  let opponentIds: number[] = [];
  for (const team of match.teams ?? []) {
    const memberIds = (team.players ?? []).map((player) => Number(player.profileId));
    if (memberIds.includes(selectedProfileId)) selectedTeam = team.teamId ?? null;
  }
  if (selectedTeam !== null) {
    opponentIds = (match.teams ?? [])
      .filter((team) => team.teamId !== selectedTeam)
      .flatMap((team) => (team.players ?? []).map((player) => Number(player.profileId)));
  }
  const enemyProfiles = allPlayers.filter((player) => opponentIds.includes(Number(player.profileId)));
  const pressureUnits = ["scout cavalry", "light cavalry", "archer", "crossbow", "man at arms", "militia", "knight", "cavalier", "paladin", "camel", "eagle warrior", "ram", "mangonel", "scorpion", "longbowman"];
  const enemyEvents = enemyProfiles.flatMap((player) => (player.queuedUnits ?? []).map((item) => ({
    ...item, at: seconds(item.timestamp), owner: player.name ?? "Adversário",
  }))).filter((item): item is QueueItem & { at: number; owner: string } =>
    item.at !== null && item.at < 30 * 60 && includesAny(item.unit, pressureUnits)
  ).sort((a, b) => a.at - b.at);
  const threat = enemyEvents[0] ?? null;
  let response: { unit: string; at: number } | null = null;
  let reactionScore: number | null = null;
  let reactionSummary = "Não foi possível identificar uma pressão militar adversária com os dados retornados.";
  if (threat) {
    const enemyClass = includesAny(threat.unit, ["archer", "crossbow", "skirmisher", "longbow"]) ? "ranged"
      : includesAny(threat.unit, ["scout", "light cavalry", "knight", "cavalier", "paladin", "camel"]) ? "cavalry"
      : includesAny(threat.unit, ["ram", "mangonel", "scorpion"]) ? "siege" : "infantry";
    const counters = enemyClass === "ranged"
      ? ["skirmisher", "mangonel", "siege"]
      : enemyClass === "cavalry"
        ? ["spearman", "pikeman", "monk", "camel"]
        : enemyClass === "siege"
          ? ["knight", "cavalier", "scout cavalry", "light cavalry", "monk"]
          : ["archer", "crossbow", "scorpion", "knight"];
    const ownCounterEvents = ownUnits.filter((item) => includesAny(item.unit, counters) && item.at >= threat.at - 30 && item.at <= threat.at + 7 * 60);
    const ownWallEvents = (selected.queuedWalls ?? [])
      .map((item) => ({ at: seconds(item.timestamp) }))
      .filter((item): item is { at: number } => item.at !== null && item.at >= threat.at - 30 && item.at <= threat.at + 7 * 60);
    const counter = ownCounterEvents[0];
    const wallAt = ownWallEvents[0]?.at;
    const counterAt = counter?.at ?? wallAt;
    if (counterAt !== undefined) {
      response = { unit: counter?.unit ?? "Muralhas", at: counterAt };
      const delay = Math.max(0, counterAt - threat.at);
      reactionScore = delay <= 60 ? 20 : delay <= 120 ? 17 : delay <= 180 ? 14 : delay <= 300 ? 10 : delay <= 420 ? 7 : 4;
      reactionSummary = delay <= 60
        ? "Resposta muito rápida após o primeiro comando militar adversário detectado."
        : `Primeira resposta identificada ${Math.round(delay)}s depois do primeiro comando militar adversário detectado.`;
    } else {
      reactionScore = 2;
      reactionSummary = "Houve produção militar adversária, mas o replay não mostrou uma unidade de contra-ataque ou muralha nos 7 minutos seguintes.";
    }
  }

  const categories: EvaluationCategory[] = [
    category("opening", "Execução da abertura", strategyScore, 25, strategyReason),
    category("timing", "Timing das eras", null, 20, "Comparação de timing será pontuada apenas em partidas 1v1 RM na Arabia, velocidade Normal, para evitar comparar mapas/modos diferentes.", "not_applicable"),
    category("economy", "Regularidade econômica", economyScore, 20, economyReason),
    category("military", "Composição e tecnologias", militaryScore, 15, militaryReason),
    category("reaction", "Reação à pressão adversária", reactionScore, 20, reactionSummary,
      reactionScore === null ? "not_applicable" : "scored"),
  ];

  const mapName = norm(match.map ?? "");
  const modeName = norm([match.gameModeName, match.leaderboardName].filter(Boolean).join(" "));
  const speedName = norm(match.speedName ?? "");
  const benchmarkApplicable = mapName.includes("arabia") && modeName.includes("1v1") && speedName.includes("normal") && match.speedFactor !== undefined;
  let benchmarkNote = "Sem benchmark: mapa, modo ou velocidade diferentes do cenário de referência 1v1 Arabia/Normal.";
  let feudalDisplay: string | null = null;
  let targetFeudalDisplay: string | null = null;
  if (benchmarkApplicable && feudal === null) {
    const idx = categories.findIndex((item) => item.id === "timing");
    categories[idx] = category("timing", "Timing das eras", null, 20, "A partida se encaixa no cenário de referência, mas o evento de avanço à Feudal não foi retornado.", "insufficient_data");
  }
  if (benchmarkApplicable && feudal !== null) {
    const speedFactor = match.speedFactor ?? 1;
    const inGameFeudal = feudal * speedFactor;
    feudalDisplay = clock(inGameFeudal);
    let target = 9 * 60 + 15;
    if (strategy.includes("Archer") || strategy.includes("Men-at-Arms")) target = 8 * 60 + 50;
    if (strategy.includes("Fast Castle")) target = 11 * 60 + 45;
    if (strategy.includes("Scout")) target = 9 * 60 + 15;
    targetFeudalDisplay = clock(target);
    const delta = Math.abs(inGameFeudal - target);
    const timingScore = Math.max(0, Math.round(20 - delta / 20));
    const timingReason = `Feudal em ${feudalDisplay}; referência aproximada para ${strategy}: ${targetFeudalDisplay}. A referência varia por civilização e execução.`;
    const idx = categories.findIndex((item) => item.id === "timing");
    categories[idx] = category("timing", "Timing das eras", timingScore, 20, timingReason);
    benchmarkNote = "Benchmark aproximado de 1v1 Arabia/Normal; a pontuação considera a velocidade da partida e não substitui a comparação com uma build order específica.";
  }

  const scored = categories.filter((item) => item.score !== null);
  const maxAvailable = scored.reduce((sum, item) => sum + item.max, 0);
  const earned = scored.reduce((sum, item) => sum + (item.score ?? 0), 0);
  const overallScore = scored.length >= 3 && maxAvailable > 0 ? Math.round(earned / maxAvailable * 100) : null;
  const coverage = Math.round(scored.reduce((sum, item) => sum + item.max, 0) / categories.reduce((sum, item) => sum + item.max, 0) * 100);
  const confidence = scored.length >= 4 ? "high" : scored.length >= 3 ? "medium" : "low";
  const overallLabel = overallScore === null ? "Dados insuficientes" : overallScore >= 85 ? "Excelente execução" : overallScore >= 70 ? "Boa execução" : overallScore >= 55 ? "Em desenvolvimento" : "Precisa de ajustes";

  const strengths: string[] = [];
  const tips: CoachingTip[] = [];
  if (strategyScore !== null) strengths.push(`A abertura ${strategy} foi reconhecida por ${evidence[0] ?? "sinais da sequência de produção"}`);
  if (economyScore !== null && economyScore >= 16) strengths.push("Boa regularidade aparente nos comandos de produção de aldeões.");
  if (militaryScore !== null && militaryScore >= 13) strengths.push("A composição militar teve apoio de tecnologia compatível com a estratégia detectada.");
  if (reactionScore !== null && reactionScore >= 14) strengths.push("A resposta militar apareceu pouco tempo depois da pressão adversária registrada.");

  if (villagerGaps.length) {
    const worst = villagerGaps.sort((a, b) => b.gap - a.gap)[0];
    tips.push({
      severity: "high", time: clock(worst.from), title: "Possível pausa na fila de aldeões",
      detail: `Depois do tempo estimado da fila, houve um intervalo de aproximadamente ${Math.round(worst.gap)}s sem novo comando de aldeão.`,
      action: "Confira esse trecho do replay: mantenha o Centro da Cidade produzindo aldeões e evite acumular recursos sem um plano.",
    });
  }
  if (strategy === "Archer Rush" && !hasTech("fletching")) {
    tips.push({
      severity: "medium", time: clock(feudal ?? 0), title: "Fletching não detectado",
      detail: "O replay mostra uma abertura de arqueiros, mas não retornou a pesquisa de Fletching.",
      action: "Quando tiver massa de arqueiros e o adversário também estiver contestando à distância, avalie pesquisar Fletching para aumentar alcance e ataque.",
    });
  }
  if (strategy.includes("Scout") && !hasTech("bloodlines", "forging", "scale barding", "chain barding")) {
    tips.push({
      severity: "medium", time: clock(feudal ?? 0), title: "Melhorias de cavalaria não detectadas",
      detail: "A abertura produziu Scouts, mas não foi identificada uma melhoria de combate associada.",
      action: "Considere Bloodlines ou melhorias de ataque/armadura quando a economia permitir e a produção de Scouts continuar relevante.",
    });
  }
  if (threat && reactionScore !== null && reactionScore <= 7) {
    const enemyClass = includesAny(threat.unit, ["archer", "crossbow", "skirmisher", "longbow"]) ? "unidades de alcance"
      : includesAny(threat.unit, ["scout", "light cavalry", "knight", "cavalier", "paladin", "camel"]) ? "cavalaria"
      : "unidades militares";
    const counterSuggestion = enemyClass === "unidades de alcance"
      ? "adicione Skirmishers, proteção de paredes e/ou unidades de cerco conforme a composição adversária"
      : enemyClass === "cavalaria"
        ? "considere Spearmen/Pikemen, Monges ou Camelos de acordo com a sua civilização"
        : "ajuste a composição para uma unidade de contra-ataque e proteja seus pontos de coleta";
    tips.push({
      severity: "high", time: clock(threat.at), title: "Resposta à pressão demorou ou não apareceu",
      detail: `O adversário começou a enfileirar ${threat.unit} em ${clock(threat.at)}; não foi detectado um contra-ataque rápido no seu histórico de produção.`,
      action: `Após identificar essa ameaça no jogo, ${counterSuggestion}.`,
    });
  }
  if (strategy === "Fast Castle" && !hasCastleTC && !castleUnits.length) {
    tips.push({
      severity: "medium", time: clock(castle), title: "Fast Castle sem transição clara",
      detail: "O avanço rápido aos Castelos foi detectado, mas a análise não encontrou produção militar ou um novo Centro da Cidade em seguida.",
      action: "Defina o objetivo do Fast Castle: pressionar com Knights/Monges/Cerco ou investir em boom com Centros da Cidade adicionais.",
    });
  }
  if (!tips.length) {
    tips.push({
      severity: "positive", time: null, title: "Continue comparando suas decisões",
      detail: "Não foi encontrado um erro claro dentro dos sinais disponíveis nesta partida.",
      action: "Na próxima análise, selecione uma build order específica para receber uma comparação passo a passo.",
    });
  }

  const alternatives = [...new Set(alternatives)];
  return {
    overallScore, overallLabel, confidence, coverage,
    strategy: {
      name: strategy,
      confidence: confidenceFromStrength(strategyStrength),
      reason: strategyReason,
      evidence,
      alternatives,
    },
    categories,
    reaction: {
      opponentUnit: threat?.unit ?? null,
      opponentTime: threat ? clock(threat.at) : null,
      responseUnit: response?.unit ?? null,
      responseTime: response ? clock(response.at) : null,
      delaySeconds: threat && response ? Math.max(0, Math.round(response.at - threat.at)) : null,
      score: reactionScore,
      summary: reactionSummary,
    },
    strengths,
    tips,
    benchmark: {
      applicable: benchmarkApplicable,
      note: benchmarkNote,
      feudalTime: feudalDisplay,
      targetFeudalTime: targetFeudalDisplay,
    },
  };
}
