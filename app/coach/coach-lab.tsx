"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, Check, Clipboard, Download, Flame, Flag, History, ListChecks, Pause, Play, Search, Share2, Star, Timer, X } from "lucide-react";
import styles from "./coach-lab.module.css";

type Tip = { severity: "high" | "medium" | "positive"; time: string | null; title: string; detail: string; action: string };
type EventRow = { time: string | null; timeSeconds?: number | null; type: string; category?: string; detail: string | null; playerName?: string | null; position?: {x:number;y:number}|null };
type CoachData = {
  fileName: string; map: string | null; durationSeconds: number;
  selectedPlayer: { name: string; civilization: string | null };
  metrics: { eapm: number | null; apm: number | null; actionCount: number; movementCommands: number; villagerQueueCommands: number; militaryQueueCommands: number };
  evaluation?: { overallScore: number | null; overallLabel: string; tips: Tip[]; strengths: string[] };
  timeline: EventRow[];
  opponentTimeline?: EventRow[];
};
type Saved = { id: string; name: string; map: string; date: string; score: number | null; eapm: number | null; apm: number | null; actionCount: number };
const severityRank = (s: Tip["severity"]) => s === "high" ? 0 : s === "medium" ? 1 : 2;
const stamp = (v: string | null) => v || "—";
const download = (name: string, body: string, type = "text/plain;charset=utf-8") => {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};

