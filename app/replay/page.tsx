"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Camera, ChevronDown, FastForward, FileUp, Gauge, Maximize2, Pause, Play, Rewind, Search, SkipBack, SkipForward, Swords, Users, X } from "lucide-react";
import styles from "./replay.module.css";

type ViewMode = "game" | "spectator";
const players = [
  { id: 1, name: "Viper", civ: "Astecas", elo: 2248, color: "#d7a43d", team: 1, apm: 184, vill: 34, score: 4821, resources: [620, 210, 95, 40] },
  { id: 2, name: "Hera", civ: "Francos", elo: 2316, color: "#6f9fd4", team: 2, apm: 201, vill: 38, score: 5014, resources: [480, 160, 130, 55] },
];
const events = [
  { time: 0, label: "Início da partida", kind: "start" },
  { time: 255, label: "Primeiro avanço para Feudal", kind: "age" },
  { time: 492, label: "Primeiro contato no centro", kind: "battle" },
  { time: 716, label: "Ataque de arqueiros", kind: "battle" },
  { time: 1030, label: "Castelo construído", kind: "castle" },
  { time: 1370, label: "Ataque decisivo", kind: "battle" },
];
const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

function Battlefield({ time }: { time: number }) {
  const phase = Math.min(1, time / 1500);
  const units = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    x: 105 + ((i * 73 + Math.floor(time / 17) * (i % 3 + 1)) % 570),
    y: 65 + ((i * 47 + Math.floor(time / 23) * (i % 4 + 1)) % 340),
    blue: i % 2 === 0,
    type: i % 5 === 0 ? "villager" : i % 3 === 0 ? "horse" : "unit",
  })), [time]);
  return <svg className={styles.mapSvg} viewBox="0 0 780 470" role="img" aria-label="Mapa demonstrativo de uma partida de Age of Empires II">
    <defs>
      <pattern id="grass" width="42" height="42" patternUnits="userSpaceOnUse"><rect width="42" height="42" fill="#354b32"/><path d="M0 21L21 0 42 21 21 42Z" fill="#3d5838" opacity=".55"/><circle cx="8" cy="8" r="1.5" fill="#82935b" opacity=".5"/></pattern>
      <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M0 0L42 0 42 42" fill="none" stroke="#b2b58b" strokeOpacity=".12" strokeWidth="1"/></pattern>
      <linearGradient id="water" x2="1" y2="1"><stop stopColor="#355d66"/><stop offset="1" stopColor="#1c3d4a"/></linearGradient>
      <filter id="shadow"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <rect width="780" height="470" fill="url(#grass)"/>
    <path d="M0 0H215L255 72 198 132 120 119 0 164Z" fill="url(#water)" opacity=".94"/>
    <path d="M570 350L780 280V470H505Z" fill="url(#water)" opacity=".88"/>
    <path d="M0 0H215L255 72 198 132 120 119 0 164Z M570 350L780 280V470H505Z" fill="none" stroke="#7da2a0" strokeOpacity=".4" strokeWidth="5"/>
    <path d="M275 0L310 470M0 210L780 210M470 0L440 470" stroke="#c2b58b" strokeOpacity=".1" strokeWidth="2" strokeDasharray="3 8"/>
    <rect width="780" height="470" fill="url(#grid)"/>
    {Array.from({ length: 15 }, (_, i) => <g key={i} opacity=".82"><circle cx={35 + (i * 59) % 740} cy={25 + (i * 83) % 420} r="15" fill="#1d2c1d" filter="url(#shadow)"/><circle cx={35 + (i * 59) % 740} cy={25 + (i * 83) % 420} r="12" fill="#526b3b" stroke="#81905a" strokeWidth="2"/><path d={`M${35 + (i * 59) % 740} ${13 + (i * 83) % 420}l-5 16h10z`} fill="#738d4c"/></g>)}
    <g transform="translate(155 245)"><ellipse cx="0" cy="20" rx="42" ry="15" fill="#111" opacity=".3"/><path d="M-34 0L0 -27 34 0 0 28Z" fill="#9a7441" stroke="#e1bd7a" strokeWidth="2"/><path d="M-22 -5L0 -34 22 -5 0 13Z" fill="#bd965c"/><path d="M-9 -17L0 -34 9 -17" fill="#e2c18a"/><rect x="-5" y="-4" width="10" height="16" fill="#372b20"/></g>
    <g transform="translate(630 155)"><ellipse cx="0" cy="24" rx="43" ry="15" fill="#111" opacity=".3"/><path d="M-35 2L0 -25 35 2 0 30Z" fill="#526f91" stroke="#a8c4d9" strokeWidth="2"/><path d="M-23 -5L0 -33 23 -5 0 14Z" fill="#7897b3"/><path d="M-9 -17L0 -33 9 -17" fill="#d2d8d2"/><rect x="-5" y="-3" width="10" height="16" fill="#293747"/></g>
    {units.map((u, i) => <g key={i} transform={`translate(${u.x + (u.blue ? phase * 18 : -phase * 12)} ${u.y + Math.sin(time / 90 + i) * 3})`}><ellipse cy="5" rx="7" ry="3" fill="#10150f" opacity=".5"/><circle cy="-2" r={u.type === "horse" ? 6 : 4.5} fill={u.blue ? "#77a7d5" : "#e0ad4d"} stroke={u.blue ? "#d2e4f5" : "#ffdf94"} strokeWidth="1.5"/>{u.type === "horse" && <path d="M-6 -2l-4 -5 8 1" fill="none" stroke={u.blue ? "#9cc2e6" : "#f4c66c"} strokeWidth="2"/>}</g>)}
    <g transform="translate(390 232)"><circle r="35" fill="none" stroke="#f0d18c" strokeWidth="2" strokeDasharray="5 5" opacity=".7"/><path d="M-9 0H9M0 -9V9" stroke="#f0d18c" strokeWidth="2"/></g>
    <text x="18" y="28" fill="#e5dfc8" fontSize="11" letterSpacing="2">ARABIA · MAPA DEMONSTRATIVO</text>
    <text x="18" y="450" fill="#d6d0b8" fontSize="10">NORTE ↑</text>
  </svg>;
}

