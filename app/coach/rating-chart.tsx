"use client";

import { useMemo, useState } from "react";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import type { RatingHistory, RatingHistoryPoint, RatingHistorySeries } from "@/lib/aoe2-coach-ratings";

type ChartSeries = {
  id: "x1" | "tg";
  label: string;
  colorClass: string;
  data: RatingHistoryPoint[];
  current: number | null;
  best: number | null;
  change: number | null;
};

function formatDate(value: string, withYear = false) {
  return new Date(value).toLocaleDateString("pt-BR", withYear
    ? { day: "2-digit", month: "2-digit", year: "2-digit" }
    : { day: "2-digit", month: "2-digit" });
}

function seriesData(
  id: ChartSeries["id"],
  label: string,
  colorClass: string,
  series: RatingHistorySeries,
  range: number,
): ChartSeries {
  const data = series.points.slice(-range);
  return {
    id, label, colorClass, data,
    current: data.length ? data[data.length - 1].rating : null,
    best: data.length ? Math.max(...data.map((point) => point.rating)) : null,
    change: data.length >= 2 ? data[data.length - 1].rating - data[0].rating : null,
  };
}

export default function RatingHistoryChart({ history }: { history: RatingHistory }) {
  const [range, setRange] = useState(60);
  const series = useMemo(() => [
    seriesData("x1", "X1 · 1v1 Random Map", "x1", history.oneVsOne, range),
    seriesData("tg", "TG · Team Random Map", "tg", history.teamGames, range),
  ], [history, range]);

  const points = series.flatMap((item) => item.data);
  if (!points.length) {
    return <section className="panel coach-rating-panel">
      <div className="coach-section-heading">
        <div className="coach-icon"><Activity size={20}/></div>
        <div><h2>Rating ao longo do tempo</h2><p>Evolução das filas ranqueadas X1 e TG.</p></div>
      </div>
      <div className="coach-rating-empty">Ainda não há histórico de rating disponível para este perfil nas filas X1 ou TG.</div>
    </section>;
  }

  const times = points.map((point) => new Date(point.date).getTime()).filter(Number.isFinite);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const minRating = Math.min(...points.map((point) => point.rating));
  const maxRating = Math.max(...points.map((point) => point.rating));
  const yMin = Math.floor((minRating - 50) / 50) * 50;
  const yMax = Math.ceil((maxRating + 50) / 50) * 50 || yMin + 100;
  const left = 58;
  const right = 820;
  const top = 18;
  const bottom = 226;
  const xFor = (date: string) => maxTime === minTime
    ? (left + right) / 2
    : left + ((new Date(date).getTime() - minTime) / (maxTime - minTime)) * (right - left);
  const yFor = (rating: number) => bottom - ((rating - yMin) / Math.max(1, yMax - yMin)) * (bottom - top);
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + (yMax - yMin) * index / 4);
  const xTicks = Array.from({ length: 5 }, (_, index) => minTime + (maxTime - minTime) * index / 4);
  const currentX1 = series[0].current;
  const currentTg = series[1].current;
  const totalPoints = series.reduce((sum, item) => sum + item.data.length, 0);

  return <section className="panel coach-rating-panel">
    <div className="coach-rating-heading">
      <div className="coach-section-heading">
        <div className="coach-icon"><Activity size={20}/></div>
        <div><h2>Rating ao longo do tempo</h2><p>Histórico das filas ranqueadas, com uma linha para X1 e outra para Team Games.</p></div>
      </div>
      <div className="coach-rating-range" role="group" aria-label="Quantidade de partidas exibidas">
        {[30, 60, 100].map((value) => <button
          key={value}
          type="button"
          className={range === value ? "active" : ""}
          onClick={() => setRange(value)}
          aria-pressed={range === value}
        >{value} jogos</button>)}
      </div>
    </div>

    <div className="coach-rating-current">
      {series.map((item) => <div className={"coach-rating-stat " + item.colorClass} key={item.id}>
        <span><i/> {item.label}</span>
        <strong>{item.current ?? "—"}</strong>
        <small>
          {item.change === null ? "Histórico insuficiente" : (item.change > 0 ? "+" : "") + item.change + " pontos no período"}
          {item.best !== null ? " · Máximo " + item.best : ""}
        </small>
      </div>)}
    </div>

    <div className="coach-rating-chart-wrap">
      <svg className="coach-rating-svg" viewBox="0 0 850 270" role="img" aria-label="Gráfico de evolução histórica do rating em partidas X1 e Team Games">
        {yTicks.map((tick, index) => <g key={"y"+index}>
          <line x1={left} y1={yFor(tick)} x2={right} y2={yFor(tick)} className="coach-rating-gridline"/>
          <text x={left - 10} y={yFor(tick) + 4} textAnchor="end" className="coach-rating-axis-label">{Math.round(tick)}</text>
        </g>)}
        {xTicks.map((tick, index) => <g key={"x"+index}>
          <line x1={left + (right-left)*index/4} y1={top} x2={left + (right-left)*index/4} y2={bottom} className="coach-rating-gridline vertical"/>
          <text x={left + (right-left)*index/4} y={bottom + 24} textAnchor="middle" className="coach-rating-axis-label">{formatDate(new Date(tick).toISOString())}</text>
        </g>)}
        <line x1={left} y1={bottom} x2={right} y2={bottom} className="coach-rating-axis"/>
        {series.map((item) => {
          const coordinates = item.data.map((point) => [xFor(point.date), yFor(point.rating)] as [number, number]);
          return <g key={item.id} className={"coach-rating-line " + item.colorClass}>
            {coordinates.length > 1 && <polyline points={coordinates.map(([x,y]) => x+","+y).join(" ")} />}
            {item.data.map((point,index) => <circle key={point.date+"-"+index} cx={coordinates[index][0]} cy={coordinates[index][1]} r={coordinates.length > 45 ? 2.1 : 3.1}>
              <title>{item.label} · {formatDate(point.date,true)} · {point.rating} Elo{point.ratingDiff !== null ? " · "+(point.ratingDiff>0?"+":"")+point.ratingDiff : ""}</title>
            </circle>)}
          </g>;
        })}
      </svg>
    </div>

    <div className="coach-rating-legend">
      <span className="x1"><i/> X1 · 1v1 Random Map</span>
      <span className="tg"><i/> TG · Team Random Map</span>
      <small>{totalPoints} registros exibidos · até {range} jogos por modalidade</small>
    </div>
    <p className="coach-footnote">Cada ponto representa o rating registrado após uma partida. Os históricos X1 e TG são independentes; o gráfico usa a data real de cada registro. Fonte: AoE II Companion.</p>
  </section>;
}
