"use client";

import { useEffect, useMemo, useState } from "react";
import { Castle, ChevronDown, CircleHelp, Filter, Globe2, MessageCircle, Plus, Search, Send, ShieldCheck, Swords, Users, X } from "lucide-react";

type Language = "pt" | "en";
type Room = { id: number; title: string; mode: string; map: string; elo: string; region: string; players: string; host: string; status: string };
type ChatMessage = { name: string; country: string; text: string; time: string; mine?: boolean };

const initialRooms: Room[] = [
  { id: 1, title: "Arabia • 1v1 practice", mode: "1v1", map: "Arabia", elo: "1200–1500", region: "Americas", players: "1/2", host: "EcoRush", status: "Waiting" },
  { id: 2, title: "Arena team game", mode: "4v4", map: "Arena", elo: "Any ELO", region: "Europe", players: "5/8", host: "CastleAge", status: "Filling up" },
  { id: 3, title: "Black Forest • chill", mode: "3v3", map: "Black Forest", elo: "1000–1300", region: "Any region", players: "2/6", host: "ForestKing", status: "Waiting" },
  { id: 4, title: "Random map ranked warmup", mode: "2v2", map: "Random", elo: "1400+", region: "Americas", players: "2/4", host: "Mangudai", status: "Waiting" }
];

const starterMessages: ChatMessage[] = [
  { name: "EcoRush", country: "🇧🇷", text: "Anyone up for 1v1 Arabia? 1300 ELO", time: "14:42" },
  { name: "CastleAge", country: "🇺🇸", text: "Looking for two more players for 4v4 Arena.", time: "14:43" },
  { name: "MichiMain", country: "🇩🇪", text: "2v2 Black Forest, relaxed game?", time: "14:44" },
  { name: "You", country: "🌎", text: "Welcome! Find players and set up a match.", time: "Now", mine: true }
];

