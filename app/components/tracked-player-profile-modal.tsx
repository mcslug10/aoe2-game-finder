"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Clock3, Crown, ExternalLink,
  LoaderCircle, RefreshCw, Swords, Trophy, X,
} from "lucide-react";

type ProfileLeaderboard = {
  leaderboardId: string;
  leaderboardName: string;
  abbreviation?: string;
  active?: boolean;
  rank?: number;
  total?: number;
  rating?: number;
  maxRating?: number;
  games?: number;
  drops?: number;
  losses?: number;
  wins?: number;
  streak?: number;
  lastMatchTime?: string;
  last10MatchesWon?: Array<{ won: boolean }>;
};

type ProfileStatValue = {
  civ?: string;
  civName?: string;
  civImageUrl?: string;
  map?: string;
  mapName?: string;
  mapImageUrl?: string;
  games?: number;
  wins?: number;
  losses?: number;
};

type ProfileStats = {
  leaderboardId: string;
  leaderboardName?: string;
  civ?: ProfileStatValue[];
  map?: ProfileStatValue[];
};

type CompanionProfile = {
  profileId: number;
  name: string;
  country?: string;
  countryIcon?: string;
  avatarMediumUrl?: string;
  avatarFullUrl?: string;
  clan?: string;
  games?: number;
  drops?: number;
  sharedHistory?: boolean;
  leaderboards?: ProfileLeaderboard[];
  stats?: ProfileStats[];
};

type MatchPlayer = {
  profileId: number;
  nickname: string;
  country?: string | null;
  civilizationName?: string | null;
  rating?: number | null;
  ratingDiff?: number | null;
  teamId?: number | null;
  won?: boolean;
};

type RecentMatch = {
  id: string;
  title: string;
  map: string;
  mapRaw?: string;
  gameModeName?: string;
  leaderboardName?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  durationSeconds?: number | null;
  result?: "win" | "loss" | "unknown";
  civilizationName?: string | null;
  ratingChange?: number | null;
  participants: MatchPlayer[];
  includesPlayer?: boolean;
};

type ProfileResponse = {
  profile: CompanionProfile;
  matches: RecentMatch[];
  updatedAt?: string;
};

type Props = {
  profileId: number;
  language: "pt" | "en";
  onClose: () => void;
};

const copy = {
  pt: {
    loading: "Carregando perfil...",
    retry: "Tentar novamente",
    games: "jogos",
    drops: "desconexões",
    ladderGames: "partidas",
    current: "Atual",
    maximum: "Máxima",
    rank: "Classificação",
    top: "Top",
    civ: "Civilização favorita",
    map: "Mapa favorito",
    winrate: "de vitórias",
    lastFive: "Sequência das últimas 5 partidas",
    inactive: "Inativo",
    lastPlayed: "Última partida",
    showInactive: "Mostrar classificações inativas",
    hideInactive: "Ocultar classificações inativas",
    recent: "Partidas recentes",
    noMatches: "Nenhuma partida recente disponível.",
    noRankings: "Nenhuma classificação disponível para este perfil.",
    noStats: "Estatísticas não disponíveis",
    victory: "Vitória",
    defeat: "Derrota",
    unknown: "Resultado indisponível",
    vs: "VS",
    profileId: "PROFILE ID",
    openCompanion: "Abrir no AoE II Companion",
    updated: "Dados consultados",
    notShared: "Este jogador não compartilha o histórico de partidas.",
    errorTitle: "Não foi possível carregar o perfil",
    loadingMatches: "Consultando histórico de partidas e estatísticas...",
  },
  en: {
    loading: "Loading profile...",
    retry: "Try again",
    games: "games",
    drops: "disconnects",
    ladderGames: "matches",
    current: "Current",
    maximum: "Maximum",
    rank: "Rank",
    top: "Top",
    civ: "Favorite civilization",
    map: "Favorite map",
    winrate: "win rate",
    lastFive: "Last 5 matches",
    inactive: "Inactive",
    lastPlayed: "Last played",
    showInactive: "Show inactive ladders",
    hideInactive: "Hide inactive ladders",
    recent: "Recent matches",
    noMatches: "No recent matches available.",
    noRankings: "No ladder data available for this profile.",
    noStats: "Statistics unavailable",
    victory: "Victory",
    defeat: "Defeat",
    unknown: "Result unavailable",
    vs: "VS",
    profileId: "PROFILE ID",
    openCompanion: "Open in AoE II Companion",
    updated: "Data checked",
    notShared: "This player does not share their match history.",
    errorTitle: "Could not load the profile",
    loadingMatches: "Loading recent matches and statistics...",
  },
};

