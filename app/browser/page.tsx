"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Castle, Copy, ExternalLink, Globe2, RefreshCw, Search, Swords, Users } from "lucide-react";

type Language = "pt" | "en";
type GlobalLobby = {
  id: string;
  name: string;
  map: string;
  mode: string;
  players: string[];
  playerCount: number;
  slots: number;
  region: string;
  passwordProtected: boolean;
  joinUrl: string;
};
type CommunityRoom = {
  id: string;
  title: string;
  mode: string;
  map: string;
  elo: string;
  region: string;
  host: string;
  players: string;
  game_lobby_id: string | null;
};
const copy = {
  pt: {
    back:"Voltar ao Game Finder", title:"Browser de Partidas",
    subtitle:"Encontre lobbies abertos de Age of Empires II: Definitive Edition.",
    global:"Lobbies globais", community:"Partidas da comunidade",
    search:"Buscar por nome, mapa ou jogador...", refresh:"Atualizar",
    loading:"Consultando partidas...", none:"Nenhum lobby aberto encontrado agora.",
    noCommunity:"Ainda não há salas da comunidade vinculadas a um lobby real do Age 2.",
    join:"ENTRAR NO JOGO", copyId:"COPIAR ID", copied:"ID copiado!",
    slots:"VAGAS", players:"jogadores", protected:"Com senha", public:"Pública",
    updated:"Atualizado", unavailable:"O serviço global está temporariamente indisponível. Tente novamente em instantes.",
    partial:"A lista pode estar incompleta neste momento.",
    external:"Os lobbies globais vêm do serviço comunitário não oficial do Age of Empires. O feed mostra salas abertas/em formação, não partidas ranqueadas em andamento.",
    joinHelp:"O link ao2de:// tenta abrir o jogo e entrar no lobby. Em geral, o jogo precisa estar aberto. Se não funcionar, copie o ID e procure em Multiplayer → Find Custom Game.",
    roomJoin:"ABRIR LOBBY", host:"CRIADA POR", elo:"ELO",
    communityHelp:"Para listar sua sala aqui, crie primeiro o lobby dentro do Age 2 e informe o ID do jogo ao criar a sala no Game Finder.",
    openSite:"Abrir página da comunidade"
  },
  en: {
    back:"Back to Game Finder", title:"Game Browser",
    subtitle:"Find open Age of Empires II: Definitive Edition lobbies.",
    global:"Global lobbies", community:"Community matches",
    search:"Search by name, map or player...", refresh:"Refresh",
    loading:"Loading lobbies...", none:"No open lobbies found right now.",
    noCommunity:"There are no Game Finder rooms linked to a real AoE2 lobby yet.",
    join:"JOIN GAME", copyId:"COPY ID", copied:"ID copied!",
    slots:"SLOTS", players:"players", protected:"Password", public:"Public",
    updated:"Updated", unavailable:"The global service is temporarily unavailable. Please try again shortly.",
    partial:"The list may be incomplete right now.",
    external:"Global lobbies come from an unofficial community service for Age of Empires. The feed shows open/forming custom lobbies, not ranked games already in progress.",
    joinHelp:"The aoe2de:// link attempts to open the game and join the lobby. The game generally needs to be running. If it does not work, copy the ID and search under Multiplayer → Find Custom Game.",
    roomJoin:"OPEN LOBBY", host:"HOSTED BY", elo:"ELO",
    communityHelp:"To list your room here, first create the lobby inside AoE2 and enter the in-game ID when creating the room in Game Finder.",
    openSite:"Open community page"
  }
};