const translations = {
  pt: {
    navFind: "Encontrar partida", navChat: "Chat global", navHow: "Como funciona", discordTitle: "Entre no Discord oficial", discordDesc: "Converse com a comunidade, encontre jogadores, organize partidas e fique por dentro das novidades do AOE2 Game Finder.", discordButton: "ENTRAR NO DISCORD", community: "CENTRAL DA COMUNIDADE", chooseNick: "Escolher nickname",
    eyebrow: "O CAMPO DE BATALHA ESTÁ CHAMANDO", heroLine1: "SUA PRÓXIMA", heroLine2: "GG COMEÇA AQUI.", heroDesc1: "Encontre sua próxima partida de Age of Empires II: Definitive Edition.", heroDesc2: "Conheça jogadores, forme equipes e entre no jogo.", findMatch: "ENCONTRAR PARTIDA", joinChat: "ENTRAR NO CHAT", global: "GLOBAL", communityLabel: "COMUNIDADE", matchmaking: "BUSCA DE PARTIDAS 24/7", definitive: "EDIÇÃO DEFINITIVA",
    matchmakingEyebrow: "ENCONTRE JOGADORES", findBattle: "Encontre sua batalha.", intro: "Salas abertas, novos companheiros e partidas organizadas em poucos minutos.", worldwide: "Mundo todo", openCommunity: "Comunidade aberta", moderated: "Chat moderado",
    lobbies: "SALAS ABERTAS", openMatches: "Partidas abertas", createRoom: "Criar sala", search: "Buscar salas, mapas ou jogadores...", allModes: "Todos os modos", allRegions: "Todas as regiões", anyRegion: "Qualquer região", players: "JOGADORES", hostedBy: "CRIADA POR", viewRoom: "VER SALA", noRooms: "Nenhuma sala encontrada com esses filtros. Tente outra busca.", demo: "PRÉVIA DEMONSTRATIVA · As salas serão compartilhadas entre os jogadores após a ativação do servidor.",
    lounge: "ESPAÇO DA COMUNIDADE", globalChat: "Chat global", allLanguages: "TODOS OS IDIOMAS", chooseNickChat: "Escolha um nickname para participar da conversa", nickPlaceholder: "Seu nickname no jogo", join: "ENTRAR", nickHint: "3 a 24 caracteres · Não é necessário cadastro", messageAs: "Mensagem como", linksDisabled: "Links desativados · Respeite os outros jogadores",
    how: "Como funciona", howDesc: "Escolha um nickname, encontre uma sala ou crie a sua e conheça seus próximos adversários.", communityFirst: "A comunidade em primeiro lugar", communityDesc: "Regras de convivência e moderação ajudam a manter um ambiente acolhedor.", playWorldwide: "Jogue com o mundo", playDesc: "Conecte-se à comunidade de AoE2 DE, onde quer que você jogue.", disclaimer: "PROJETO DA COMUNIDADE · NÃO AFILIADO À AGE OF EMPIRES OU À MICROSOFT", footerTag: "ENCONTRE SUA PRÓXIMA GG.",
    newLobby: "COMECE UMA NOVA SALA", roomTitle: "Nome da sala", roomTitlePlaceholder: "Ex.: Arabia 1v1 treino", gameMode: "Modo de jogo", map: "Mapa", eloRange: "Faixa de ELO", anyElo: "Qualquer ELO", below1000: "Abaixo de 1000", createLobby: "CRIAR SALA", needNick: "Entre no chat com um nickname antes de criar uma sala.", roomRequest: "Solicitação para a sala", contactHost: "Fale com o anfitrião no chat global.", waiting: "Aguardando", regionAmericas: "Américas", regionEurope: "Europa", regionAsia: "Ásia", regionAny: "Qualquer região", room1: "Arábia • treino 1v1", room2: "Partida em equipe na Arena", room3: "Floresta Negra • descontraída", room4: "Aquecimento ranqueado mapa aleatório", sample1: "Alguém para 1v1 na Arábia? 1300 ELO", sample2: "Procurando mais dois jogadores para 4v4 na Arena.", sample3: "2v2 na Floresta Negra, partida tranquila?", sample4: "Bem-vindo! Encontre jogadores e organize uma partida.", you: "Você", system: "SISTEMA"
  },
  en: {
    navFind: "Find a game", navChat: "Global chat", navHow: "How it works", discordTitle: "Join the official Discord", discordDesc: "Chat with the community, find players, organize matches and stay up to date with AOE2 Game Finder news.", discordButton: "JOIN THE DISCORD", community: "COMMUNITY HUB", chooseNick: "Choose nickname",
    eyebrow: "THE BATTLEFIELD IS CALLING", heroLine1: "YOUR NEXT", heroLine2: "GG STARTS HERE.", heroDesc1: "Find your next Age of Empires II: Definitive Edition match.", heroDesc2: "Meet players, build teams and get into the game.", findMatch: "FIND A MATCH", joinChat: "JOIN THE CHAT", global: "GLOBAL", communityLabel: "COMMUNITY", matchmaking: "24/7 PLAYER MATCHMAKING", definitive: "DEFINITIVE EDITION",
    matchmakingEyebrow: "COMMUNITY MATCHMAKING", findBattle: "Find your battle.", intro: "Open rooms, meet your teammates and organize a match in minutes.", worldwide: "Worldwide", openCommunity: "Open community", moderated: "Moderated chat",
    lobbies: "LIVE LOBBIES", openMatches: "Open matches", createRoom: "Create room", search: "Search rooms, maps or players...", allModes: "All modes", allRegions: "All regions", anyRegion: "Any region", players: "PLAYERS", hostedBy: "HOSTED BY", viewRoom: "VIEW ROOM", noRooms: "No rooms match these filters. Try another search.", demo: "DEMO PREVIEW · Room listings become shared across users after backend activation.",
    lounge: "COMMUNITY LOUNGE", globalChat: "Global chat", allLanguages: "ALL LANGUAGES", chooseNickChat: "Choose a nickname to join the conversation", nickPlaceholder: "Your in-game nickname", join: "JOIN", nickHint: "3–24 characters · No account required", messageAs: "Message as", linksDisabled: "Links are disabled · Be respectful",
    how: "How it works", howDesc: "Pick a nickname, find a lobby or create your own, then meet your next opponents.", communityFirst: "Community first", communityDesc: "Chat rules and moderation tools help keep the hub welcoming.", playWorldwide: "Play worldwide", playDesc: "Connect with the AoE2 DE community, wherever you play.", disclaimer: "COMMUNITY PROJECT · NOT AFFILIATED WITH AGE OF EMPIRES OR MICROSOFT", footerTag: "FIND YOUR NEXT GG.",
    newLobby: "START A NEW LOBBY", roomTitle: "Room title", roomTitlePlaceholder: "e.g. Arabia 1v1 practice", gameMode: "Game mode", map: "Map", eloRange: "ELO range", anyElo: "Any ELO", below1000: "Below 1000", createLobby: "CREATE LOBBY", needNick: "Join the chat with a nickname before creating a room.", roomRequest: "Room request", contactHost: "Contact the host in global chat.", waiting: "Waiting", regionAmericas: "Americas", regionEurope: "Europe", regionAsia: "Asia", regionAny: "Any region", room1: "Arabia • 1v1 practice", room2: "Arena team game", room3: "Black Forest • chill", room4: "Random map ranked warmup", sample1: "Anyone up for 1v1 Arabia? 1300 ELO", sample2: "Looking for two more players for 4v4 Arena.", sample3: "2v2 Black Forest, relaxed game?", sample4: "Welcome! Find players and set up a match.", you: "You", system: "SYSTEM"
  }
};