export default function CoachLab({ report }: { report: CoachData }) {
  const tips = report.evaluation?.tips ?? [];
  const events = report.timeline ?? [];
  const player = report.selectedPlayer?.name || "Jogador";
  const id = [player, report.fileName, report.map, report.durationSeconds].join("|");
  const key = "aoe2-coach-lab-v1:" + id;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [stars, setStars] = useState<string[]>([]);
  const [focus, setFocus] = useState(tips[0]?.title ?? "");
  const [minutes, setMinutes] = useState(30);
  const [done, setDone] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [eventQuery, setEventQuery] = useState("");
  const [eventCategory, setEventCategory] = useState("all");
  const [phase, setPhase] = useState("all");
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [prior, setPrior] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const v = JSON.parse(raw);
        setStars(v.stars ?? []); setDone(v.done ?? []); setNote(v.note ?? "");
        setBookmarks(v.bookmarks ?? []); setFocus(v.focus ?? tips[0]?.title ?? "");
        setMinutes(v.minutes ?? 30);
      }
      const history = JSON.parse(localStorage.getItem("aoe2-coach-history-v1") || "[]") as Saved[];
      const current: Saved = { id, name: player, map: report.map || "Mapa desconhecido", date: new Date().toISOString(), score: report.evaluation?.overallScore ?? null, eapm: report.metrics.eapm, apm: report.metrics.apm, actionCount: report.metrics.actionCount };
      const updated = [current, ...history.filter((item) => item.id !== id)].slice(0, 12);
      localStorage.setItem("aoe2-coach-history-v1", JSON.stringify(updated)); setSaved(updated);
    } catch { /* armazenamento local pode estar desativado */ }
  // Snapshot is intentionally loaded once per analyzed replay.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ stars, done, note, bookmarks, focus, minutes })); } catch {}
  }, [key, stars, done, note, bookmarks, focus, minutes]);

  useEffect(() => {
    if (!timerRunning || timer <= 0) return;
    const interval = window.setInterval(() => setTimer((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, timer > 0]);

  const visibleTips = useMemo(() => tips.filter((tip) => {
    const text = [tip.title, tip.detail, tip.action, tip.time].join(" ").toLocaleLowerCase();
    return (filter === "all" || tip.severity === filter) && text.includes(query.toLocaleLowerCase().trim());
  }).sort((a,b) => severityRank(a.severity) - severityRank(b.severity)), [tips, filter, query]);

  const categories = useMemo(() => Array.from(new Set(events.map((e) => e.category || "other"))).sort(), [events]);
  const visibleEvents = useMemo(() => events.filter((event) => {
    const sec = event.timeSeconds ?? 0;
    const fraction = report.durationSeconds ? sec / report.durationSeconds : 0;
    const phaseMatch = phase === "all" || (phase === "early" ? fraction < .25 : phase === "mid" ? fraction >= .25 && fraction < .65 : fraction >= .65);
    const text = [event.time,event.type,event.category,event.detail,event.playerName,event.position ? event.position.x+" "+event.position.y : ""].join(" ").toLocaleLowerCase();
    return phaseMatch && (eventCategory === "all" || (event.category || "other") === eventCategory) && text.includes(eventQuery.toLocaleLowerCase().trim());
  }), [events, report.durationSeconds, phase, eventCategory, eventQuery]);

  const tasks = useMemo(() => [
    { id: "warm", title: "Aquecimento de execução", detail: "5 min: repetir o início da build sem pausar." },
    { id: "focus", title: "Treinar foco principal", detail: focus || "Escolha uma recomendação do relatório." },
    ...tips.filter((t) => t.severity !== "positive").slice(0, 4).map((t,i) => ({ id: "tip-"+i, title: t.title, detail: t.action })),
    { id: "review", title: "Revisar o replay", detail: "Voltar aos momentos marcados e explicar a decisão." },
  ], [focus, tips]);
  const completed = tasks.filter((t) => done.includes(t.id)).length;
  const formatTimer = (sec: number) => Math.floor(sec/60).toString().padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
  const reportText = [
    "# AoE2 Coach — relatório pessoal", `Jogador: ${player}`, `Mapa: ${report.map || "não identificado"}`,
    `Pontuação experimental: ${report.evaluation?.overallScore ?? "N/A"}`, `eAPM: ${report.metrics.eapm ?? "N/A"} · APM: ${report.metrics.apm ?? "N/A"}`,
    "## Prioridades", ...tips.map((t) => `- [${t.severity}] ${t.time || "geral"} — ${t.title}: ${t.action}`),
    "## Pontos fortes", ...(report.evaluation?.strengths ?? []).map((s) => "- "+s),
    "## Notas pessoais", note || "Nenhuma nota registrada",
    "## Treino", `Foco: ${focus || "não definido"} · duração: ${minutes} min · progresso: ${completed}/${tasks.length}`,
  ].join("\n");

  async function share() {
    if (navigator.share) { try { await navigator.share({ title: "AoE2 Coach — "+player, text: reportText }); return; } catch {} }
    await navigator.clipboard.writeText(reportText);
  }
  function addBookmark(event: EventRow) {
    const value = (event.time || "—")+" · "+(event.type || "evento");
    setBookmarks((current) => current.includes(value) ? current.filter((x) => x !== value) : [...current, value]);
  }

  return <section className={styles.lab}>
    <header className={styles.head}><div><span className={styles.kicker}>CENTRAL DE TREINO · 20 FERRAMENTAS</span><h2>Transforme análise em evolução</h2><p>Recursos pessoais para revisar, praticar e acompanhar suas partidas. Preferências e notas ficam neste navegador.</p></div><span className={styles.badge}><Flame size={15}/> Coach Lab</span></header>
    <div className={styles.featureGrid}>
      <article className={styles.card}><div className={styles.cardTitle}><Search/><h3>01 · Busca de dicas</h3></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar erro, unidade ou recomendação"/></article>
      <article className={styles.card}><div className={styles.cardTitle}><ListChecks/><h3>02 · Filtro de prioridade</h3></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas as dicas</option><option value="high">Alta prioridade</option><option value="medium">Atenção</option><option value="positive">Pontos positivos</option></select><small>{visibleTips.length} dicas correspondentes</small></article>
      <article className={styles.card}><div className={styles.cardTitle}><Star/><h3>03 · Dicas favoritas</h3></div><p>{stars.length} marcadas para rever.</p><button onClick={()=>setFilter("all")}>Mostrar lista completa</button></article>
      <article className={styles.card}><div className={styles.cardTitle}><Flag/><h3>04 · Foco da sessão</h3></div><select value={focus} onChange={e=>setFocus(e.target.value)}><option value="">Escolha uma meta</option>{tips.map((t,i)=><option key={i} value={t.title}>{t.title}</option>)}</select></article>
      <article className={styles.card}><div className={styles.cardTitle}><Timer/><h3>05 · Duração do treino</h3></div><div className={styles.chips}>{[15,30,45,60].map(n=><button className={minutes===n?styles.active:""} key={n} onClick={()=>setMinutes(n)}>{n} min</button>)}</div></article>
      <article className={styles.card}><div className={styles.cardTitle}><Check/><h3>06 · Checklist prática</h3></div><p>{completed}/{tasks.length} etapas concluídas</p><div className={styles.progress}><span style={{width:completed/tasks.length*100+"%"}}/></div></article>
      <article className={styles.card}><div className={styles.cardTitle}><Play/><h3>07 · Cronômetro</h3></div><strong className={styles.timer}>{formatTimer(timer || minutes*60)}</strong><div className={styles.chips}><button onClick={()=>{if(!timer)setTimer(minutes*60);setTimerRunning(v=>!v)}}>{timerRunning?<Pause size={14}/>:<Play size={14}/>} {timerRunning?"Pausar":"Iniciar"}</button><button onClick={()=>{setTimer(0);setTimerRunning(false)}}><X size={14}/> Reset</button></div></article>
      <article className={styles.card}><div className={styles.cardTitle}><Clipboard/><h3>08 · Caderno de treino</h3></div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Anote o que percebeu, sua decisão e o que fará diferente…"/><small>Salvo automaticamente no navegador</small></article>
      <article className={styles.card}><div className={styles.cardTitle}><Bookmark/><h3>09 · Momentos salvos</h3></div><p>{bookmarks.length} momentos favoritos</p>{bookmarks.slice(-3).map((b,i)=><small key={i}>{b}</small>)}</article>
      <article className={styles.card}><div className={styles.cardTitle}><Search/><h3>10 · Pesquisa da timeline</h3></div><input value={eventQuery} onChange={e=>setEventQuery(e.target.value)} placeholder="Ex.: move, attack, villager"/></article>
      <article className={styles.card}><div className={styles.cardTitle}><ListChecks/><h3>11 · Categorias de evento</h3></div><select value={eventCategory} onChange={e=>setEventCategory(e.target.value)}><option value="all">Todas</option>{categories.map(c=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}</select><small>{visibleEvents.length} eventos visíveis</small></article>
      <article className={styles.card}><div className={styles.cardTitle}><Timer/><h3>12 · Fases da partida</h3></div><div className={styles.chips}>{[["all","Tudo"],["early","Início"],["mid","Meio"],["late","Final"]].map(([v,l])=><button className={phase===v?styles.active:""} key={v} onClick={()=>setPhase(v)}>{l}</button>)}</div></article>
      <article className={styles.card}><div className={styles.cardTitle}><History/><h3>13 · Histórico local</h3></div><p>{saved.length} análises recentes neste navegador.</p><select value={prior} onChange={e=>setPrior(e.target.value)}><option value="">Comparar com partida anterior</option>{saved.slice(1).map(s=><option key={s.id} value={s.id}>{s.date.slice(0,10)} · {s.map} · eAPM {s.eapm??"—"}</option>)}</select></article>
      <article className={styles.card}><div className={styles.cardTitle}><Download/><h3>14 · Exportar relatório</h3></div><button onClick={()=>download("aoe2-coach-notas.md",reportText)}>Baixar Markdown</button></article>
      <article className={styles.card}><div className={styles.cardTitle}><Download/><h3>15 · Exportar eventos CSV</h3></div><button onClick={()=>download("aoe2-coach-eventos.csv",["tempo,categoria,tipo,detalhe",...events.map(e=>[e.time,e.category,e.type,e.detail].map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(","))].join("\n"),"text/csv;charset=utf-8")}>Baixar CSV</button></article>
      <article className={styles.card}><div className={styles.cardTitle}><Download/><h3>16 · Backup JSON</h3></div><button onClick={()=>download("aoe2-coach-eventos.json",JSON.stringify(events,null,2),"application/json")}>Salvar timeline</button></article>
      <article className={styles.card}><div className={styles.cardTitle}><Share2/><h3>17 · Compartilhar resumo</h3></div><button onClick={()=>void share()}><Share2 size={14}/> Compartilhar / copiar</button></article>
      <article className={styles.card}><div className={styles.cardTitle}><Flag/><h3>18 · Meta mensurável</h3></div><p>{focus? "Meta: "+focus:"Escolha uma recomendação como meta."}</p><small>Revise o mesmo objetivo em seu próximo replay.</small></article>
      <article className={styles.card}><div className={styles.cardTitle}><Check/><h3>19 · Registro de conclusão</h3></div><button onClick={()=>setDone(tasks.map(t=>t.id))}>Marcar treino completo</button><button onClick={()=>setDone([])}>Recomeçar checklist</button></article>
      <article className={styles.card}><div className={styles.cardTitle}><History/><h3>20 · Comparação pessoal</h3></div>{prior?(()=>{const old=saved.find(s=>s.id===prior);return old?<div className={styles.compare}><span>eAPM: {old.eapm??"—"} → {report.metrics.eapm??"—"}</span><span>APM: {old.apm??"—"} → {report.metrics.apm??"—"}</span><span>Ações: {old.actionCount} → {report.metrics.actionCount}</span></div>:<p>Registro não encontrado.</p>})():<p>Selecione uma partida anterior para ver a comparação.</p>}</article>
    </div>
    <div className={styles.tipList}><div className={styles.sectionTitle}><h3>Suas recomendações filtradas</h3><span>{visibleTips.length}</span></div>{visibleTips.slice(0,12).map((tip,i)=><article key={i} className={styles.tip}><div><span className={styles.severity}>{tip.severity==="high"?"URGENTE":tip.severity==="medium"?"REVISAR":"POSITIVO"}</span><h4>{tip.title}</h4><small>{stamp(tip.time)}</small><p>{tip.detail}</p><b>Treino sugerido: {tip.action}</b></div><button aria-label="Favoritar dica" className={stars.includes(tip.title)?styles.starred:""} onClick={()=>setStars(v=>v.includes(tip.title)?v.filter(x=>x!==tip.title):[...v,tip.title])}><Star size={17}/></button></article>)}</div>
    <div className={styles.tipList}><div className={styles.sectionTitle}><h3>Eventos da timeline</h3><span>{visibleEvents.length}</span></div>{visibleEvents.slice(0,30).map((event,i)=><div className={styles.event} key={i}><time>{stamp(event.time)}</time><span>{event.category||"evento"}</span><b>{event.type}</b><small>{event.detail||"Sem detalhes registrados"}</small><button onClick={()=>addBookmark(event)}><Bookmark size={14}/>{bookmarks.includes((event.time||"—")+" · "+(event.type||"evento"))?"Salvo":"Marcar"}</button></div>)}</div>
    <footer className={styles.footer}>O histórico e as anotações são locais neste dispositivo. Métricas e eventos refletem apenas os dados que o parser encontrou no replay.</footer>
  </section>;
}
