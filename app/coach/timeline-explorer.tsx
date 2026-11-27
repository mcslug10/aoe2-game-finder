"use client";

import { useMemo, useState } from "react";
import { Search, ListFilter } from "lucide-react";
import styles from "./timeline-explorer.module.css";

export type CoachEvent = {
  time: string | null;
  type: string;
  category?: string;
  detail: string | null;
  position?: { x: number; y: number } | null;
  selectedUnitCount?: number | null;
  playerName?: string | null;
  playerNumber?: number;
};

export default function TimelineExplorer({ events, label }: { events: CoachEvent[]; label?: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => Array.from(new Set(events.map((event) => event.category || "other"))).sort(), [events]);
  const filtered = useMemo(() => events.filter((event) => {
    const text = [event.time, event.type, event.category, event.detail, event.playerName, event.position ? `${event.position.x} ${event.position.y}` : ""].join(" ").toLocaleLowerCase();
    return (category === "all" || (event.category || "other") === category) && text.includes(query.trim().toLocaleLowerCase());
  }), [events, category, query]);
  return <div className={styles.explorer}>
    <div className={styles.tools}>
      <label className={styles.search}><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar unidade, comando ou horário…"/></label>
      <label className={styles.filter}><ListFilter size={14}/><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar categoria">
        <option value="all">Todas as categorias</option>{categories.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
      </select></label>
    </div>
    <div className={styles.count}>{label ? label + " · " : ""}{filtered.length} de {events.length} eventos</div>
    {filtered.length ? <div className={styles.rows}>{filtered.slice(0, 120).map((event, index) => <div className={styles.row} key={index}>
      <time>{event.time || "—"}</time><span className={styles.category}>{(event.category || "evento").replaceAll("_", " ")}</span>
      <b>{event.type}</b><span className={styles.detail}>{event.detail || "Sem detalhe"}{event.selectedUnitCount != null ? ` · ${event.selectedUnitCount} unidade(s)` : ""}{event.position ? ` · mapa (${event.position.x.toFixed(1)}, ${event.position.y.toFixed(1)})` : ""}</span>
    </div>)}</div> : <p className={styles.empty}>Nenhum evento corresponde ao filtro.</p>}
    {filtered.length > 120 && <p className={styles.count}>Mostrando os primeiros 120 resultados filtrados. Exporte o relatório para consultar todos os dados.</p>}
  </div>;
}