export default function Home() {
  const [language, setLanguage] = useState<Language>("pt");
  const [nickname, setNickname] = useState("");
  const [savedNick, setSavedNick] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [message, setMessage] = useState("");
  const [rooms, setRooms] = useState(initialRooms);
  const [mode, setMode] = useState("All modes");
  const [region, setRegion] = useState("All regions");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState("1v1");
  const [newMap, setNewMap] = useState("Arabia");
  const [newElo, setNewElo] = useState("Any ELO");
  const t = translations[language];

  useEffect(() => {
    const saved = window.localStorage.getItem("aoe2-language");
    if (saved === "pt" || saved === "en") setLanguage(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("aoe2-language", language);
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  }, [language]);

  const localizedMessages = useMemo(() => messages.map((m, i) => {
    if (i > 3 || (m.name !== "EcoRush" && m.name !== "CastleAge" && m.name !== "MichiMain" && m.name !== "You")) return m;
    const sample = [t.sample1, t.sample2, t.sample3, t.sample4][["EcoRush", "CastleAge", "MichiMain", "You"].indexOf(m.name)];
    return { ...m, name: m.name === "You" ? t.you : m.name, text: sample };
  }), [messages, t]);

  const filteredRooms = useMemo(() => rooms.filter(room =>
    (mode === "All modes" || room.mode === mode) &&
    (region === "All regions" || room.region === region || room.region === "Any region") &&
    `${room.title} ${room.map} ${room.host}`.toLowerCase().includes(search.toLowerCase())
  ), [rooms, mode, region, search]);

  function enterChat() {
    const clean = nickname.trim().replace(/[<>]/g, "").slice(0, 24);
    if (clean.length >= 3) setSavedNick(clean);
  }

  function sendMessage() {
    const clean = message.trim();
    if (!savedNick) return;
    if (!clean || clean.length > 240 || /https?:\/\/|www\./i.test(clean)) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages(prev => [...prev, { name: savedNick, country: "🌎", text: clean, time: now, mine: true }]);
    setMessage("");
  }

  function createRoom() {
    if (!savedNick || newTitle.trim().length < 4) return;
    setRooms(prev => [{ id: Date.now(), title: newTitle.trim(), mode: newMode, map: newMap, elo: newElo, region: "Any region", players: newMode === "1v1" ? "1/2" : newMode === "2v2" ? "1/4" : newMode === "3v3" ? "1/6" : "1/8", host: savedNick, status: "Waiting" }, ...prev]);
    setShowCreate(false);
    setNewTitle("");
  }

  return (
    <main className="shell game-ui">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><Castle size={23}/></span><span>AOE2 <b>GAME FINDER</b><small>THE COMMUNITY MATCH HUB</small></span></a>
        <nav><a className="active" href="#rooms">{t.navFind}</a><a href="#chat">{t.navChat}</a><a href="#how">{t.navHow}</a></nav>
        <div className="top-actions"><span className="online"><i/> {t.community}</span><label className="language-picker" aria-label="Language"><Globe2 size={14}/><select value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="pt">PT-BR</option><option value="en">English</option></select></label><button className="nick-button" onClick={() => document.getElementById("nickname")?.focus()}>{savedNick || t.chooseNick} <ChevronDown size={15}/></button></div>
      </header>

      <section className="hero">
        <div className="hero-shade"/><div className="hero-content"><div className="eyebrow"><span/> {t.eyebrow}</div>
          <h1>{t.heroLine1}<br/><em>{t.heroLine2}</em></h1><p>{t.heroDesc1}<br/>{t.heroDesc2}</p>
          <div className="hero-actions"><a className="primary-btn" href="#rooms"><Swords size={17}/> {t.findMatch}</a><a className="ghost-btn" href="#chat"><MessageCircle size={17}/> {t.joinChat}</a></div>
        </div><div className="hero-stats"><div><strong>{t.global}</strong><span>{t.communityLabel}</span></div><div><strong>24/7</strong><span>{t.matchmaking}</span></div><div><strong>DE</strong><span>{t.definitive}</span></div></div>
      </section>

      <section className="intro-row"><div><div className="eyebrow muted">{t.matchmakingEyebrow}</div><h2>{t.findBattle.split(" ").slice(0, -1).join(" ")} <em>{t.findBattle.split(" ").slice(-1)[0]}</em></h2><p>{t.intro}</p></div><div className="feature-pills"><span><Globe2 size={15}/> {t.worldwide}</span><span><Users size={15}/> {t.openCommunity}</span><span><ShieldCheck size={15}/> {t.moderated}</span></div></section>

      <div className="dashboard">
        <section className="rooms-panel panel" id="rooms"><div className="panel-heading"><div><div className="eyebrow muted">{t.lobbies}</div><h3>{t.openMatches} <span className="count">{filteredRooms.length}</span></h3></div><button className="create-btn" onClick={() => setShowCreate(true)}><Plus size={16}/> {t.createRoom}</button></div>
          <div className="filters"><label className="searchbox"><Search size={16}/><input placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)}/></label><label><Filter size={15}/><select value={mode} onChange={e => setMode(e.target.value)}><option value="All modes">{t.allModes}</option><option>1v1</option><option>2v2</option><option>3v3</option><option>4v4</option></select></label><label><Globe2 size={15}/><select value={region} onChange={e => setRegion(e.target.value)}><option value="All regions">{t.allRegions}</option><option value="Americas">{t.regionAmericas}</option><option value="Europe">{t.regionEurope}</option><option value="Asia">{t.regionAsia}</option></select></label></div>
          <div className="room-list">{filteredRooms.map(room => <article className="room" key={room.id}><div className="room-icon"><Swords size={20}/></div><div className="room-main"><div className="room-title">{room.id === 1 ? t.room1 : room.id === 2 ? t.room2 : room.id === 3 ? t.room3 : room.id === 4 ? t.room4 : room.title}</div><div className="room-meta"><span>{room.mode}</span><span>{room.map}</span><span>{room.elo} ELO</span><span>{room.region === "Americas" ? t.regionAmericas : room.region === "Europe" ? t.regionEurope : room.region === "Any region" ? t.regionAny : t.regionAsia}</span></div><div className="room-host">{t.hostedBy} <b>{room.host}</b></div></div><div className="room-players"><strong>{room.players}</strong><small>{t.players}</small></div><button className="join-btn" onClick={() => setMessages(prev => [...prev, { name: "SYSTEM", country: "⚔", text: `${t.roomRequest}: ${room.title}. ${t.contactHost}`, time: "Now" }])}>{t.viewRoom}</button></article>)}{filteredRooms.length === 0 && <div className="empty">{t.noRooms}</div>}</div>
          <div className="demo-note">{t.demo}</div>
        </section>

        <aside className="chat-panel panel" id="chat"><div className="chat-head"><div><div className="eyebrow muted">{t.lounge}</div><h3><span className="live-dot"/> {t.globalChat}</h3></div><span className="chat-language">{t.allLanguages}</span></div>
          <div className="chat-body">{localizedMessages.map((m, i) => <div className={`chat-message ${m.mine ? "mine" : ""}`} key={i}><div className="avatar">{m.country}</div><div className="message-content"><div className="message-top"><b>{m.name}</b><time>{m.time}</time></div><p>{m.text}</p></div></div>)}</div>
          {!savedNick ? <div className="nick-gate"><label htmlFor="nickname">{t.chooseNickChat}</label><div className="nick-entry"><input id="nickname" placeholder={t.nickPlaceholder} value={nickname} maxLength={24} onChange={e => setNickname(e.target.value)} onKeyDown={e => e.key === "Enter" && enterChat()}/><button onClick={enterChat}>{t.join}</button></div><small>{t.nickHint}</small></div> : <div className="chat-compose"><input placeholder={`${t.messageAs} ${savedNick}...`} value={message} maxLength={240} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()}/><button aria-label={language === "pt" ? "Enviar mensagem" : "Send message"} onClick={sendMessage}><Send size={17}/></button><small>{t.linksDisabled}</small></div>}
        </aside>
      </div>

      <section className="bottom-info" id="how"><div><CircleHelp size={19}/><span><b>{t.how}</b><small>{t.howDesc}</small></span></div><div><ShieldCheck size={19}/><span><b>{t.communityFirst}</b><small>{t.communityDesc}</small></span></div><div><Globe2 size={19}/><span><b>{t.playWorldwide}</b><small>{t.playDesc}</small></span></div></section>
      <section className="discord-banner" aria-label={t.discordTitle}>
        <div className="discord-emblem"><MessageCircle size={27}/></div>
        <div className="discord-copy"><div className="eyebrow muted">AOE2 GAME FINDER</div><h2>{t.discordTitle}</h2><p>{t.discordDesc}</p></div>
        <a className="discord-btn" href="https://discord.gg/FjYTVgYf3z" target="_blank" rel="noopener noreferrer"><MessageCircle size={17}/> {t.discordButton}</a>
      </section>
      <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><Castle size={18}/></span><span>AOE2 <b>GAME FINDER</b><small>{t.footerTag}</small></span></a><span>{t.disclaimer}</span><span>© 2026 AOE2 GAME FINDER</span></footer>

      {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow muted">{t.newLobby}</div><h3>{t.createRoom}</h3></div><button className="icon-button" aria-label="Close" onClick={() => setShowCreate(false)}><X size={18}/></button></div>
        {!savedNick ? <p className="modal-warning">{t.needNick}</p> : <><label>{t.roomTitle}<input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={t.roomTitlePlaceholder}/></label><div className="modal-grid"><label>{t.gameMode}<select value={newMode} onChange={e => setNewMode(e.target.value)}><option>1v1</option><option>2v2</option><option>3v3</option><option>4v4</option></select></label><label>{t.map}<select value={newMap} onChange={e => setNewMap(e.target.value)}><option>Arabia</option><option>Arena</option><option>Black Forest</option><option>Nomad</option><option>Random</option></select></label></div><label>{t.eloRange}<select value={newElo} onChange={e => setNewElo(e.target.value)}><option value="Any ELO">{t.anyElo}</option><option value="Below 1000">{t.below1000}</option><option>1000–1200</option><option>1200–1400</option><option>1400–1600</option><option>1600+</option></select></label><button className="primary-btn full" onClick={createRoom}><Plus size={16}/> {t.createLobby}</button></>}
      </div></div>}
    </main>
  );
}
