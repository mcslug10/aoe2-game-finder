"use client";

import { useState } from "react";
import Link from "next/link";
import RatingHistoryChart from "./rating-chart";
import type { RatingHistory } from "@/lib/aoe2-coach-ratings";
import {
  Activity, AlertTriangle, ArrowLeft, BookOpen, CalendarDays, Castle,
  CheckCircle2, Clock3, FileVideo, Gauge, Medal, Search, Swords, Target, ShieldCheck,
  Upload, Users, Zap,
} from "lucide-react";

type Profile = { profile_id: number; alias: string; name?: string; country?: string; level?: number; games?: number };
type Match = {
  id: string; title: string; map: string; mapRaw: string; gameTypeId: number | null;
  playerCount: number; startedAt: string | null; completedAt: string | null;
  durationSeconds: number | null; result: "win" | "loss" | "unknown";
  civilizationId: number | null; civilizationName?: string | null; ratingBefore: number | null; ratingAfter: number | null;
  ratingChange: number | null; participants: Array<{profileId:number;nickname:string;country:string|null;civilizationId:number|null;teamId:number|null;won:boolean}>;
  includesPlayer: boolean;
};
type Report = {
  fileName: string; parser: string; parserVersion: string; map: string | null; gameType: string | null;
  completed: boolean; rated: boolean | null; durationSeconds: number;
  selectedPlayer: {number:number;name:string;civilization:string|null;winner:boolean|null;eapm:number|null;profileId:number|null;teamId:number|null};
  metrics: {durationSeconds:number;actionCount:number;apm:number|null;eapm:number|null;villagerQueueCommands:number;militaryQueueCommands:number;buildingCommands:number;researchCommands:number};
  ageUps: Array<{age:string;timeSeconds:number|null;time:string|null}>;
  timeline: Array<{timeSeconds:number|null;time:string|null;type:string;detail:string|null}>;
  insights: {positives:Array<{title:string;detail:string}>;review:Array<{title:string;detail:string}>};
  limitations: string[];
  evaluation?: {
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
    categories: Array<{
      id: string;
      title: string;
      score: number | null;
      max: number;
      reason: string;
      status: "scored" | "not_applicable" | "insufficient_data";
    }>;
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
    tips: Array<{
      severity: "high" | "medium" | "positive";
      time: string | null;
      title: string;
      detail: string;
      action: string;
    }>;
    benchmark: {
      applicable: boolean;
      note: string;
      feudalTime: string | null;
      targetFeudalTime: string | null;
    };
  };
};
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" }) : "Data indisponível";
const durationLabel = (value: number | null) => {
  if (value == null) return "—";
  const total = Math.max(0, Math.floor(value));
  return String(Math.floor(total / 60)) + "m " + String(total % 60).padStart(2,"0") + "s";
};

