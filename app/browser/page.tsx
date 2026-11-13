"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Castle, ExternalLink, Globe2, RefreshCw, Search, Swords, Users } from "lucide-react";

type Language = "pt" | "en";
type GlobalLobby = { id: string; name: string; players: string[]; playerCount: number; slots: number; mode: string; passwordProtected: boolean; region: string; joinUrl: string | null };
type CommunityRoom = { id: string; title: string; mode: string; map: string; elo: string; region: string; host: string; players: string; game_lobby_id?: string | null };
const copy = {
  pt: { back:"Voltar ao Game Finder", title:"Browser de Partidas", subtitle:"Encontre lobbies abertos de Age of Empires II: Definitive Edition.", global:"Lobbies globais", community:"Comunidade Game Finder", search:"Buscar por nome ou jogador...", refresh:"Atualizar", loading:"Consultando partidas...", none:"Nenhum lobby aberto encontrado agora.", noCommunity:"Ainda não há salas da comunidade com um lobby real associado.", join:"ENTRAR NO JOGO", copyId:"Copiar ID", openGame:"Abrir Age of Empires II", slots:"vagas", players:"jogadores", protected:"Com senha", public:"Pública", updated:"Atualizado", unavailable:"O serviço global está indisponível neste momento. Tente novamente em instantes.", external:"A consulta global usa um serviço comunitário não oficial. Se o protocolo não abrir o jogo, copie o ID e procure a partida em Multiplayer → Find Custom Game.", roomChat:"Abrir sala no site" },
  en: { back:"Back to Game Finder", title:"Game Browser", subtitle:"Find open Age of Empires II: Definitive Edition lobbies.", global:"Global lobbies", community:"Game Finder community", search:"Search by lobby or player...", refresh:"Refresh", loading:"Loading lobbies...", none:"No open lobbies found right now.", noCommunity:"No community rooms linked to a real game lobby yet.", join:"JOIN GAME", copyId:"Copy ID", openGame:"Open Age of Empires II", slots:"slots", players:"players", protected:"Password", public:"Public", updated:"Updated", unavailable:"The global service is temporarily unavailable. Please try again shortly.", external:"Global listings use an unofficial community service. If the game protocol does not launch, copy the ID and find the lobby under Multiplayer → Find Custom Game.", roomChat:"Open site room" }
};
export default function BrowserPage() {
  const [language, setLanguage] = useState<Language>("pt");
  const [tab, setTab] = useState<"global" | "community">("global");
  const [lobbies, setLobbies] = useState<GlobalLobby[]>([]);
  const [community, setCommunity] = useState<CommunityRoom[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"ok" | "unavailable">("ok");
  const [updatedAt, setUpdatedAt] = useState("");
  const t = copy[language];
  const loadGlobal = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/game-browser/global", { cache: "no-store" });
      const data = await response.json();
      setLobbies(data.lobbies ?? []);
      setStatus(data.sourceStatus === "ok" ? "ok" : "unavailable");
      setUpdatedAt(data.updatedAt ?? "");
    } catch { setStatus("unavailable"); setLobbies([]); }
    finally { setLoading(false); }
  }, []);
  const loadCommunity = useCallback(async () => {
    try {
      const response = await fetch("/api/rooms", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setCommunity((data.rooms ?? []).filter((room: CommunityRoom & { game_lobby_id?: string }) => Boolean(room.game_lobby_id)));
    } catch { setError(t.unavailable); }
  }, [t.unavailable]);
  useEffect(() => {
    const saved = localStorage.getItem("aoe2-language");
    if (saved === "en" || saved === "pt") setLanguage(saved);
    void loadGlobal(); void loadCommunity();
    const timer = window.setInterval(() => { void loadGlobal(); void loadCommunity(); }, 30000);
    return () => window.clearInterval(timer);
  }, [loadGlobal, loadCommunity]);
  const filteredGlobal = lobbies.filter((lobby) => `${lobby.name} ${lobby.players.join(" ")} ${lobby.id}`.toLowerCase().includes(search.toLowerCase()));
  const filteredCommunity = community.filter((room) => `${room.title} ${room.host} ${room.map}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="shell browser-page">
    <header className="topbar browser-topbar">
      <Link className="brand" href="/"><span className="brand-mark"><Castle size={23}/></span><span>AOE2 <b>GAME FINDER</b><small>THE COMMUNITY MATCH HUB</small></span></Link>
      <Link className="browser-back" href="/"><ArrowLeft size={15}/>{t.back}</Link>
      <label className="language-picker"><Globe2 size={14}/><select value={language} onChange={(event) => { const value = event.target.value as Language; setLanguage(value); localStorage.setItem("aoe2-language", value); }}><option value="pt">PT-BR</option><option value="en">English</option></select></label>
    </header>
    <section className="browser-hero panel">
      <div className="eyebrow muted">AGE OF EMPIRES II · DEFINITIVE EDITION</div>
      <h1>{t.title}</h1><p>{t.subtitle}</p>
      <div className="browser-tabs">
        <button className={tab === "global" ? "selected" : ""} onClick={() => setTab("global")}><Globe2 size={16}/>{t.global}<span>{lobbies.length}</span></button>
        <button className={tab === "community" ? "selected" : ""} onClick={() => setTab("community")}><Users size={16}/>{t.community}<span>{community.length}</span></button>
      </div>
      <div className="browser-controls">
        <label className="browser-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search}/></label>
        <button className="create-btn" onClick={() => { void loadGlobal(); void loadCommunity(); }} disabled={loading}><RefreshCw size={15}/>{t.refresh}</button>
      </div>
    </section>
    {tab === "global" ? <section className="browser-results panel">
      <div className="browser-result-heading"><h2><span className="live-dot"/>{t.global}</h2><span>{loading ? t.loading : status === "ok" ? `${lobbies.length} ${t.players}` : t.unavailable}</span></div>
      {status === "unavailable" && <p className="browser-notice">{t.unavailable}</p>}
      {filteredGlobal.map((lobby) => <article className="browser-lobby" key={lobby.id}>
        <div className="browser-lobby-icon"><Swords size={22}/></div>
        <div className="browser-lobby-main"><h3>{lobby.name}</h3><div className="browser-lobby-meta"><span>{lobby.mode}</span><span>ID: {lobby.id}</span><span>{lobby.region}</span><span>{lobby.passwordProtected ? t.protected : t.public}</span></div><div className="browser-player-list">{lobby.players.length ? lobby.players.join(" · ") : "—"}</div></div>
        <div className="browser-lobby-count"><b>{lobby.playerCount}/{lobby.slots}</b><small>{t.slots}</small></div>
        <div className="browser-lobby-actions"><a className="join-btn browser-join" href={lobby.joinUrl ?? undefined} onClick={(event) => { if (!lobby.joinUrl) event.preventDefault(); }}>{t.join}<ExternalLink size={13}/></a><button className="browser-copy" onClick={() => void navigator.clipboard.writeText(lobby.id)}>{t.copyId}</button></div>
      </article>)}
      {!loading && !filteredGlobal.length && status === "ok" && <div className="empty">{t.none}</div>}
      <p className="browser-footnote">{t.external}</p>
      {updatedAt && <p className="browser-updated">{t.updated}: {new Date(updatedAt).toLocaleTimeString(language === "pt" ? "pt-BR" : "en-US")}</p>}
    </section> : <section className="browser-results panel">
      <div className="browser-result-heading"><h2><Users size={18}/>{t.community}</h2><span>{community.length}</span></div>
      {filteredCommunity.map((room) => <article className="browser-lobby" key={room.id}>
        <div className="browser-lobby-icon"><Castle size={22}/></div><div className="browser-lobby-main"><h3>{room.title}</h3><div className="browser-lobby-meta"><span>{room.mode}</span><span>{room.map}</span><span>{room.elo} ELO</span><span>{room.host}</span></div></div><div className="browser-lobby-actions"><a className="join-btn browser-join" href={`aoe2de://0/${encodeURIComponent(room.game_lobby_id ?? "")}`}>{t.join}<ExternalLink size={13}/></a><Link className="browser-copy" href={`/?room=${encodeURIComponent(room.id)}#chat`}>{t.roomChat}</Link></div>
      </article>)}
      {!filteredCommunity.length && <div className="empty">{t.noCommunity}</div>}
    </section>}
    <footer><Link className="brand footer-brand" href="/"><span className="brand-mark"><Castle size={18}/></span><span>AOE2 <b>GAME FINDER</b><small>FIND YOUR NEXT GG.</small></span></Link><span>COMMUNITY PROJECT · NOT AFFILIATED WITH MICROSOFT</span></footer>
  </main>;
}
