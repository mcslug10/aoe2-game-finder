"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  Crown,
  Gamepad2,
  Globe2,
  Medal,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Swords,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import styles from "./live.module.css";

type Mode = "1v1" | "TG";
type Region = "WORLD" | "BR";

type RankedPlayer = {
  profileId: number;
  name: string;
  country: string;
  rank: number;
  rankCountry: number;
  rating: number;
  maxRating: number;
  wins: number;
  losses: number;
  games: number;
  streak: number;
  lastMatchTime: string | null;
  avatarSmallUrl: string | null;
  avatarMediumUrl: string | null;
};

type QueuePlayer = {
  profileId?: number;
  name?: string;
  country?: string;
  verified?: boolean;
};

type QueueItem = {
  id: string;
  status: "queueing" | "matched";
  matchId?: number;
  leaderboard?: string;
  mapName?: string;
  queueingSince?: string;
  matchedAt?: string;
  players: QueuePlayer[];
};

type LivePlayer = {
  profileId?: number;
  name?: string;
  country?: string;
  rating?: number;
  civName?: string;
  civ?: string;
};

type LiveMatch = {
  matchId: number;
  leaderboardId?: string;
  leaderboardName?: string;
  gameModeName?: string;
  gameMode?: string;
  name?: string;
  mapName?: string;
  map?: string;
  started?: string;
  server?: string;
  teams?: Array<{ teamId?: number; players?: LivePlayer[] }>;
  players?: LivePlayer[];
};

type ConnectionState = "connecting" | "connected" | "disconnected";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function eventList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  const record = asRecord(value);
  return record ? [record] : [];
}

function flagEmoji(country?: string) {
  const code = String(country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)));
}

function matchPlayers(match: LiveMatch): LivePlayer[] {
  if (Array.isArray(match.players) && match.players.length) return match.players;
  return (match.teams ?? []).flatMap((team) => team.players ?? []);
}

