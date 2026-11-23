"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BellRing,
  Castle,
  Download,
  History,
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
  X,
  Wifi,
  WifiOff,
} from "lucide-react";
import styles from "./live.module.css";
import LiveChat from "./LiveChat";
import SteamPlayerCount from "./SteamPlayerCount";
import { liveText, type LiveLocale } from "./translations";

type Mode = "1v1" | "TG";
type Region = "WORLD" | "BR" | "BR_800_1400";

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
  ratingDiff?: number;
  replay?: boolean;
  won?: boolean | null;
  team?: number;
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
  finished?: string;
  server?: string;
  teams?: Array<{ teamId?: number; players?: LivePlayer[] }>;
  players?: LivePlayer[];
};

type QueueNotification = {
  id: string;
  profileId: number;
  name: string;
  country?: string;
  rating: number | null;
  mode: Mode;
  region: Region;
};

type QueueNotificationContext = {
  mode: Mode;
  region: Region;
  players: Map<number, { name: string; rating: number }>;
  ready: boolean;
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

function regionLabel(region: Region, locale: LiveLocale) {
  if (locale === "en") {
    if (region === "BR") return "Brazil";
    if (region === "BR_800_1400") return "Brazil 800+";
    return "World";
  }
  if (region === "BR") return "Brasil";
  if (region === "BR_800_1400") return "Brasil 800+";
  return "Mundo";
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

function formatTime(value: string | null | undefined, locale: LiveLocale) {
  if (!value) return locale === "pt" ? "Aguardando informação" : "Waiting for data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "pt" ? "Horário indisponível" : "Time unavailable";
  return date.toLocaleTimeString(locale === "pt" ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(value: string | null | undefined, locale: LiveLocale) {
  if (!value) return locale === "pt" ? "agora" : "just now";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return locale === "pt" ? "agora" : "just now";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return locale === "pt" ? "há menos de 1 min" : "less than 1 min ago";
  if (seconds < 3600) return locale === "pt"
    ? "há " + Math.floor(seconds / 60) + " min"
    : Math.floor(seconds / 60) + " min ago";
  return locale === "pt"
    ? "há " + Math.floor(seconds / 3600) + " h"
    : Math.floor(seconds / 3600) + " hr ago";
}

function mergeRecentMatches(current: LiveMatch[], incoming: LiveMatch[]) {
  const cutoff = Date.now() - 30 * 60 * 1000;
  const matches = new Map<number, LiveMatch>();
  for (const match of [...current, ...incoming]) {
    const finishedAt = new Date(match.finished ?? "").getTime();
    if (!Number.isFinite(finishedAt) || finishedAt < cutoff || finishedAt > Date.now() + 60_000) continue;
    matches.set(match.matchId, match);
  }
  return Array.from(matches.values())
    .sort((a, b) => new Date(b.finished ?? 0).getTime() - new Date(a.finished ?? 0).getTime())
    .slice(0, 60);
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

export default function LiveTrackerClient({ initialLocale }: { initialLocale: LiveLocale }) {
  const [locale, setLocale] = useState<LiveLocale>(initialLocale);
  const t = liveText[locale];
  const changeLocale = useCallback((next: LiveLocale) => {
    setLocale(next);
    document.cookie = "aoe2-live-locale=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax";
  }, []);
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
  const [queueNotifications, setQueueNotifications] = useState<QueueNotification[]>([]);
  const queueItemsRef = useRef(new Map<string, QueueItem>());
  const queueNotificationContextRef = useRef<QueueNotificationContext>({
    mode: "1v1",
    region: "WORLD",
    players: new Map(),
    ready: false,
  });
  const queueNotificationSeenRef = useRef(new Set<string>());
  const queueNotificationBaselineReadyRef = useRef(false);
  const queueNotificationTimersRef = useRef(new Map<string, number>());
  const loadedLeaderboardKeyRef = useRef("");
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [recentMatches, setRecentMatches] = useState<LiveMatch[]>([]);
  const [recentMatchesError, setRecentMatchesError] = useState("");
  const liveMatchesRef = useRef<LiveMatch[]>([]);
  const recentModeRef = useRef<Mode>(mode);
  const recentTrackedIdsRef = useRef<Set<number>>(new Set());
  const [queueConnection, setQueueConnection] = useState<ConnectionState>("connecting");
  const [matchConnection, setMatchConnection] = useState<ConnectionState>("connecting");
  const [socketUpdatedAt, setSocketUpdatedAt] = useState<string | null>(null);

  const dismissQueueNotification = useCallback((id: string) => {
    const timer = queueNotificationTimersRef.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    queueNotificationTimersRef.current.delete(id);
    setQueueNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const publishQueueNotifications = useCallback((notifications: QueueNotification[]) => {
    if (!notifications.length) return;
    setQueueNotifications((current) => [...current, ...notifications].slice(-4));
    for (const notification of notifications) {
      const timer = window.setTimeout(() => {
        setQueueNotifications((current) => current.filter((item) => item.id !== notification.id));
        queueNotificationTimersRef.current.delete(notification.id);
      }, 8500);
      queueNotificationTimersRef.current.set(notification.id, timer);
    }
  }, []);

  useEffect(() => () => {
    for (const timer of queueNotificationTimersRef.current.values()) window.clearTimeout(timer);
    queueNotificationTimersRef.current.clear();
  }, []);

  const loadLeaderboard = useCallback(async (manual = false) => {
    loadedLeaderboardKeyRef.current = "";
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
      loadedLeaderboardKeyRef.current = mode + ":" + region;
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
          if (!stopped) {
            setConnection("connected");
            if (handler === "queueing") queueNotificationBaselineReadyRef.current = false;
          }
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
      const next = new Map(queueItemsRef.current);
      const notifications: QueueNotification[] = [];
      const isInitialBatch = !queueNotificationBaselineReadyRef.current;
      const context = queueNotificationContextRef.current;

      const clearQueueDedupe = (queueId: string) => {
        const prefix = queueId + "::";
        for (const key of Array.from(queueNotificationSeenRef.current)) {
          if (key.startsWith(prefix)) queueNotificationSeenRef.current.delete(key);
        }
      };

      for (const event of events) {
        const payload = asRecord(event.data);
        if (!payload) continue;
        const type = String(event.type ?? "");
        const id = String(payload.id ?? "");
        if (!id) continue;

        if (type === "queueingRemoved") {
          next.delete(id);
          clearQueueDedupe(id);
          continue;
        }

        if (type !== "queueingAdded" && type !== "queueingUpdated") continue;

        const previous = next.get(id);
        const players = Array.isArray(payload.players) ? payload.players as QueuePlayer[] : [];
        const status = payload.status === "matched" ? "matched" : "queueing";
        const item: QueueItem = {
          id,
          status,
          matchId: Number(payload.matchId) || undefined,
          leaderboard: typeof payload.leaderboard === "string" ? payload.leaderboard : undefined,
          mapName: typeof payload.mapName === "string" ? payload.mapName : undefined,
          queueingSince: typeof payload.queueingSince === "string" ? payload.queueingSince : undefined,
          matchedAt: typeof payload.matchedAt === "string" ? payload.matchedAt : undefined,
          players,
        };

        if (status === "queueing") {
          if (previous && previous.status !== "queueing") clearQueueDedupe(id);
          const alreadyQueueing = new Set(
            previous?.status === "queueing"
              ? previous.players.map((player) => Number(player.profileId)).filter((profileId) => profileId > 0)
              : [],
          );
          const initialQueueAge = item.queueingSince
            ? Date.now() - new Date(item.queueingSince).getTime()
            : Number.POSITIVE_INFINITY;
          const initialEntryIsRecent = Number.isFinite(initialQueueAge) && initialQueueAge >= 0 && initialQueueAge <= 30_000;

          for (const player of players) {
            const profileId = Number(player.profileId);
            if (!Number.isSafeInteger(profileId) || profileId <= 0 || alreadyQueueing.has(profileId)) continue;
            const watchedPlayer = context.players.get(profileId);
            if (!context.ready || !watchedPlayer) continue;

            // The first socket batch can be a snapshot of players who were already
            // queueing before the visitor arrived. Only notify for entries from the
            // last 30 seconds in that initial batch; later new/updated events notify normally.
            if (isInitialBatch && !initialEntryIsRecent) continue;

            const dedupeKey = id + "::" + profileId;
            if (queueNotificationSeenRef.current.has(dedupeKey)) continue;
            queueNotificationSeenRef.current.add(dedupeKey);

            notifications.push({
              id: dedupeKey + "::" + Date.now() + "::" + notifications.length,
              profileId,
              name: watchedPlayer.name || player.name || "Jogador",
              country: player.country,
              rating: watchedPlayer.rating > 0 ? watchedPlayer.rating : null,
              mode: context.mode,
              region: context.region,
            });
          }
        }

        next.set(id, item);
      }

      queueItemsRef.current = next;
      setQueueItems(Array.from(next.values()).slice(-500));
      if (isInitialBatch) queueNotificationBaselineReadyRef.current = true;
      publishQueueNotifications(notifications);
    };

    const handleMatchEvents = (events: Record<string, unknown>[]) => {
      const next = new Map(liveMatchesRef.current.map((match) => [String(match.matchId), match]));
      const justFinished: LiveMatch[] = [];
      for (const event of events) {
        const payload = asRecord(event.data);
        if (!payload) continue;
        const type = String(event.type ?? "");
        const matchId = Number(payload.matchId);
        if (type === "matchRemoved") {
          const previous = next.get(String(matchId));
          if (
            previous &&
            isMatchInMode(previous, recentModeRef.current) &&
            matchPlayers(previous).some((player) => recentTrackedIdsRef.current.has(Number(player.profileId)))
          ) {
            justFinished.push({ ...previous, finished: new Date().toISOString() });
          }
          next.delete(String(matchId));
        } else if ((type === "matchAdded" || type === "matchUpdated") && Number.isSafeInteger(matchId) && matchId > 0) {
          next.set(String(matchId), payload as unknown as LiveMatch);
        }
      }
      const updated = Array.from(next.values()).slice(-300);
      liveMatchesRef.current = updated;
      setLiveMatches(updated);
      if (justFinished.length) {
        setRecentMatches((current) => mergeRecentMatches(current, justFinished));
      }
    };

    if (!loading) {
      queueSocket = connect("queueing", setQueueConnection, handleQueueEvents);
      matchSocket = connect("ongoing-matches", setMatchConnection, handleMatchEvents);
    }

    return () => {
      stopped = true;
      if (queueReconnect) clearTimeout(queueReconnect);
      if (matchReconnect) clearTimeout(matchReconnect);
      queueSocket?.close();
      matchSocket?.close();
    };
  }, [loading, publishQueueNotifications]);

  const hasExpandedTeamTracking = mode === "TG";
  const hasBrazil800Tracking = region === "BR_800_1400";
  const hasExpandedTracking = hasExpandedTeamTracking || hasBrazil800Tracking;
  const trackingMinRating = hasBrazil800Tracking ? 800 : region === "BR" ? 1200 : 1300;
  const trackingMaxRating = hasBrazil800Tracking ? 1400 : null;
  const trackingRatingLabel = trackingMaxRating !== null ? trackingMinRating + "–" + trackingMaxRating : trackingMinRating + "+";
  const monitoredPlayers = hasExpandedTracking ? trackedPlayers : players;
  const rankedProfileIds = useMemo(
    () => new Set(monitoredPlayers.map((player) => player.profileId)),
    [monitoredPlayers],
  );
  // The selected leaderboard supplies the current rating: 1v1 ratings in 1v1 mode,
  // and the expanded team-game leaderboard ratings in TG mode.
  const monitoredPlayerRatings = useMemo(
    () => new Map(monitoredPlayers.map((player) => [player.profileId, player.rating])),
    [monitoredPlayers],
  );
  queueNotificationContextRef.current = {
    mode,
    region,
    players: new Map(monitoredPlayers.map((player) => [
      player.profileId,
      { name: player.name, rating: player.rating },
    ])),
    ready: loadedLeaderboardKeyRef.current === mode + ":" + region && !loadError,
  };
  const monitoredProfileIds = useMemo(
    () => monitoredPlayers.map((player) => player.profileId).filter((profileId) => Number.isSafeInteger(profileId) && profileId > 0),
    [monitoredPlayers],
  );

  useEffect(() => {
    recentModeRef.current = mode;
    recentTrackedIdsRef.current = rankedProfileIds;
  }, [mode, rankedProfileIds]);

  const loadRecentMatches = useCallback(async () => {
    if (!monitoredProfileIds.length) return;
    try {
      const response = await fetch("/api/live/recent-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: monitoredProfileIds, mode }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível consultar as partidas encerradas.");
      setRecentMatches((current) => mergeRecentMatches(current, Array.isArray(data.matches) ? data.matches as LiveMatch[] : []));
      setRecentMatchesError("");
    } catch (error) {
      setRecentMatchesError(error instanceof Error ? error.message : "Histórico recente temporariamente indisponível.");
    }
  }, [monitoredProfileIds, mode]);

  useEffect(() => {
    setRecentMatches([]);
    setRecentMatchesError("");
  }, [mode, region]);

  useEffect(() => {
    if (loading || monitoredProfileIds.length === 0) return;
    void loadRecentMatches();
    const timer = window.setInterval(() => void loadRecentMatches(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadRecentMatches, loading, monitoredProfileIds.length]);

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

  const visibleRecentMatches = useMemo(() => recentMatches
    .filter((match) => isMatchInMode(match, mode))
    .filter((match) => matchPlayers(match).some((player) => rankedProfileIds.has(Number(player.profileId))))
    .sort((a, b) => new Date(b.finished ?? 0).getTime() - new Date(a.finished ?? 0).getTime()),
  [recentMatches, mode, rankedProfileIds]);

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

  const refreshLabel = updatedAt ? formatTime(updatedAt, locale) : "—";
  const allPlayersInLiveMatches = useMemo(
    () => new Set(visibleMatches.flatMap((match) => matchPlayers(match).map((player) => Number(player.profileId)))),
    [visibleMatches],
  );

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label={t.backToGameFinder}>
          <div className={styles.brandIcon}><Castle size={24} /></div>
          <div className={styles.brandCopy}>
            <h1>AOE2 <strong>LIVE TRACKER</strong></h1>
            <span>AGE OF EMPIRES II · DEFINITIVE EDITION</span>
          </div>
        </Link>
        <div className={styles.headerRight}>
          <span className={styles.livePulse}><i /> {t.liveMonitoring}</span>
          <SteamPlayerCount locale={locale} />
          <span className={styles.sourceName}>{t.companionData}</span>
        </div>
        <div className={styles.headerActions}><div className={styles.languageSwitch} aria-label={t.language}><button type="button" className={locale === "pt" ? styles.languageSelected : ""} onClick={() => changeLocale("pt")}>PT</button><button type="button" className={locale === "en" ? styles.languageSelected : ""} onClick={() => changeLocale("en")}>EN</button></div><Link href="/" className={styles.backLink}><ArrowLeft size={16} /> {t.backToGameFinder}</Link></div>
      </header>

      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><Crown size={14} /> {t.topPlayersHub}</div>
          <h2>{t.heroTitle}<br /><em>{t.heroAccent}</em></h2>
          <p>{t.heroDescription}</p>
        </div>
        <div className={styles.heroSide}>
          <div className={styles.connectionRow}>
            <span className={queueConnection === "connected" && matchConnection === "connected" ? styles.connectionOn : styles.connectionOff}>
              {queueConnection === "connected" && matchConnection === "connected" ? <Wifi size={14} /> : <WifiOff size={14} />}
              {queueConnection === "connected" && matchConnection === "connected" ? t.connectionsActive : t.connectingToFeed}
            </span>
            <span className={styles.connectionDetail}>{t.queueLabel}: {queueConnection === "connected" ? t.online : queueConnection === "connecting" ? t.connecting : t.unavailable} · {t.matchesLabel}: {matchConnection === "connected" ? t.online : matchConnection === "connecting" ? t.connecting : t.unavailable}</span>
          </div>
          <div className={styles.updatedLine}>
            <Clock3 size={13} /> {t.rankingUpdated} {refreshLabel}
            <span>·</span>
            <Activity size={13} /> {t.feedLabel} {socketUpdatedAt ? t.receivedAt + " " + formatTime(socketUpdatedAt, locale) : t.waitingForEvents}
          </div>
        </div>
      </section>

      <section className={styles.filterPanel}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}><Globe2 size={14} /> {t.region}</span>
          <div className={styles.segmented}>
            <button type="button" className={region === "BR" ? styles.selected : ""} onClick={() => setRegion("BR")}>{locale === "pt" ? "🇧🇷 Brasil" : "🇧🇷 Brazil"}</button>
            <button type="button" className={region === "WORLD" ? styles.selected : ""} onClick={() => setRegion("WORLD")}>{locale === "pt" ? "🌍 Mundo" : "🌍 World"}</button>
            <button type="button" className={region === "BR_800_1400" ? styles.selected : ""} onClick={() => setRegion("BR_800_1400")}>{locale === "pt" ? "🇧🇷 Brasil 800+" : "🇧🇷 Brazil 800+"}</button>
          </div>
        </div>
        <div className={styles.filterDivider} />
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}><Swords size={14} /> {t.gameMode}</span>
          <div className={styles.segmented}>
            <button type="button" className={mode === "1v1" ? styles.selected : ""} onClick={() => setMode("1v1")}>1x1 · Random Map</button>
            <button type="button" className={mode === "TG" ? styles.selected : ""} onClick={() => setMode("TG")}>{locale === "pt" ? "TG · Jogo em Equipe" : "TG · Team Game"}</button>
          </div>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => void loadLeaderboard(true)} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? styles.spinning : ""} />
          {refreshing ? t.refreshing.toUpperCase() : t.refresh.toUpperCase()}
        </button>
      </section>

      <section className={styles.metrics}>
        <article className={styles.metricCard}>
          <div className={styles.metricIcon}><Trophy size={18} /></div>
          <div><span>{t.rankedPlayers.toUpperCase()}</span><strong>{loading ? "—" : totalPlayers.toLocaleString(locale === "pt" ? "pt-BR" : "en-US")}</strong><small>{regionLabel(region, locale)} · {mode}</small></div>
        </article>
        <article className={styles.metricCard}>
          <div className={styles.metricIcon}><Radio size={18} /></div>
          <div><span>{t.detectedMatches.toUpperCase()}</span><strong>{visibleMatches.length}</strong><small>{t.withPlayersFromRanking}</small></div>
        </article>
        <article className={styles.metricCard}>
          <div className={styles.metricIcon}><Users size={18} /></div>
          <div><span>{t.playersInQueue.toUpperCase()}</span><strong>{queueingPlayerCount}</strong><small>{t.modeNotProvided}</small></div>
        </article>
      </section>

      {hasExpandedTracking ? (
        <div className={styles.trackingNotice}>
          <strong>{t.expandedTrackingActive.toUpperCase()}</strong>
          <span>{hasBrazil800Tracking
            ? trackedPlayersTotal.toLocaleString(locale === "pt" ? "pt-BR" : "en-US") + (locale === "pt" ? " jogadores brasileiros da ladder " : " Brazilian players on the ") + (mode === "1v1" ? "1x1" : "TG") + (locale === "pt" ? (locale === "pt" ? " com ELO entre 800 e 1400 estão sendo acompanhados, inclusive fora do Top 100. " : " ladder players rated 800–1400 are being tracked, including those outside the Top 100. ") : " ladder with an ELO between 800 and 1400 are being tracked, including players outside the Top 100. ")
            : trackedPlayersTotal.toLocaleString(locale === "pt" ? "pt-BR" : "en-US") + (locale === "pt" ? " perfis do ranking TG " : " TG ") + regionLabel(region, locale) + (locale === "pt" ? " com ELO " : " leaderboard profiles rated ") + trackingMinRating + "+ " + (locale === "pt" ? "estão sendo acompanhados, inclusive fora do Top 100. " : "are being tracked, including players outside the Top 100. ")}{t.trackedGamesAndQueues}</span>
        </div>
      ) : null}

      <div className={styles.contentGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>{t.competitiveRanking}</span>
              <h3><Medal size={19} /> TOP 100 · {regionLabel(region, locale).toUpperCase()} · {mode}</h3>
              <p>{t.sortedByCurrentRating}</p>
            </div>
            <label className={styles.searchBox}>
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlayer} />
            </label>
          </div>

          {loadError ? (
            <div className={styles.errorState}><ShieldAlert size={22} /><strong>{t.couldNotLoadRanking}</strong><span>{locale === "pt" ? loadError : t.couldNotLoadRanking}</span><button type="button" onClick={() => void loadLeaderboard(true)}>{t.tryAgain}</button></div>
          ) : loading ? (
            <div className={styles.emptyState}><RefreshCw size={19} className={styles.spinning} />{t.loadingRanking}</div>
          ) : visiblePlayers.length === 0 ? (
            <div className={styles.emptyState}><Search size={19} />{t.noPlayersForFilter}</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>#</th><th>{t.player}</th><th>{t.rating}</th><th>{t.wins}</th><th>{t.games}</th><th>{t.status}</th><th /></tr></thead>
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
                        <td><strong className={styles.rating}>{player.rating.toLocaleString(locale === "pt" ? "pt-BR" : "en-US")}</strong><small className={styles.peak}>{t.peak} {player.maxRating.toLocaleString(locale === "pt" ? "pt-BR" : "en-US")}</small></td>
                        <td><strong>{player.wins.toLocaleString(locale === "pt" ? "pt-BR" : "en-US")}</strong><small className={styles.peak}>{rate}% {t.winRate}</small></td>
                        <td>{player.games.toLocaleString(locale === "pt" ? "pt-BR" : "en-US")}</td>
                        <td>
                          {status.kind === "playing" ? <span className={styles.statusPlaying}><i /> {t.live.toUpperCase()}</span>
                            : status.kind === "queueing" ? <span className={styles.statusQueue}>{t.inQueue.toUpperCase()}*</span>
                            : status.kind === "matched" ? <span className={styles.statusMatched}>{t.matchFound.toUpperCase()}</span>
                            : <span className={styles.statusIdle}>—</span>}
                        </td>
                        <td className={styles.actionCell}>
                          {playingMatch ? <a className={styles.watchIcon} href={"aoe2de://1/" + playingMatch.matchId} title={t.tryWatchInGame}><Gamepad2 size={16} /></a>
                            : <a className={styles.profileIcon} href={"https://www.aoe2companion.com/players/" + player.profileId} target="_blank" rel="noreferrer" title={t.openProfile}><ArrowUpRight size={15} /></a>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className={styles.tableFootnote}>* {hasBrazil800Tracking
            ? locale === "pt" ? "Brasil 800+: são acompanhados todos os brasileiros com ELO entre 800 e 1400 nesta modalidade; a tabela exibe os 100 melhores dentro dessa faixa." : "Brazil 800+: all Brazilian players rated 800–1400 in this mode are tracked; the table shows the top 100 within this range."
            : hasExpandedTeamTracking
              ? (locale === "pt" ? "No modo TG " + regionLabel(region, locale) + ", a detecção inclui todos os perfis dessa ladder com ELO " + trackingMinRating + "+. O feed de fila não confirma a modalidade enquanto a partida ainda está sendo formada; por isso, a fila mostra jogadores pertencentes a esse grupo monitorado." : "In TG " + regionLabel(region, locale) + ", tracking includes all profiles on this ladder rated " + trackingMinRating + "+. The queue feed does not confirm the game mode until matchmaking completes, so the queue panel shows players from this monitored group.")
              : locale === "pt" ? "A detecção de fila e partidas usa os jogadores da tabela Top 100." : "Queue and match detection uses players from the Top 100 table."}{locale === "pt" ? " As partidas ao vivo são filtradas pela modalidade selecionada e pela participação de pelo menos um desses jogadores." : " Live matches are filtered by the selected mode and must include at least one of these players."}</div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeaderCompact}>
              <div><span className={styles.eyebrow}>{t.matchmaking.toUpperCase()}</span><h3><Users size={17} /> {t.inQueueNow.toUpperCase()}</h3></div>
              <span className={styles.countBadge}>{visibleQueue.length}</span>
            </div>
            {visibleQueue.length === 0 ? (
              <div className={styles.sideEmpty}>{queueConnection === "connected" ? t.noTrackedPlayersInQueue : t.waitingQueueFeed}</div>
            ) : (
              <div className={styles.queueList}>
                {visibleQueue.slice(0, 12).map((item) => {
                  const selectedPlayers = item.players.filter((player) => rankedProfileIds.has(Number(player.profileId)));
                  return <article className={styles.queueItem} key={item.id}>
                    <div className={styles.queueItemTop}><span className={styles.statusQueue}>{t.inQueue.toUpperCase()}</span><small>{formatRelative(item.queueingSince, locale)}</small></div>
                    {selectedPlayers.map((player) => {
                      const currentRating = monitoredPlayerRatings.get(Number(player.profileId));
                      return <div className={styles.queuePlayer} key={player.profileId}>
                        <span>{flagEmoji(player.country)}</span>
                        <strong>{player.name ?? "Jogador"}</strong>
                        <small>{typeof currentRating === "number" && currentRating > 0
                          ? currentRating.toLocaleString(locale === "pt" ? "pt-BR" : "en-US") + " ELO"
                          : "{t.eloUnavailable}"}</small>
                      </div>;
                    })}
                    <p>{t.modeNotDisclosedByFeed}</p>
                  </article>;
                })}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeaderCompact}>
              <div><span className={styles.eyebrow}>{t.liveMatches.toUpperCase()}</span><h3><Activity size={17} /> {t.playingNow.toUpperCase()}</h3></div>
              <span className={styles.countBadgeLive}>{visibleMatches.length}</span>
            </div>
            {visibleMatches.length === 0 ? (
              <div className={styles.sideEmpty}>{matchConnection === "connected" ? t.noTrackedLiveMatches : t.waitingLiveMatches}</div>
            ) : (
              <div className={styles.matchList}>
                {visibleMatches.slice(0, 8).map((match) => {
                  const playersInMatch = matchPlayers(match);
                  const listedPlayers = playersInMatch.filter((player) => rankedProfileIds.has(Number(player.profileId)));
                  return <article className={styles.matchCard} key={match.matchId}>
                    <div className={styles.matchTop}><span><i /> {t.live.toUpperCase()}</span><small>{formatTime(match.started, locale)}</small></div>
                    <strong className={styles.matchMap}>{match.mapName ?? match.map ?? "{t.unknownMap}"}</strong>
                    <div className={styles.matchPlayers}>
                      {playersInMatch.slice(0, 8).map((player) => <div className={styles.matchPlayer} key={player.profileId}>
                        <span>{flagEmoji(player.country)}</span><strong>{player.name ?? "Jogador"}</strong>{typeof player.rating === "number" ? <small>{player.rating}</small> : null}
                        {rankedProfileIds.has(Number(player.profileId)) ? <b>{hasBrazil800Tracking ? trackingRatingLabel : hasExpandedTeamTracking ? trackingMinRating + "+" : "TOP"}</b> : null}
                      </div>)}
                    </div>
                    <div className={styles.matchBottom}><span>{match.leaderboardName ?? (mode === "1v1" ? "1x1" : "TG")} · {listedPlayers.length} monitorado(s)</span><a href={"aoe2de://1/" + match.matchId}><Gamepad2 size={15} /> {t.watchInGame.toUpperCase()}</a></div>
                  </article>;
                })}
              </div>
            )}
            {matchedQueue.length > 0 ? <div className={styles.matchedNote}>{matchedQueue.length} {locale === "pt" ? "grupo(s) de fila encontrou(aram) uma partida. Aguardando o feed confirmar a partida ativa." : "queue group(s) found a match. Waiting for the feed to confirm the live game."}</div> : null}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeaderCompact}>
              <div><span className={styles.eyebrow}>{t.recentHistory.toUpperCase()}</span><h3><History size={17} /> {t.completedMatches.toUpperCase()}</h3></div>
              <span className={styles.countBadge}>{visibleRecentMatches.length}</span>
            </div>
            <p className={styles.recentSubtitle}>{t.matchesCompletedIn} · {regionLabel(region, locale)} · {mode}</p>
            {visibleRecentMatches.length === 0 ? (
              <div className={styles.sideEmpty}>
                {recentMatchesError
                  ? t.couldNotLoadRecentHistory
                  : t.noRecentMatches}
              </div>
            ) : (
              <div className={styles.matchList}>
                {visibleRecentMatches.map((match) => {
                  const playersInMatch = matchPlayers(match);
                  const replayPlayer =
                    playersInMatch.find((player) =>
                      Number(player.profileId) > 0 && rankedProfileIds.has(Number(player.profileId)),
                    ) ??
                    playersInMatch.find((player) => Number(player.profileId) > 0);
                  return <article className={styles.matchCard} key={match.matchId}>
                    <div className={styles.matchTop}>
                      <span className={styles.completedTag}><i /> ENCERRADA</span>
                      <small>{formatRelative(match.finished, locale)}</small>
                    </div>
                    <strong className={styles.matchMap}>{match.mapName ?? match.map ?? "Mapa não identificado"}</strong>
                    {(() => {
                      const winners = playersInMatch.filter((player) => player.won === true);
                      const losers = playersInMatch.filter((player) => player.won === false);
                      const unknown = playersInMatch.filter((player) => player.won !== true && player.won !== false);
                      const renderPlayers = (players: LivePlayer[], side: "winner" | "loser" | "unknown") => (
                        players.map((player, index) => <div
                          className={styles.matchPlayer}
                          key={String(player.profileId ?? player.name ?? side) + "-" + index}
                        >
                          <span>{flagEmoji(player.country)}</span>
                          <strong>{player.name ?? "Jogador"}</strong>
                          {typeof player.rating === "number" ? <small>{player.rating}</small> : null}
                        </div>)
                      );
                      return <>
                        <div className={styles.resultSides}>
                          <div className={styles.resultSide + " " + styles.winnerSide}>
                            <div className={styles.resultSideHeader}>
                              <Trophy size={14} />
                              <strong>{t.winners.toUpperCase()}</strong>
                              <span>{winners.length}</span>
                            </div>
                            <div className={styles.resultSidePlayers}>
                              {winners.length ? renderPlayers(winners, "winner") : <small className={styles.noSidePlayers}>—</small>}
                            </div>
                          </div>
                          <div className={styles.resultSide + " " + styles.loserSide}>
                            <div className={styles.resultSideHeader}>
                              <ShieldAlert size={14} />
                              <strong>{t.losers.toUpperCase()}</strong>
                              <span>{losers.length}</span>
                            </div>
                            <div className={styles.resultSidePlayers}>
                              {losers.length ? renderPlayers(losers, "loser") : <small className={styles.noSidePlayers}>—</small>}
                            </div>
                          </div>
                        </div>
                        {unknown.length ? (
                          <div className={styles.unknownSide}>
                            <span>{t.resultNotReported.toUpperCase()}</span>
                            <div className={styles.resultSidePlayers}>{renderPlayers(unknown, "unknown")}</div>
                          </div>
                        ) : null}
                      </>;
                    })()}
                    <div className={styles.matchBottom}>
                      <span>{match.leaderboardName ?? match.gameModeName ?? (mode === "1v1" ? "1x1" : "TG")} · {t.finishedAt} {formatTime(match.finished, locale)}</span>
                      {replayPlayer ? (
                        <a href={"https://aoe.ms/replay/?gameId=" + match.matchId + "&profileId=" + replayPlayer.profileId} target="_blank" rel="noreferrer">
                          <Download size={14} /> {t.downloadReplay.toUpperCase()}
                        </a>
                      ) : (
                        <span className={styles.replayUnavailable}>{t.replayUnavailable.toUpperCase()}</span>
                      )}
                    </div>
                  </article>;
                })}
              </div>
            )}
            <div className={styles.replayNote}>{t.replayZipNote} <strong>.aoe2record</strong> para abrir a gravação no Age of Empires II: Definitive Edition.</div>
          </section>
        </aside>
      </div>

      <div className={styles.queueToastStack} aria-live="polite" aria-atomic="false">
        {queueNotifications.map((notification) => (
          <div className={styles.queueToast} role="status" key={notification.id}>
            <div className={styles.queueToastIcon}><BellRing size={18} /></div>
            <div className={styles.queueToastContent}>
              <span>{t.enteredQueue.toUpperCase()}</span>
              <strong>{flagEmoji(notification.country)} {notification.name}</strong>
              <small>
                {notification.mode === "1v1" ? "1x1" : "TG"} · {regionLabel(notification.region, locale)}
                {typeof notification.rating === "number" ? " · " + notification.rating.toLocaleString(locale === "pt" ? "pt-BR" : "en-US") + " ELO" : ""}
              </small>
            </div>
            <button type="button" onClick={() => dismissQueueNotification(notification.id)} aria-label={t.dismissNotification}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      <footer className={styles.footer}>
        <span>{t.footerBrand}</span>
        <span>{t.footerDisclaimer}</span>
        <Link href="/">{t.backToGameFinder.toUpperCase()} <ArrowUpRight size={13} /></Link>
      </footer>
      <LiveChat locale={locale} />
    </main>
  );
}