export default function CoachPage() {
  const [nickname, setNickname] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistory | null>(null);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [ratingsError, setRatingsError] = useState("");
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [busyMatchId, setBusyMatchId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function searchPlayer() {
    const clean = nickname.trim();
    if (clean.length < 3) { setError("Digite o nickname exato usado dentro do Age of Empires II (mínimo 3 caracteres)."); return; }
    setError(""); setNotice(""); setReport(null); setMatches([]); setProfile(null); setRatingHistory(null); setRatingsError(""); setLoadingPlayer(true);
    try {
      const response = await fetch("/api/coach/player?nickname=" + encodeURIComponent(clean), { cache:"no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível localizar o jogador.");
      const found = (data.profiles ?? []) as Profile[];
      setProfiles(found);
      if (found.length === 1) await chooseProfile(found[0]);
      else setNotice("Encontramos mais de um perfil. Selecione o jogador correto abaixo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na busca do jogador.");
    } finally { setLoadingPlayer(false); }
  }

  async function chooseProfile(selected: Profile) {
    setProfile(selected); setProfiles([]); setMatches([]); setReport(null); setError(""); setNotice(""); setLoadingMatches(true);
    try {
      const response = await fetch("/api/coach/matches?profileId=" + selected.profile_id, { cache:"no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o histórico.");
      setMatches(data.matches ?? []);
      if (!(data.matches ?? []).length) setNotice("O perfil foi encontrado, mas a API não retornou partidas recentes concluídas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar partidas.");
    } finally { setLoadingMatches(false); }
  }

  async function analyzeMatch(match: Match) {
    if (!profile) return;
    setBusyMatchId(match.id); setError(""); setNotice(""); setReport(null);
    try {
      const response = await fetch("/api/coach/analyze-replay", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ profileId:profile.profile_id, matchId:match.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível obter ou analisar o replay.");
      setReport(data.report);
      setNotice("Replay baixado e analisado. Confira os indicadores e a linha do tempo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao analisar a partida.");
    } finally { setBusyMatchId(""); }
  }

  async function uploadReplay(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".aoe2record") && !file.name.toLowerCase().endsWith(".zip")) {
      setError("Envie um arquivo .aoe2record ou ZIP contendo o replay."); return;
    }
    setUploading(true); setError(""); setNotice(""); setReport(null);
    try {
      const ticketResponse = await fetch("/api/coach/upload-token", { cache:"no-store" });
      const ticket = await ticketResponse.json();
      if (!ticketResponse.ok) throw new Error(ticket.error || "Não foi possível autorizar o envio.");
      const form = new FormData();
      form.append("file", file);
      if (profile?.profile_id) form.append("profile_id", String(profile.profile_id));
      const response = await fetch(ticket.serviceUrl + "/analyze", {
        method:"POST", headers:{ Authorization:"Bearer " + ticket.token }, body:form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "O parser não conseguiu ler esse replay.");
      setReport(data); setNotice("Replay enviado e analisado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar o replay.");
    } finally { setUploading(false); }
  }

  return <main className="shell browser-page coach-page">
    <header className="topbar browser-topbar">
      <Link className="brand" href="/"><span className="brand-mark"><Castle size={23}/></span><span>AOE2 <b>GAME FINDER</b><small>THE COMMUNITY MATCH HUB</small></span></Link>
      <Link className="browser-back" href="/"><ArrowLeft size={15}/>Voltar ao Game Finder</Link>
      <span className="coach-header-tag"><Medal size={14}/> AOE2 COACH</span>
    </header>

    <section className="browser-hero panel coach-hero">
      <div className="eyebrow muted">ANÁLISE TÉCNICA DE REPLAYS · AGE OF EMPIRES II: DE</div>
      <h1>Seu treinador de batalha.</h1>
      <p>Encontre suas partidas, analise o replay e descubra o que você executou bem e o que vale treinar na próxima partida.</p>
      <div className="coach-hero-points"><span><Activity size={15}/> eAPM e ações</span><span><Clock3 size={15}/> Tempos de evolução</span><span><BookOpen size={15}/> Build order observada</span></div>
    </section>

    <section className="panel coach-lookup">
      <div className="coach-section-heading"><div className="coach-icon"><Search size={20}/></div><div><h2>1. Localizar jogador</h2><p>Digite o nickname exatamente como aparece no jogo. A busca diferencia maiúsculas e minúsculas.</p></div></div>
      <form className="coach-search-form" onSubmit={(event)=>{event.preventDefault();void searchPlayer();}}>
        <input value={nickname} onChange={(event)=>setNickname(event.target.value)} placeholder="Nickname no Age of Empires II" maxLength={32}/>
        <button className="create-btn" type="submit" disabled={loadingPlayer}>{loadingPlayer?<span className="coach-spinner"/>:<Search size={16}/>} BUSCAR JOGADOR</button>
      </form>
      {profiles.length>1&&<div className="coach-profile-choices"><strong>Selecione o perfil correto:</strong>
        {profiles.map((item)=><button key={item.profile_id} className="coach-profile-choice" onClick={()=>void chooseProfile(item)}>
          <span><b>{item.alias}</b><small>Perfil {item.profile_id}{item.country?" · "+item.country:""}{item.level?" · Nível "+item.level:""}</small></span><ArrowLeft className="coach-choice-arrow" size={15}/>
        </button>)}
      </div>}
      {profile&&<div className="coach-selected-profile"><div><span className="coach-label">PERFIL SELECIONADO</span><h3>{profile.alias}</h3><small>Profile ID: {profile.profile_id}{profile.country?" · "+profile.country:""}{profile.games!==undefined?" · "+profile.games+" partidas":""}</small></div><button className="browser-copy" onClick={()=>{setProfile(null);setMatches([]);setReport(null);setProfiles([]);setRatingHistory(null);setRatingsError("");}}>Trocar jogador</button></div>}
    </section>

    {profile&&<section className="coach-rating-section">
      {loadingRatings&&<div className="panel coach-rating-loading"><span className="coach-spinner"/> Carregando evolução de rating X1 e TG...</div>}
      {ratingsError&&<div className="coach-alert error"><AlertTriangle size={17}/><span>{ratingsError}</span></div>}
      {ratingHistory&&<RatingHistoryChart history={ratingHistory}/>}
    </section>}

    <section className="panel coach-matches">
      <div className="coach-section-heading"><div className="coach-icon"><CalendarDays size={20}/></div><div><h2>2. Partidas recentes</h2><p>{profile?"Histórico concluído de "+profile.alias+".":"Busque um jogador para listar as partidas disponíveis."}</p></div><span className="coach-count">{matches.length}</span></div>
      {loadingMatches&&<div className="coach-empty"><span className="coach-spinner"/> Carregando histórico...</div>}
      {!loadingMatches&&profile&&matches.length===0&&<div className="coach-empty">Nenhuma partida recente foi retornada pelo serviço.</div>}
      {!profile&&!loadingMatches&&<div className="coach-empty">As partidas aparecerão aqui após localizar um perfil.</div>}
      <div className="coach-match-list">
        {matches.map((match)=>(
          <article className="coach-match" key={match.id}>
            <div className={"coach-result-mark "+match.result}>{match.result==="win"?"V":match.result==="loss"?"D":"—"}</div>
            <div className="coach-match-info"><h3>{match.map}</h3><p>{match.title} · {match.playerCount} jogadores · {durationLabel(match.durationSeconds)}</p>
              <small>{dateLabel(match.completedAt)}{match.civilizationName?" · "+match.civilizationName:""}{match.ratingChange!==null?" · ELO "+(match.ratingChange>0?"+":"")+match.ratingChange:""}</small>
            </div>
            <button className="join-btn coach-analyze-btn" disabled={busyMatchId!==""} onClick={()=>void analyzeMatch(match)}>
              {busyMatchId===match.id?<span className="coach-spinner"/>:<Zap size={14}/>} ANALISAR REPLAY
            </button>
          </article>
        ))}
      </div>
      {profile&&<p className="coach-footnote">A lista e a análise vêm do histórico e dos dados de replay disponíveis no AoE II Companion. Nem todas as partidas necessariamente têm análise publicada.</p>}
    </section>

    <section className="panel coach-upload">
      <div className="coach-section-heading"><div className="coach-icon"><Upload size={20}/></div><div><h2>3. Enviar replay manualmente</h2><p>Use esta opção quando o download automático não estiver disponível ou para analisar uma partida privada.</p></div></div>
      <label className="coach-dropzone">
        <FileVideo size={30}/><strong>{uploading?"Enviando e analisando...":"Escolher arquivo .aoe2record ou .zip"}</strong>
        <span>Até 100 MB · O arquivo é processado e descartado pelo analisador.</span>
        <input type="file" accept=".aoe2record,.zip" disabled={uploading} onChange={(event)=>{const file=event.target.files?.[0];void uploadReplay(file);event.currentTarget.value="";}}/>
        <span className="coach-upload-action">{uploading?<span className="coach-spinner"/>:<Upload size={14}/>} SELECIONAR REPLAY</span>
      </label>
      {!profile&&<p className="coach-footnote">Sem um perfil selecionado, o analisador usará o jogador cuja perspectiva está gravada no arquivo.</p>}
    </section>

    {error&&<div className="coach-alert error"><AlertTriangle size={17}/><span>{error}</span></div>}
    {notice&&<div className="coach-alert success"><CheckCircle2 size={17}/><span>{notice}</span></div>}

    {report&&<section className="panel coach-report">
      <div className="coach-report-title"><div><div className="eyebrow muted">RELATÓRIO DE DESEMPENHO</div><h2>{report.selectedPlayer?.name||"Jogador analisado"}</h2><p>{report.map||"Mapa não identificado"} · {durationLabel(report.durationSeconds)} · {report.gameType||"Modo não identificado"}</p></div><span className="coach-parser-badge">PARSER {report.parserVersion}</span></div>
      {report.evaluation && <>
      <div className="coach-evaluation">
        <div className="coach-score-card">
          <div className="eyebrow muted">PONTUAÇÃO DE EXECUÇÃO · BETA</div>
          <div className="coach-score-number">{report.evaluation.overallScore ?? "—"}<small>/100</small></div>
          <strong>{report.evaluation.overallLabel}</strong>
          <p>{report.evaluation.coverage}% dos critérios pontuados · confiança {report.evaluation.confidence === "high" ? "alta" : report.evaluation.confidence === "medium" ? "média" : "baixa"}</p>
          <span>Não é uma nota oficial do jogo. É uma avaliação experimental baseada nos eventos detectados.</span>
        </div>
        <div className="coach-strategy-card">
          <div className="eyebrow muted">ESTRATÉGIA IDENTIFICADA</div>
          <h3>{report.evaluation.strategy.name}</h3>
          <span className={"coach-confidence " + report.evaluation.strategy.confidence}>
            Confiança {report.evaluation.strategy.confidence === "high" ? "alta" : report.evaluation.strategy.confidence === "medium" ? "média" : "baixa"}
          </span>
          <p>{report.evaluation.strategy.reason}</p>
          {report.evaluation.strategy.evidence.length > 0 && <div className="coach-evidence">
            <b>Evidências encontradas</b>
            {report.evaluation.strategy.evidence.map((item,i)=><span key={i}>• {item}</span>)}
          </div>}
          {report.evaluation.strategy.alternatives.length > 0 && <div className="coach-alternatives">
            <b>Possíveis variações</b>
            {report.evaluation.strategy.alternatives.map((item,i)=><span key={i}>{item}</span>)}
          </div>}
        </div>
      </div>

      <div className="coach-report-block coach-score-breakdown">
        <h3><Target size={17}/> Como você pontuou</h3>
        <div className="coach-category-list">
          {report.evaluation.categories.map((item)=>(
            <div className="coach-category-row" key={item.id}>
              <div className="coach-category-top">
                <b>{item.title}</b>
                <strong>{item.score === null ? "N/A" : item.score + "/" + item.max}</strong>
              </div>
              <div className="coach-category-track">
                <span style={{width: (item.score === null ? 0 : Math.max(0, Math.min(100, item.score / item.max * 100))) + "%"}}/>
              </div>
              <p>{item.reason}</p>
            </div>
          ))}
        </div>
        <p className="coach-footnote">{report.evaluation.benchmark.note}{report.evaluation.benchmark.feudalTime ? " Seu Feudal: " + report.evaluation.benchmark.feudalTime + (report.evaluation.benchmark.targetFeudalTime ? " · referência: " + report.evaluation.benchmark.targetFeudalTime : "") + "." : ""}</p>
      </div>

      <div className="coach-reaction-card">
        <div className="coach-report-block">
          <h3><ShieldCheck size={17}/> Leitura de reação ao adversário</h3>
          <div className="coach-reaction-flow">
            <div><small>AMEAÇA DETECTADA</small><b>{report.evaluation.reaction.opponentUnit ?? "Não identificada"}</b><span>{report.evaluation.reaction.opponentTime ?? "—"}</span></div>
            <div className="coach-reaction-arrow">→</div>
            <div><small>SUA RESPOSTA</small><b>{report.evaluation.reaction.responseUnit ?? "Não identificada"}</b><span>{report.evaluation.reaction.responseTime ?? "—"}</span></div>
          </div>
          <p>{report.evaluation.reaction.summary}</p>
          {report.evaluation.reaction.delaySeconds !== null && <small className="coach-reaction-delay">Intervalo observado: {report.evaluation.reaction.delaySeconds}s</small>}
          <p className="coach-footnote">O intervalo é medido entre comandos registrados no replay. Não confirma o momento em que você avistou o adversário.</p>
        </div>
      </div>

      <div className="coach-report-block coach-tips-block">
        <h3><BookOpen size={17}/> O que poderia ter sido feito</h3>
        {report.evaluation.tips.map((tip,i)=>(
          <article className={"coach-tip " + tip.severity} key={i}>
            <div className="coach-tip-heading">
              <b>{tip.title}</b>
              <span>{tip.time ?? "Análise geral"}</span>
            </div>
            <p>{tip.detail}</p>
            <div><strong>Recomendação:</strong> {tip.action}</div>
          </article>
        ))}
      </div>
      {report.evaluation.strengths.length > 0 && <div className="coach-strengths">
        <b><CheckCircle2 size={16}/> O que você fez bem</b>
        {report.evaluation.strengths.map((item,i)=><span key={i}>• {item}</span>)}
      </div>}
      </>}

      <div className="coach-metric-grid">
        <div className="coach-metric"><Gauge size={19}/><span>eAPM</span><strong>{report.metrics.eapm??"—"}</strong><small>Ações efetivas/min</small></div>
        <div className="coach-metric"><Activity size={19}/><span>APM</span><strong>{report.metrics.apm??"—"}</strong><small>Ações totais/min</small></div>
        <div className="coach-metric"><Users size={19}/><span>Fila de aldeões</span><strong>{report.metrics.villagerQueueCommands}</strong><small>Comandos detectados</small></div>
        <div className="coach-metric"><Swords size={19}/><span>Fila militar</span><strong>{report.metrics.militaryQueueCommands}</strong><small>Comandos detectados</small></div>
      </div>
      <div className="coach-report-columns">
        <div className="coach-report-block"><h3><CheckCircle2 size={17}/> Pontos positivos observados</h3>
          {report.insights.positives.length?report.insights.positives.map((item,i)=><div className="coach-insight positive" key={i}><b>{item.title}</b><p>{item.detail}</p></div>):<p className="coach-footnote">Ainda não há indicadores positivos suficientes.</p>}
        </div>
        <div className="coach-report-block"><h3><AlertTriangle size={17}/> Pontos para revisar</h3>
          {report.insights.review.map((item,i)=><div className="coach-insight review" key={i}><b>{item.title}</b><p>{item.detail}</p></div>)}
        </div>
      </div>
      <div className="coach-report-block coach-age-block"><h3><Clock3 size={17}/> Transições de idade</h3>
        {report.ageUps.length?<div className="coach-age-list">{report.ageUps.map((age,i)=><div className="coach-age-item" key={i}><span>{age.age}</span><b>{age.time??"—"}</b></div>)}</div>:<p className="coach-footnote">Nenhum evento de avanço de idade foi identificado neste replay.</p>}
      </div>
      <div className="coach-report-block"><h3><BookOpen size={17}/> Linha do tempo — comandos observados</h3>
        {report.timeline.length?<div className="coach-timeline">{report.timeline.slice(0,35).map((event,i)=><div className="coach-timeline-row" key={i}><time>{event.time??"—"}</time><b>{event.type}</b><span>{event.detail||"—"}</span></div>)}</div>:<p className="coach-footnote">O parser não retornou a sequência de comandos para esta versão do replay.</p>}
      </div>
      <div className="coach-limitations"><b>Como interpretar este relatório</b><ul>{report.limitations.map((item,i)=><li key={i}>{item}</li>)}</ul></div>
      <p className="coach-footnote">Esta é uma avaliação técnica inicial baseada nos eventos encontrados no arquivo. Ainda não é uma nota global de habilidade nem uma comparação automática com uma build order específica.</p>
    </section>}

    <footer><Link className="brand footer-brand" href="/"><span className="brand-mark"><Castle size={18}/></span><span>AOE2 <b>GAME FINDER</b><small>FIND YOUR NEXT GG.</small></span></Link><span>COMMUNITY PROJECT · NOT AFFILIATED WITH MICROSOFT</span></footer>
  </main>;
}