export default function ReplayPage() {
  const [mode, setMode] = useState<ViewMode>("game");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(492);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState(1);
  const [fileName, setFileName] = useState("");
  const duration = 1840;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setTime(v => v >= duration ? (setPlaying(false), duration) : Math.min(duration, v + speed * 2)), 1000);
    return () => window.clearInterval(timer);
  }, [playing, speed]);
  const activeEvent = [...events].reverse().find(e => time >= e.time);
  const jump = (seconds: number) => setTime(v => Math.max(0, Math.min(duration, v + seconds)));
  return <main className={styles.page}>
    <header className={styles.topbar}>
      <Link href="/" className={styles.brand}><span className={styles.brandMark}><Swords size={22}/></span><span>AOE2 <b>GAME FINDER</b><small>REPLAY CENTER</small></span></Link>
      <nav><Link href="/">Início</Link><Link href="/live">Partidas ao vivo</Link><Link href="/browser">Browser de partidas</Link><span className={styles.navActive}>Replay Player</span></nav>
      <Link href="/" className={styles.back}><ArrowLeft size={15}/> Voltar</Link>
    </header>
    <div className={styles.wrap}>
      <div className={styles.heading}><div><div className={styles.eyebrow}>CENTRAL DE REPLAYS · PREVIEW INTERATIVO</div><h1>ASSISTA. ANALISE. <em>APRENDA.</em></h1><p>Uma nova forma de rever cada decisão da batalha.</p></div><div className={styles.demoBadge}><span/> PARTIDA DEMONSTRATIVA</div></div>
      <section className={styles.matchBar}>
        <div className={styles.matchTitle}><span className={styles.matchIcon}><Swords size={19}/></span><div><small>RANKED · 1V1 · ARABIA</small><strong>Viper <i>VS</i> Hera</strong><span>Hoje · 00:30:40 · DE · Patch atual</span></div></div>
        <div className={styles.matchMeta}><div><small>MAPA</small><b>Arabia</b></div><div><small>DURAÇÃO</small><b>30:40</b></div><div><small>RESULTADO</small><b className={styles.gold}>Vitória · Hera</b></div></div>
        <button className={styles.uploadBtn} onClick={() => document.getElementById("replay-file")?.click()}><FileUp size={16}/> Abrir replay</button>
        <input id="replay-file" type="file" accept=".aoe2record" hidden onChange={e => setFileName(e.target.files?.[0]?.name || "")}/>
      </section>
      {fileName && <div className={styles.fileNotice}><FileUp size={15}/> Arquivo selecionado: <b>{fileName}</b><span>O leitor real de .aoe2record será conectado na próxima etapa do projeto.</span><button onClick={() => setFileName("")}><X size={14}/></button></div>}
      <div className={styles.modeRow}><div><span className={styles.sectionLabel}>EXPERIÊNCIA DE REPLAY</span><h2>Escolha como assistir</h2></div><div className={styles.modeSwitch}><button className={mode === "game" ? styles.modeActive : ""} onClick={() => setMode("game")}><Camera size={16}/> Modo Jogo</button><button className={mode === "spectator" ? styles.modeActive : ""} onClick={() => setMode("spectator")}><Activity size={16}/> Modo Espectador</button></div></div>
      <div className={styles.workspace}>
        <section className={styles.viewer}>
          <div className={styles.viewerHead}><div><span className={styles.liveDot}/> REPLAY EM {mode === "game" ? "VISÃO DE JOGO" : "VISÃO COMPETITIVA"}</div><div className={styles.viewerActions}><span>{fmt(time)} / {fmt(duration)}</span><button aria-label="Tela cheia"><Maximize2 size={15}/></button></div></div>
          {mode === "game" ? <div className={styles.mapFrame}><Battlefield time={time}/><div className={styles.mapOverlay}><span>ARABIA</span><span>IDADE DOS CASTELOS</span></div><div className={styles.mapLegend}><span><i className={styles.goldDot}/> Viper</span><span><i className={styles.blueDot}/> Hera</span></div></div> : <div className={styles.spectatorView}>
            <div className={styles.scoreStrip}><div className={styles.teamGold}><small>TIME 1 · ASTECAS</small><strong>Viper</strong><b>2.248 ELO</b><span>4.821 pontos</span></div><div className={styles.vs}>VS</div><div className={styles.teamBlue}><small>TIME 2 · FRANCOS</small><strong>Hera</strong><b>2.316 ELO</b><span>5.014 pontos</span></div></div>
            <div className={styles.spectatorStats}><div><small>IDADE ATUAL</small><b>{time < 255 ? "Alta Idade" : time < 1030 ? "Feudal / Castelos" : "Castelos"}</b></div><div><small>EVENTO ATUAL</small><b>{activeEvent?.label}</b></div><div><small>TEMPO DE JOGO</small><b>{fmt(time)}</b></div></div>
            <div className={styles.spectatorMap}><Battlefield time={time}/><span>VISUALIZAÇÃO TÁTICA · MAPA SIMPLIFICADO</span></div>
          </div>}
          <div className={styles.timeline}><div className={styles.timelineMarks}>{events.map(e => <button key={e.time} title={e.label} style={{ left: `${e.time / duration * 100}%` }} onClick={() => setTime(e.time)} className={styles.eventMark}/>)}</div><input aria-label="Linha do tempo do replay" type="range" min="0" max={duration} value={time} onChange={e => setTime(Number(e.target.value))}/><div className={styles.timelineLabels}><span>00:00</span><span>FEUDAL</span><span>PRIMEIRO CONTATO</span><span>CASTELO</span><span>30:40</span></div></div>
          <div className={styles.controls}><div className={styles.transport}><button onClick={() => jump(-30)} title="Voltar 30 segundos"><Rewind size={17}/></button><button onClick={() => jump(-5)} title="Voltar 5 segundos"><SkipBack size={17}/></button><button className={styles.playButton} onClick={() => setPlaying(v => !v)}>{playing ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button><button onClick={() => jump(5)} title="Avançar 5 segundos"><SkipForward size={17}/></button><button onClick={() => jump(30)} title="Avançar 30 segundos"><FastForward size={17}/></button></div><div className={styles.speed}><Gauge size={15}/><span>VELOCIDADE</span>{[1,2,4,8,16].map(v => <button key={v} className={speed === v ? styles.speedActive : ""} onClick={() => setSpeed(v)}>{v}x</button>)}</div></div>
        </section>
        <aside className={styles.sidebar}>
          <div className={styles.sideHead}><div><span className={styles.sectionLabel}>PLACAR DA PARTIDA</span><h3>Jogadores</h3></div><Users size={18}/></div>
          {players.map(p => <button key={p.id} onClick={() => setSelected(p.id)} className={`${styles.playerCard} ${selected === p.id ? styles.playerSelected : ""}`}><span className={styles.playerStripe} style={{ background: p.color }}/><span className={styles.playerInfo}><b>{p.name}</b><small>{p.civ} · {p.elo} ELO</small></span><span className={styles.playerScore}>{p.score.toLocaleString("pt-BR")}<small>PONTOS</small></span></button>)}
          <div className={styles.statBlock}><div className={styles.sideHead}><h3>Estatísticas</h3><ChevronDown size={15}/></div><div className={styles.statGrid}><div><small>APM</small><b>{players.find(p => p.id === selected)?.apm}</b></div><div><small>ALDEÕES</small><b>{players.find(p => p.id === selected)?.vill}</b></div><div><small>RECURSOS</small><b>1.245</b></div><div><small>POPULAÇÃO</small><b>68 / 120</b></div></div><div className={styles.resources}><div><i/> Madeira <b>620</b></div><div><i/> Comida <b>480</b></div><div><i/> Ouro <b>210</b></div><div><i/> Pedra <b>95</b></div></div></div>
          <div className={styles.events}><div className={styles.sideHead}><h3>Momentos-chave</h3><span>{events.length} eventos</span></div>{events.map(e => <button key={e.time} onClick={() => setTime(e.time)} className={time >= e.time && (events.findLastIndex(x => x.time <= time) === events.indexOf(e)) ? styles.eventCurrent : ""}><span>{fmt(e.time)}</span><i className={styles.eventBullet}/><b>{e.label}</b></button>)}</div>
        </aside>
      </div>
      <div className={styles.bottomNote}><Swords size={17}/><div><b>Este é um preview visual interativo.</b><span>Os controles, alternância de modos, seleção de jogador e linha do tempo já demonstram a experiência. A leitura e reconstrução de partidas reais a partir do arquivo .aoe2record será conectada na próxima etapa.</span></div></div>
    </div>
  </main>;
}