export default function BrowserPage() {
  const [language, setLanguage] = useState<Language>("pt");
  const [tab, setTab] = useState<"global" | "community">("global");
  const [lobbies, setLobbies] = useState<GlobalLobby[]>([]);
  const [community, setCommunity] = useState<CommunityRoom[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">("loading");
  const [updatedAt, setUpdatedAt] = useState("");
  const [partial, setPartial] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const t = copy[language];

  const loadGlobal = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/game-browser/global", { cache: "no-store" });
      const data = await response.json();
      setLobbies(data.lobbies ?? []);
      setStatus(data.sourceStatus === "ok" ? "ok" : "unavailable");
      setUpdatedAt(data.updatedAt ?? "");
      setPartial(Boolean(data.partial));
    } catch {
      setStatus("unavailable");
      setLobbies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCommunity = useCallback(async () => {
    try {
      const response = await fetch("/api/rooms", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setCommunity((data.rooms ?? []).filter((room: CommunityRoom) => Boolean(room.game_lobby_id)));
      }
    } catch {
      setCommunity([]);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("aoe2-language");
    if (saved === "en" || saved === "pt") setLanguage(saved);
    void loadGlobal();
    void loadCommunity();
    const timer = window.setInterval(() => {
      void loadGlobal();
      void loadCommunity();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadGlobal, loadCommunity]);

  const filteredGlobal = lobbies.filter((lobby) =>
    `${lobby.name} ${lobby.map} ${lobby.mode} ${lobby.players.join(" ")} ${lobby.id}`
      .toLowerCase().includes(search.toLowerCase()),
  );
  const filteredCommunity = community.filter((room) =>
    `${room.title} ${room.host} ${room.map} ${room.mode}`
      .toLowerCase().includes(search.toLowerCase()),
  );

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopyMessage(id);
      window.setTimeout(() => setCopyMessage(""), 1800);
    } catch {
      setCopyMessage("");
    }
  }

  return <main className="shell browser-page">
    <header className="topbar browser-topbar">
      <a className="brand" href="/"><span className="brand-mark"><Castle size={23}/></span><span>AOE2 <b>GAME FINDER</b><small>THE COMMUNITY MATCH HUB</small></span></a>
      <a className="browser-back" href="/"><ArrowLeft size={15}/>{t.back}</a>
      <label className="language-picker"><Globe2 size={14}/><select value={language} onChange={(event) => {
        const value = event.target.value as Language;
        setLanguage(value);
        localStorage.setItem("aoe2-language", value);
      }}><option value="pt">PT-BR</option><option value="en">English</option></select></label>
    </header>

    <section className="browser-hero panel">
      <div className="eyebrow muted">AGE OF EMPIRES II · DEFINITIVE EDITION</div>
      <h1>{t.title}</h1>
      <p>{t.subtitle}</p>
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
      <div className="browser-result-heading">
        <h2><span className="live-dot"/>{t.global}</h2>
        <span>{loading ? t.loading : status === "ok" ? `${lobbies.length} ${t.players}` : t.unavailable}</span>
      </div>
      {status === "unavailable" && <p className="browser-notice">{t.unavailable}</p>}
      {partial && <p className="browser-notice">{t.partial}</p>}
      {filteredGlobal.map((lobby) => <article className="browser-lobby" key={lobby.id}>
        <div className="browser-lobby-icon"><Swords size={22}/></div>
        <div className="browser-lobby-main">
          <h3>{lobby.name}</h3>
          <div className="browser-lobby-meta"><span>{lobby.mode}</span><span>{lobby.map}</span><span>{lobby.region}</span><span>{lobby.passwordProtected ? t.protected : t.public}</span></div>
          <div className="browser-player-list">{lobby.players.length ? lobby.players.join(" · ") : "—"}</div>
        </div>
        <div className="browser-lobby-count"><b>{lobby.playerCount}/{lobby.slots}</b><small>{t.slots}</small></div>
        <div className="browser-lobby-actions">
          <a className="join-btn browser-join" href={lobby.joinUrl}>{t.join}<ExternalLink size={13}/></a>
          <button className="browser-copy" onClick={() => void copyId(lobby.id)}><Copy size={12}/>{copyMessage === lobby.id ? t.copied : t.copyId}</button>
        </div>
      </article>)}
      {!loading && !filteredGlobal.length && status === "ok" && <div className="empty">{t.none}</div>}
      <p className="browser-footnote">{t.external}</p>
      <p className="browser-footnote">{t.joinHelp}</p>
      {updatedAt && <p className="browser-updated">{t.updated}: {new Date(updatedAt).toLocaleTimeString(language === "pt" ? "pt-BR" : "en-US")}</p>}
    </section> : <section className="browser-results panel">
      <div className="browser-result-heading"><h2><Users size={18}/>{t.community}</h2><span>{filteredCommunity.length}</span></div>
      <p className="browser-footnote">{t.communityHelp}</p>
      {filteredCommunity.map((room) => <article className="browser-lobby" key={room.id}>
        <div className="browser-lobby-icon"><Castle size={22}/></div>
        <div className="browser-lobby-main">
          <h3>{room.title}</h3>
          <div className="browser-lobby-meta"><span>{room.mode}</span><span>{room.map}</span><span>{room.elo} {t.elo}</span><span>{t.host}: {room.host}</span></div>
          <div className="browser-player-list">Game ID: {room.game_lobby_id}</div>
        </div>
        <div className="browser-lobby-actions">
          <a className="join-btn browser-join" href={`aoe2de://0/${encodeURIComponent(room.game_lobby_id ?? "")}`}>{t.roomJoin}<ExternalLink size={13}/></a>
          <button className="browser-copy" onClick={() => void copyId(room.game_lobby_id ?? "")}><Copy size={12}/>{copyMessage === room.game_lobby_id ? t.copied : t.copyId}</button>
        </div>
      </article>)}
      {!filteredCommunity.length && <div className="empty">{t.noCommunity}</div>}
      <p className="browser-footnote"><a href="/">{t.openSite}</a></p>
    </section>}

    <footer><a className="brand footer-brand" href="/"><span className="brand-mark"><Castle size={18}/></span><span>AOE2 <b>GAME FINDER</b><small>FIND YOUR NEXT GG.</small></span></a><span>COMMUNITY PROJECT · NOT AFFILIATED WITH MICROSOFT</span></footer>
  </main>;
}