function isMatchInMode(match: LiveMatch, mode: Mode) {
  const label = [match.leaderboardId, match.leaderboardName, match.gameModeName, match.gameMode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (mode === "1v1") {
    if (label.includes("rm_1v1") || /1v1|one.?vs.?one/.test(label)) return true;
    if (label.includes("rm_team") || /team|2v2|3v3|4v4/.test(label)) return false;
    return matchPlayers(match).length === 2;
  }

  if (label.includes("rm_team") || /team|2v2|3v3|4v4/.test(label)) return true;
  if (label.includes("rm_1v1") || /1v1|one.?vs.?one/.test(label)) return false;
  return matchPlayers(match).length > 2;
}

function formatTime(value?: string | null) {
  if (!value) return "Aguardando informação";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário indisponível";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(value?: string | null) {
  if (!value) return "agora";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "agora";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "há menos de 1 min";
  if (seconds < 3600) return "há " + Math.floor(seconds / 60) + " min";
  return "há " + Math.floor(seconds / 3600) + " h";
}

function statusForPlayer(
  profileId: number,
  matches: LiveMatch[],
  queueItems: QueueItem[],
) {
  const playing = matches.find((match) => matchPlayers(match).some((player) => Number(player.profileId) === profileId));
  if (playing) return { kind: "playing" as const, match: playing };

  const searching = queueItems.find((item) =>
    item.status === "queueing" && item.players.some((player) => Number(player.profileId) === profileId),
  );
  if (searching) return { kind: "queueing" as const, match: null };

  const matched = queueItems.find((item) =>
    item.status === "matched" && item.players.some((player) => Number(player.profileId) === profileId),
  );
  if (matched) return { kind: "matched" as const, match: null };

  return { kind: "unknown" as const, match: null };
}

export default function LiveTrackerPage() {
  const [mode, setMode] = useState<Mode>("1v1");
  const [region, setRegion] = useState<Region>("WORLD");
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [trackedPlayers, setTrackedPlayers] = useState<RankedPlayer[]>([]);
  const [trackedPlayersTotal, setTrackedPlayersTotal] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [queueConnection, setQueueConnection] = useState<ConnectionState>("connecting");
  const [matchConnection, setMatchConnection] = useState<ConnectionState>("connecting");
  const [socketUpdatedAt, setSocketUpdatedAt] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setLoadError("");

    try {
      const url = "/api/live/leaderboard?mode=" + mode + "&region=" + region;
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar o ranking.");
      setPlayers(Array.isArray(data.players) ? data.players : []);
      setTrackedPlayers(Array.isArray(data.trackedPlayers) ? data.trackedPlayers : []);
      setTrackedPlayersTotal(Number(data.trackedPlayersTotal ?? data.trackedPlayers?.length ?? 0));
      setTotalPlayers(Number(data.total ?? data.players?.length ?? 0));
      setUpdatedAt(data.updatedAt ?? new Date().toISOString());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Falha ao consultar o ranking.");
      setPlayers([]);
      setTrackedPlayers([]);
      setTrackedPlayersTotal(0);
      setTotalPlayers(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode, region]);

  useEffect(() => {
    void loadLeaderboard();
    const timer = window.setInterval(() => void loadLeaderboard(), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadLeaderboard]);

  useEffect(() => {
    let stopped = false;
    let queueSocket: WebSocket | null = null;
    let matchSocket: WebSocket | null = null;
    let queueReconnect: ReturnType<typeof setTimeout> | null = null;
    let matchReconnect: ReturnType<typeof setTimeout> | null = null;

    const connect = (
      handler: "queueing" | "ongoing-matches",
      setConnection: (value: ConnectionState) => void,
      onEvents: (events: Record<string, unknown>[]) => void,
    ) => {
      setConnection("connecting");
      try {
        const socket = new WebSocket(
          "wss://socket.aoe2companion.com/listen?handler=" + handler + "&language=en",
        );

        socket.onopen = () => {
          if (!stopped) setConnection("connected");
        };
        socket.onmessage = (message) => {
          if (stopped) return;
          try {
            const parsed: unknown = JSON.parse(String(message.data));
            const events = eventList(parsed);
            if (events.length) {
              onEvents(events);
              setSocketUpdatedAt(new Date().toISOString());
            }
          } catch {
            // Ignore keep-alive frames and malformed events from the upstream feed.
          }
        };
        socket.onerror = () => socket.close();
        socket.onclose = () => {
          if (stopped) return;
          setConnection("disconnected");
          const reconnect = () => {
            if (stopped) return;
            if (handler === "queueing") {
              queueSocket = connect(handler, setConnection, onEvents);
            } else {
              matchSocket = connect(handler, setConnection, onEvents);
            }
          };
          if (handler === "queueing") queueReconnect = setTimeout(reconnect, 5000);
          else matchReconnect = setTimeout(reconnect, 5000);
        };
        return socket;
      } catch {
        setConnection("disconnected");
        return null;
      }
    };

    const handleQueueEvents = (events: Record<string, unknown>[]) => {
      setQueueItems((current) => {
        const next = new Map(current.map((item) => [item.id, item]));
        for (const event of events) {
          const payload = asRecord(event.data);
          if (!payload) continue;
          const type = String(event.type ?? "");
          const id = String(payload.id ?? "");
          if (!id) continue;
          if (type === "queueingRemoved") {
            next.delete(id);
          } else if (type === "queueingAdded" || type === "queueingUpdated") {
            const players = Array.isArray(payload.players) ? payload.players as QueuePlayer[] : [];
            const status = payload.status === "matched" ? "matched" : "queueing";
            next.set(id, {
              id,
              status,
              matchId: Number(payload.matchId) || undefined,
              leaderboard: typeof payload.leaderboard === "string" ? payload.leaderboard : undefined,
              mapName: typeof payload.mapName === "string" ? payload.mapName : undefined,
              queueingSince: typeof payload.queueingSince === "string" ? payload.queueingSince : undefined,
              matchedAt: typeof payload.matchedAt === "string" ? payload.matchedAt : undefined,
              players,
            });
          }
        }
        return Array.from(next.values()).slice(-500);
      });
    };

    const handleMatchEvents = (events: Record<string, unknown>[]) => {
      setLiveMatches((current) => {
        const next = new Map(current.map((match) => [String(match.matchId), match]));
        for (const event of events) {
          const payload = asRecord(event.data);
          if (!payload) continue;
          const type = String(event.type ?? "");
          const matchId = Number(payload.matchId);
          if (type === "matchRemoved") {
            next.delete(String(matchId));
          } else if ((type === "matchAdded" || type === "matchUpdated") && Number.isSafeInteger(matchId) && matchId > 0) {
            next.set(String(matchId), payload as unknown as LiveMatch);
          }
        }
        return Array.from(next.values()).slice(-300);
      });
    };

    queueSocket = connect("queueing", setQueueConnection, handleQueueEvents);
    matchSocket = connect("ongoing-matches", setMatchConnection, handleMatchEvents);

    return () => {
      stopped = true;
      if (queueReconnect) clearTimeout(queueReconnect);
      if (matchReconnect) clearTimeout(matchReconnect);
      queueSocket?.close();
      matchSocket?.close();
    };
  }, []);

  const hasExpandedBrazilTeamTracking = mode === "TG" && region === "BR";
  const monitoredPlayers = hasExpandedBrazilTeamTracking ? trackedPlayers : players;
  const rankedProfileIds = useMemo(
    () => new Set(monitoredPlayers.map((player) => player.profileId)),
    [monitoredPlayers],
  );

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return players;
    return players.filter((player) => player.name.toLocaleLowerCase("pt-BR").includes(query));
  }, [players, search]);

  const visibleMatches = useMemo(() => liveMatches
    .filter((match) => isMatchInMode(match, mode))
    .filter((match) => matchPlayers(match).some((player) => rankedProfileIds.has(Number(player.profileId))))
    .sort((a, b) => new Date(b.started ?? 0).getTime() - new Date(a.started ?? 0).getTime()),
  [liveMatches, mode, rankedProfileIds]);

  const visibleQueue = useMemo(() => queueItems
    .filter((item) => item.status === "queueing")
    .filter((item) => item.players.some((player) => rankedProfileIds.has(Number(player.profileId))))
    .sort((a, b) => new Date(a.queueingSince ?? 0).getTime() - new Date(b.queueingSince ?? 0).getTime()),
  [queueItems, rankedProfileIds]);

  const matchedQueue = useMemo(() => queueItems
    .filter((item) => item.status === "matched")
    .filter((item) => item.players.some((player) => rankedProfileIds.has(Number(player.profileId)))),
  [queueItems, rankedProfileIds]);

  const queueingPlayerCount = useMemo(() => new Set(
    visibleQueue.flatMap((item) => item.players
      .map((player) => Number(player.profileId))
      .filter((profileId) => rankedProfileIds.has(profileId))),
  ).size, [visibleQueue, rankedProfileIds]);

  const refreshLabel = updatedAt ? formatTime(updatedAt) : "—";
  const allPlayersInLiveMatches = useMemo(
    () => new Set(visibleMatches.flatMap((match) => matchPlayers(match).map((player) => Number(player.profileId)))),
    [visibleMatches],
  );

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}><ArrowLeft size={15} /> Game Finder</Link>
        <div className={styles.brand}>
          <div className={styles.brandIcon}><Swords size={24} /></div>
          <div>
            <span className={styles.brandEyebrow}>AGE OF EMPIRES II · DEFINITIVE EDITION</span>
            <h1>AOE2 <strong>LIVE TRACKER</strong></h1>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.livePulse}><i /> MONITORAMENTO AO VIVO</span>
          <span className={styles.sourceName}>DADOS DO AOE II COMPANION</span>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><Crown size={14} /> CENTRAL DOS TOP PLAYERS</div>
          <h2>Acompanhe os melhores.<br /><em>Não perca nenhuma partida.</em></h2>
          <p>Rankings, filas de matchmaking e partidas detectadas em um só lugar.</p>
        </div>
        <div className={styles.heroSide}>
          <div className={styles.connectionRow}>
            <span className={queueConnection === "connected" && matchConnection === "connected" ? styles.connectionOn : styles.connectionOff}>
              {queueConnection === "connected" && matchConnection === "connected" ? <Wifi size={14} /> : <WifiOff size={14} />}
              {queueConnection === "connected" && matchConnection === "connected" ? "CONEXÕES ATIVAS" : "CONECTANDO À FONTE"}
            </span>
            <span className={styles.connectionDetail}>Fila: {queueConnection === "connected" ? "online" : queueConnection === "connecting" ? "conectando" : "indisponível"} · Partidas: {matchConnection === "connected" ? "online" : matchConnection === "connecting" ? "conectando" : "indisponível"}</span>
          </div>
          <div className={styles.updatedLine}>
            <Clock3 size={13} /> Ranking atualizado às {refreshLabel}
            <span>·</span>
            <Activity size={13} /> Feed {socketUpdatedAt ? "recebido às " + formatTime(socketUpdatedAt) : "aguardando eventos"}
          </div>
        </div>
      </section>

      <section className={styles.filterPanel}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}><Globe2 size={14} /> REGIÃO</span>
          <div className={styles.segmented}>
            <button type="button" className={region === "BR" ? styles.selected : ""} onClick={() => setRegion("BR")}>🇧🇷 Brasil</button>
            <button type="button" className={region === "WORLD" ? styles.selected : ""} onClick={() => setRegion("WORLD")}>🌍 Mundo</button>
          </div>
        </div>
        <div className={styles.filterDivider} />
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}><Swords size={14} /> MODALIDADE</span>
          <div className={styles.segmented}>
            <button type="button" className={mode === "1v1" ? styles.selected : ""} onClick={() => setMode("1v1")}>1x1 · Random Map</button>
            <button type="button" className={mode === "TG" ? styles.selected : ""} onClick={() => setMode("TG")}>TG · Team Game</button>
          </div>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => void loadLeaderboard(true)} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? styles.spinning : ""} />
          {refreshing ? "ATUALIZANDO" : "ATUALIZAR"}
        </button>
      </section>

      <section className={styles.metrics}>
        <article className={styles.metricCard}>
          <div className={styles.metricIcon}><Trophy size={18} /></div>
          <div><span>JOGADORES NO RANKING</span><strong>{loading ? "—" : totalPlayers.toLocaleString("pt-BR")}</strong><small>{region === "BR" ? "Brasil" : "Mundo"} · {mode}</small></div>
        </article>
        <article className={styles.metricCard}>
          <div className={styles.metricIcon}><Radio size={18} /></div>
          <div><span>PARTIDAS DETECTADAS</span><strong>{visibleMatches.length}</strong><small>Com jogadores deste ranking</small></div>
        </article>
        <article className={styles.metricCard}>
          <div className={styles.metricIcon}><Users size={18} /></div>
          <div><span>JOGADORES NA FILA</span><strong>{queueingPlayerCount}</strong><small>Modalidade não informada pela fonte</small></div>
        </article>
      </section>

      {hasExpandedBrazilTeamTracking ? (
        <div className={styles.trackingNotice}>
          <strong>MONITORAMENTO AMPLIADO ATIVO</strong>
          <span>{trackedPlayersTotal.toLocaleString("pt-BR")} perfis do ranking TG Brasil com ELO 1200+ estão sendo acompanhados, inclusive fora do Top 100. Jogos e filas desses jogadores aparecem nos painéis ao lado.</span>
        </div>
      ) : null}

      <div className={styles.contentGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>RANKING COMPETITIVO</span>
              <h3><Medal size={19} /> TOP 100 · {region === "BR" ? "BRASIL" : "MUNDO"} · {mode}</h3>
              <p>Ordenado pelo rating atual na ladder oficial.</p>
            </div>
            <label className={styles.searchBox}>
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar jogador..." />
            </label>
          </div>

          {loadError ? (
            <div className={styles.errorState}><ShieldAlert size={22} /><strong>Não foi possível carregar o ranking</strong><span>{loadError}</span><button type="button" onClick={() => void loadLeaderboard(true)}>Tentar novamente</button></div>
          ) : loading ? (
            <div className={styles.emptyState}><RefreshCw size={19} className={styles.spinning} />Carregando ranking...</div>
          ) : visiblePlayers.length === 0 ? (
            <div className={styles.emptyState}><Search size={19} />Nenhum jogador encontrado para este filtro.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>#</th><th>JOGADOR</th><th>RATING</th><th>VITÓRIAS</th><th>PARTIDAS</th><th>STATUS</th><th /></tr></thead>
                <tbody>
                  {visiblePlayers.map((player) => {
                    const status = statusForPlayer(player.profileId, visibleMatches, queueItems);
                    const playingMatch = status.kind === "playing" ? status.match : null;
                    const rate = player.games > 0 ? Math.round((player.wins / player.games) * 100) : 0;
                    return (
                      <tr key={player.profileId}>
                        <td className={styles.rankCell}>{player.rank > 0 ? player.rank : "—"}</td>
                        <td>
                          <div className={styles.playerCell}>
                            {player.avatarSmallUrl ? <img src={player.avatarSmallUrl} alt="" /> : <span className={styles.avatarFallback}>{player.name.slice(0, 1).toUpperCase()}</span>}
                            <div><strong>{flagEmoji(player.country)} {player.name}</strong><small>Perfil #{player.profileId}</small></div>
                          </div>
                        </td>
                        <td><strong className={styles.rating}>{player.rating.toLocaleString("pt-BR")}</strong><small className={styles.peak}>pico {player.maxRating.toLocaleString("pt-BR")}</small></td>
                        <td><strong>{player.wins.toLocaleString("pt-BR")}</strong><small className={styles.peak}>{rate}% win rate</small></td>
                        <td>{player.games.toLocaleString("pt-BR")}</td>
                        <td>
                          {status.kind === "playing" ? <span className={styles.statusPlaying}><i /> AO VIVO</span>
                            : status.kind === "queueing" ? <span className={styles.statusQueue}>NA FILA*</span>
                            : status.kind === "matched" ? <span className={styles.statusMatched}>MATCH ENCONTRADO</span>
                            : <span className={styles.statusIdle}>—</span>}
                        </td>
                        <td className={styles.actionCell}>
                          {playingMatch ? <a className={styles.watchIcon} href={"aoe2de://1/" + playingMatch.matchId} title="Tentar assistir no jogo"><Gamepad2 size={16} /></a>
                            : <a className={styles.profileIcon} href={"https://www.aoe2companion.com/players/" + player.profileId} target="_blank" rel="noreferrer" title="Abrir perfil"><ArrowUpRight size={15} /></a>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className={styles.tableFootnote}>* No modo TG Brasil, a detecção inclui todos os perfis dessa ladder com ELO 1200+. O feed de fila não confirma a modalidade enquanto a partida ainda está sendo formada; por isso, a fila mostra jogadores pertencentes a esse grupo monitorado. As partidas ao vivo são filtradas pela modalidade TG e pela participação de pelo menos um desses jogadores.</div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeaderCompact}>
              <div><span className={styles.eyebrow}>MATCHMAKING</span><h3><Users size={17} /> NA FILA AGORA</h3></div>
              <span className={styles.countBadge}>{visibleQueue.length}</span>
            </div>
            {visibleQueue.length === 0 ? (
              <div className={styles.sideEmpty}>{queueConnection === "connected" ? "Nenhum jogador do grupo monitorado foi detectado na fila neste momento." : "Aguardando conexão com o feed de fila."}</div>
            ) : (
              <div className={styles.queueList}>
                {visibleQueue.slice(0, 12).map((item) => {
                  const selectedPlayers = item.players.filter((player) => rankedProfileIds.has(Number(player.profileId)));
                  return <article className={styles.queueItem} key={item.id}>
                    <div className={styles.queueItemTop}><span className={styles.statusQueue}>NA FILA</span><small>{formatRelative(item.queueingSince)}</small></div>
                    {selectedPlayers.map((player) => <div className={styles.queuePlayer} key={player.profileId}><span>{flagEmoji(player.country)}</span><strong>{player.name ?? "Jogador"}</strong><small>Top player</small></div>)}
                    <p>Modalidade ainda não divulgada pelo feed.</p>
                  </article>;
                })}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeaderCompact}>
              <div><span className={styles.eyebrow}>PARTIDAS EM ANDAMENTO</span><h3><Activity size={17} /> AGORA NO JOGO</h3></div>
              <span className={styles.countBadgeLive}>{visibleMatches.length}</span>
            </div>
            {visibleMatches.length === 0 ? (
              <div className={styles.sideEmpty}>{matchConnection === "connected" ? "Nenhuma partida com jogadores do grupo monitorado foi detectada no feed ao vivo." : "Aguardando partidas do AoE II Companion."}</div>
            ) : (
              <div className={styles.matchList}>
                {visibleMatches.slice(0, 8).map((match) => {
                  const playersInMatch = matchPlayers(match);
                  const listedPlayers = playersInMatch.filter((player) => rankedProfileIds.has(Number(player.profileId)));
                  return <article className={styles.matchCard} key={match.matchId}>
                    <div className={styles.matchTop}><span><i /> AO VIVO</span><small>{formatTime(match.started)}</small></div>
                    <strong className={styles.matchMap}>{match.mapName ?? match.map ?? "Mapa não identificado"}</strong>
                    <div className={styles.matchPlayers}>
                      {playersInMatch.slice(0, 8).map((player) => <div className={styles.matchPlayer} key={player.profileId}>
                        <span>{flagEmoji(player.country)}</span><strong>{player.name ?? "Jogador"}</strong>{typeof player.rating === "number" ? <small>{player.rating}</small> : null}
                        {rankedProfileIds.has(Number(player.profileId)) ? <b>{hasExpandedBrazilTeamTracking ? "1200+" : "TOP"}</b> : null}
                      </div>)}
                    </div>
                    <div className={styles.matchBottom}><span>{match.leaderboardName ?? (mode === "1v1" ? "1x1" : "TG")} · {listedPlayers.length} monitorado(s)</span><a href={"aoe2de://1/" + match.matchId}><Gamepad2 size={15} /> ASSISTIR NO JOGO</a></div>
                  </article>;
                })}
              </div>
            )}
            {matchedQueue.length > 0 ? <div className={styles.matchedNote}>{matchedQueue.length} grupo(s) de fila encontrou(aram) uma partida. Aguardando o feed confirmar a partida ativa.</div> : null}
          </section>
        </aside>
      </div>

      <footer className={styles.footer}>
        <span>AOE2 LIVE TRACKER · PROJETO INDEPENDENTE DA COMUNIDADE</span>
        <span>Dados de ranking e presença fornecidos pelo AoE II Companion. Status ao vivo pode ter atraso ou indisponibilidade.</span>
        <Link href="/">VOLTAR AO GAME FINDER <ArrowUpRight size={13} /></Link>
      </footer>
    </main>
  );
}
