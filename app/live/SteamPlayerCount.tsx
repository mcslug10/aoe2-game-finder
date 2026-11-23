"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import styles from "./steam-player-count.module.css";

type SteamCountResponse = {
  playerCount?: number;
  updatedAt?: string;
  error?: string;
};

function formatClock(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function SteamPlayerCount() {
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
          throw new Error(data.error ?? "Contagem indisponível");
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
  }, []);

  const title = error && playerCount === null
    ? "Não foi possível consultar os jogadores online da Steam"
    : "Jogadores atualmente ativos na Steam. Atualização automática a cada 60 segundos.";

  return (
    <a
      className={styles.counter}
      href="https://steamdb.info/app/813780/"
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={playerCount === null
        ? "Quantidade de jogadores online na Steam indisponível"
        : playerCount.toLocaleString("pt-BR") + " jogadores online na Steam"}
    >
      <span className={styles.icon}><Users size={17} /></span>
      <span className={styles.copy}>
        <span className={styles.label}>JOGADORES NA STEAM</span>
        <strong>{playerCount === null ? (loading ? "..." : "—") : playerCount.toLocaleString("pt-BR")}</strong>
        <small>{error ? "DADOS INDISPONÍVEIS" : updatedAt ? "ATUALIZADO ÀS " + formatClock(updatedAt) : "AO VIVO · 60S"}</small>
      </span>
      <span className={error ? styles.statusOff : styles.statusOn} />
    </a>
  );
}
