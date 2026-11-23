"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import styles from "./steam-player-count.module.css";
import { liveText, type LiveLocale } from "./translations";

type SteamCountResponse = {
  playerCount?: number;
  updatedAt?: string;
  error?: string;
};

function formatClock(value: string | null, locale: LiveLocale) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString(locale === "pt" ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function SteamPlayerCount({ locale }: { locale: LiveLocale }) {
  const t = liveText[locale];
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let requestInProgress = false;

    const refresh = async () => {
      if (requestInProgress) return;
      requestInProgress = true;
      try {
        const response = await fetch("/api/steam/players", { cache: "no-store" });
        const data = await response.json() as SteamCountResponse;
        if (!response.ok || typeof data.playerCount !== "number" || !Number.isFinite(data.playerCount)) {
          throw new Error(data.error ?? t.steamUnavailable);
        }
        if (active) {
          setPlayerCount(data.playerCount);
          setUpdatedAt(data.updatedAt ?? new Date().toISOString());
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        requestInProgress = false;
        if (active) setLoading(false);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [locale]);

  const title = error && playerCount === null
    ? t.steamUnavailableTitle
    : t.steamTitle;

  return (
    <a
      className={styles.counter}
      href="https://steamdb.info/app/813780/"
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={playerCount === null
        ? t.steamCountUnavailable
        : playerCount.toLocaleString(locale === "pt" ? "pt-BR" : "en-US") + " " + t.steamPlayersOnline}
    >
      <span className={styles.icon}><Users size={17} /></span>
      <span className={styles.copy}>
        <span className={styles.label}>{t.steamLabel.toUpperCase()}</span>
        <strong>{playerCount === null ? (loading ? "..." : "—") : playerCount.toLocaleString(locale === "pt" ? "pt-BR" : "en-US")}</strong>
        <small>{error ? t.steamUnavailable.toUpperCase() : updatedAt ? t.steamUpdatedAt.toUpperCase() + " " + formatClock(updatedAt, locale) : t.steamLive60s.toUpperCase()}</small>
      </span>
      <span className={error ? styles.statusOff : styles.statusOn} />
    </a>
  );
}