function number(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(wins?: number, games?: number) {
  if (!games || games <= 0 || wins === undefined) return null;
  return Math.round((wins / games) * 100);
}

function dateLabel(value: string | null | undefined, language: "pt" | "en") {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(language === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function durationLabel(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return null;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function ratingDelta(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value > 0 ? `+${value}` : String(value);
}

export default function TrackedPlayerProfileModal({ profileId, language, onClose }: Props) {
  const t = copy[language];
  const [selectedProfileId, setSelectedProfileId] = useState(profileId);
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    setSelectedProfileId(profileId);
  }, [profileId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);

    void fetch(`/api/players/${selectedProfileId}/profile`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Request failed");
      if (active) setData(payload as ProfileResponse);
    }).catch((reason: unknown) => {
      if (active && !(reason instanceof DOMException && reason.name === "AbortError")) {
        setError(reason instanceof Error ? reason.message : "Request failed");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedProfileId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const profile = data?.profile;
  const leaderboards = profile?.leaderboards ?? [];
  const activeLeaderboards = leaderboards.filter((item) => item.active !== false);
  const inactiveLeaderboards = leaderboards.filter((item) => item.active === false);
  const visibleLeaderboards = showInactive ? [...activeLeaderboards, ...inactiveLeaderboards] : activeLeaderboards;
  const totalGames = number(profile?.games) ?? leaderboards.reduce((sum, item) => sum + (number(item.games) ?? 0), 0);
  const totalDrops = number(profile?.drops) ?? leaderboards.reduce((sum, item) => sum + (number(item.drops) ?? 0), 0);
  const dropRate = totalGames > 0 ? ((totalDrops / totalGames) * 100).toFixed(2) : "0.00";

  const statsByLadder = useMemo(() => new Map((profile?.stats ?? []).map((item) => [item.leaderboardId, item])), [profile?.stats]);
  const sortedMatches = [...(data?.matches ?? [])].sort((a, b) =>
    (b.completedAt ?? b.startedAt ?? "").localeCompare(a.completedAt ?? a.startedAt ?? ""),
  );

  return (
    <div className="player-profile-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="player-profile-modal" role="dialog" aria-modal="true" aria-label={profile?.name ?? "Player profile"}>
        <header className="player-profile-header">
          <div className="player-profile-heading">
            {profile?.avatarMediumUrl
              ? <img className="player-profile-avatar" src={profile.avatarMediumUrl} alt="" />
              : <div className="player-profile-avatar player-profile-avatar-fallback"><Swords size={21}/></div>}
            <div className="player-profile-identity">
              <span className="eyebrow muted">AOE II COMPANION</span>
              <h2>{profile?.name ?? (loading ? t.loading : `Player ${selectedProfileId}`)}</h2>
              <small>{profile?.country ?? ""} · {t.profileId}: {selectedProfileId}</small>
            </div>
          </div>
          <div className="player-profile-header-actions">
            <a href={`https://www.aoe2companion.com/players/${selectedProfileId}`} target="_blank" rel="noreferrer" className="player-profile-external">
              <ExternalLink size={14}/>{t.openCompanion}
            </a>
            <button className="player-profile-close" onClick={onClose} aria-label="Close profile"><X size={20}/></button>
          </div>
        </header>

        {loading && (
          <div className="player-profile-loading">
            <LoaderCircle size={26} className="player-profile-spinner"/>
            <span>{t.loadingMatches}</span>
          </div>
        )}

        {!loading && error && (
          <div className="player-profile-error" role="alert">
            <strong>{t.errorTitle}</strong>
            <p>{error}</p>
            <button onClick={() => setSelectedProfileId(current => current)}>{t.retry}</button>
          </div>
        )}

        {!loading && profile && data && (
          <div className="player-profile-content">
            <div className="player-profile-overview">
              <div><strong>{(profile.games ?? totalGames).toLocaleString(language === "pt" ? "pt-BR" : "en-US")}</strong><span>{t.games}</span></div>
              <div><strong>{(profile.drops ?? totalDrops).toLocaleString(language === "pt" ? "pt-BR" : "en-US")}</strong><span>{t.drops} ({dropRate}%)</span></div>
              {profile.clan && <div><strong>{profile.clan}</strong><span>Clan</span></div>}
            </div>

            {profile.sharedHistory === false && <p className="player-profile-private">{t.notShared}</p>}

            <div className="player-profile-ladder-grid">
              {visibleLeaderboards.map((ladder) => {
                const stats = statsByLadder.get(ladder.leaderboardId);
                const favoriteCiv = [...(stats?.civ ?? [])].sort((a, b) => (b.games ?? 0) - (a.games ?? 0))[0];
                const favoriteMap = [...(stats?.map ?? [])].sort((a, b) => (b.games ?? 0) - (a.games ?? 0))[0];
                const ladderGames = number(ladder.games) ?? (stats?.civ ?? []).reduce((sum, item) => sum + (number(item.games) ?? 0), 0);
                const winrate = percent(ladder.wins, ladderGames);
                const streak = number(ladder.streak) ?? 0;
                const lastFive = (ladder.last10MatchesWon ?? []).slice(0, 5).reverse();

                return (
                  <article className={`player-profile-ladder-card ${ladder.active === false ? "inactive" : ""}`} key={ladder.leaderboardId}>
                    <div className="player-profile-ladder-top">
                      <h3>{ladder.leaderboardName}</h3>
                      <span>{ladderGames.toLocaleString(language === "pt" ? "pt-BR" : "en-US")} {t.ladderGames}</span>
                      <small>{number(ladder.drops) ?? 0} {t.drops}</small>
                    </div>
                    <div className="player-profile-ladder-columns">
                      <div className="player-profile-rank">
                        {ladder.active === false
                          ? <strong className="player-profile-inactive">{t.inactive}</strong>
                          : <><strong>#{number(ladder.rank) ?? "—"}</strong><small>{ladder.rank && ladder.total ? `${t.top} ${Math.max(1, (ladder.rank / ladder.total) * 100).toFixed(0)}%` : t.rank}</small></>}
                        <div className="player-profile-ratings"><span>{t.current}</span><b>{number(ladder.rating) ?? "—"}</b><span>{t.maximum}</span><b>{number(ladder.maxRating) ?? "—"}</b></div>
                        {winrate !== null && <small className="player-profile-ladder-winrate">{winrate}% {t.winrate}</small>}
                      </div>
                      <div className="player-profile-favorite">
                        <small>{t.civ}</small>
                        {favoriteCiv?.civImageUrl
                          ? <img src={favoriteCiv.civImageUrl} alt="" />
                          : <span className="player-profile-favorite-icon">⚔</span>}
                        <b>{favoriteCiv?.civName ?? t.noStats}</b>
                        {favoriteCiv && <strong>{percent(favoriteCiv.wins, favoriteCiv.games) ?? 0}% {t.winrate}</strong>}
                        {favoriteCiv && <small>{favoriteCiv.games} {t.ladderGames}</small>}
                      </div>
                      <div className="player-profile-favorite">
                        <small>{t.map}</small>
                        {favoriteMap?.mapImageUrl
                          ? <img src={favoriteMap.mapImageUrl} alt="" />
                          : <span className="player-profile-favorite-icon">🗺</span>}
                        <b>{favoriteMap?.mapName ?? t.noStats}</b>
                        {favoriteMap && <strong>{percent(favoriteMap.wins, favoriteMap.games) ?? 0}% {t.winrate}</strong>}
                        {favoriteMap && <small>{favoriteMap.games} {t.ladderGames}</small>}
                      </div>
                    </div>
                    <div className="player-profile-streak">
                      <small>{t.lastFive}</small>
                      <div className="player-profile-streak-dots">
                        {lastFive.length
                          ? lastFive.map((match, index) => <span key={index} className={match.won ? "won" : "lost"} title={match.won ? t.victory : t.defeat}/>)
                          : <span className="player-profile-no-streak">{t.noStats}</span>}
                        <b className={streak > 0 ? "positive" : streak < 0 ? "negative" : ""}>{streak > 0 ? `+${streak}` : streak}</b>
                      </div>
                    </div>
                    {ladder.active === false && ladder.lastMatchTime && <small className="player-profile-last-played">{t.lastPlayed}: {dateLabel(ladder.lastMatchTime, language)}</small>}
                  </article>
                );
              })}
            </div>

            {inactiveLeaderboards.length > 0 && (
              <button className="player-profile-inactive-toggle" onClick={() => setShowInactive((value) => !value)}>
                {showInactive ? t.hideInactive : t.showInactive} <span>{showInactive ? "⌃" : "⌄"}</span>
              </button>
            )}

            <div className="player-profile-recent-heading">
              <div><span className="eyebrow muted">MATCH HISTORY</span><h3>{t.recent}</h3></div>
              <span>{sortedMatches.length} {t.ladderGames}</span>
            </div>

            {sortedMatches.length === 0 && <p className="player-profile-empty">{t.noMatches}</p>}
            <div className="player-profile-match-list">
              {sortedMatches.slice(0, 20).map((match) => {
                const teams = new Map<number, MatchPlayer[]>();
                match.participants.forEach((player, index) => {
                  const key = player.teamId === null || player.teamId === undefined ? index : player.teamId;
                  teams.set(key, [...(teams.get(key) ?? []), player]);
                });
                const teamGroups = [...teams.entries()].map(([teamId, players]) => ({ teamId, players }));
                const outcome = match.result === "win" ? "win" : match.result === "loss" ? "loss" : "unknown";
                const resultLabel = outcome === "win" ? t.victory : outcome === "loss" ? t.defeat : t.unknown;

                return (
                  <article className="player-profile-match-card" key={match.id}>
                    <div className="player-profile-match-summary">
                      <div className="player-profile-map-badge"><Swords size={20}/></div>
                      <div className="player-profile-match-title">
                        <strong>{match.map}</strong>
                        <span>{match.gameModeName ?? match.leaderboardName ?? match.title}</span>
                        <small>{dateLabel(match.startedAt, language) ?? match.title}{durationLabel(match.durationSeconds) ? ` · ${durationLabel(match.durationSeconds)}` : ""}</small>
                      </div>
                      <span className={`player-profile-result ${outcome}`}>{resultLabel}</span>
                      <span className="player-profile-rating-delta">{ratingDelta(match.ratingChange) ?? "—"}</span>
                    </div>
                    <div className="player-profile-match-teams">
                      {teamGroups.map((team, teamIndex) => (
                        <div className="player-profile-match-team" key={team.teamId}>
                          {team.players.map((player) => (
                            <div className={`player-profile-match-player ${player.profileId === selectedProfileId ? "self" : ""}`} key={player.profileId}>
                              <button
                                onClick={() => player.profileId && player.profileId !== selectedProfileId && setSelectedProfileId(player.profileId)}
                                disabled={!player.profileId || player.profileId === selectedProfileId}
                                title={player.profileId ? `Open ${player.nickname} profile` : player.nickname}
                              >{player.nickname}</button>
                              <span>{player.civilizationName ?? ""}</span>
                              <small>{player.rating ?? "—"}{ratingDelta(player.ratingDiff) ? ` · ${ratingDelta(player.ratingDiff)}` : ""}</small>
                            </div>
                          ))}
                          {teamIndex === 0 && teamGroups.length > 1 && <span className="player-profile-versus">{t.vs}</span>}
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="player-profile-source-note">
              <Activity size={13}/> AoE II Companion · {t.updated} {dateLabel(data.updatedAt, language) ?? ""}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
