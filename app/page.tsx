"use client";

import { useMemo, useState } from "react";
import { Castle, ChevronDown, CircleHelp, Filter, Globe2, MessageCircle, Plus, Search, Send, ShieldCheck, Swords, Users, X } from "lucide-react";

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

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [savedNick, setSavedNick] = useState("");
  const [messages, setMessages] = useState(starterMessages);
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
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><Castle size={23}/></span><span>AOE2 <b>GAME FINDER</b><small>THE COMMUNITY MATCH HUB</small></span></a>
        <nav><a className="active" href="#rooms">Find a game</a><a href="#chat">Global chat</a><a href="#how">How it works</a></nav>
        <div className="top-actions"><span className="online"><i/> COMMUNITY HUB</span><button className="nick-button" onClick={() => document.getElementById("nickname")?.focus()}>{savedNick || "Choose nickname"} <ChevronDown size={15}/></button></div>
      </header>

      <section className="hero">
        <div className="hero-shade"/>
        <div className="hero-content">
          <div className="eyebrow"><span/> THE BATTLEFIELD IS CALLING</div>
          <h1>YOUR NEXT<br/><em>GG</em> STARTS HERE.</h1>
          <p>Find your next Age of Empires II: Definitive Edition match.<br/>Meet players, build teams and get into the game.</p>
          <div className="hero-actions"><a className="primary-btn" href="#rooms"><Swords size={17}/> FIND A MATCH</a><a className="ghost-btn" href="#chat"><MessageCircle size={17}/> JOIN THE CHAT</a></div>
        </div>
        <div className="hero-stats">
          <div><strong>GLOBAL</strong><span>COMMUNITY</span></div><div><strong>24/7</strong><span>PLAYER MATCHMAKING</span></div><div><strong>DE</strong><span>DEFINITIVE EDITION</span></div>
        </div>
      </section>

      <section className="intro-row">
        <div><div className="eyebrow muted">COMMUNITY MATCHMAKING</div><h2>Find your <em>battle.</em></h2><p>Open rooms, meet your teammates and organize a match in minutes.</p></div>
        <div className="feature-pills"><span><Globe2 size={15}/> Worldwide</span><span><Users size={15}/> Open community</span><span><ShieldCheck size={15}/> Moderated chat</span></div>
      </section>

      <div className="dashboard">
        <section className="rooms-panel panel" id="rooms">
          <div className="panel-heading"><div><div className="eyebrow muted">LIVE LOBBIES</div><h3>Open matches <span className="count">{filteredRooms.length}</span></h3></div><button className="create-btn" onClick={() => setShowCreate(true)}><Plus size={16}/> Create room</button></div>
          <div className="filters">
            <label className="searchbox"><Search size={16}/><input placeholder="Search rooms, maps or players..." value={search} onChange={e => setSearch(e.target.value)}/></label>
            <label><Filter size={15}/><select value={mode} onChange={e => setMode(e.target.value)}><option>All modes</option><option>1v1</option><option>2v2</option><option>3v3</option><option>4v4</option></select></label>
            <label><Globe2 size={15}/><select value={region} onChange={e => setRegion(e.target.value)}><option>All regions</option><option>Americas</option><option>Europe</option><option>Asia</option></select></label>
          </div>
          <div className="room-list">
            {filteredRooms.map(room => <article className="room" key={room.id}>
              <div className="room-icon"><Swords size={20}/></div><div className="room-main"><div className="room-title">{room.title}</div><div className="room-meta"><span>{room.mode}</span><span>{room.map}</span><span>{room.elo} ELO</span><span>{room.region}</span></div><div className="room-host">HOSTED BY <b>{room.host}</b></div></div>
              <div className="room-players"><strong>{room.players}</strong><small>PLAYERS</small></div><button className="join-btn" onClick={() => setMessages(prev => [...prev, { name: "SYSTEM", country: "⚔", text: `Room request: ${room.title}. Contact host ${room.host} in global chat.`, time: "Now" }])}>VIEW ROOM</button>
            </article>)}
            {filteredRooms.length === 0 && <div className="empty">No rooms match these filters. Try another search.</div>}
          </div>
          <div className="demo-note">DEMO PREVIEW · Room listings become shared across users after backend activation.</div>
        </section>

        <aside className="chat-panel panel" id="chat">
          <div className="chat-head"><div><div className="eyebrow muted">COMMUNITY LOUNGE</div><h3><span className="live-dot"/> Global chat</h3></div><span className="chat-language">ALL LANGUAGES</span></div>
          <div className="chat-body">
            {messages.map((m, i) => <div className={`chat-message ${m.mine ? "mine" : ""}`} key={i}><div className="avatar">{m.country}</div><div className="message-content"><div className="message-top"><b>{m.name}</b><time>{m.time}</time></div><p>{m.text}</p></div></div>)}
          </div>
          {!savedNick ? <div className="nick-gate"><label htmlFor="nickname">Choose a nickname to join the conversation</label><div className="nick-entry"><input id="nickname" placeholder="Your in-game nickname" value={nickname} maxLength={24} onChange={e => setNickname(e.target.value)} onKeyDown={e => e.key === "Enter" && enterChat()}/><button onClick={enterChat}>JOIN</button></div><small>3–24 characters · No account required</small></div> :
            <div className="chat-compose"><input placeholder={`Message as ${savedNick}...`} value={message} maxLength={240} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()}/><button aria-label="Send message" onClick={sendMessage}><Send size={17}/></button><small>Links are disabled · Be respectful</small></div>}
        </aside>
      </div>

      <section className="bottom-info" id="how"><div><CircleHelp size={19}/><span><b>How it works</b><small>Pick a nickname, find a lobby or create your own, then meet your next opponents.</small></span></div><div><ShieldCheck size={19}/><span><b>Community first</b><small>Chat rules and moderation tools help keep the hub welcoming.</small></span></div><div><Globe2 size={19}/><span><b>Play worldwide</b><small>Connect with the AoE2 DE community, wherever you play.</small></span></div></section>
      <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><Castle size={18}/></span><span>AOE2 <b>GAME FINDER</b><small>FIND YOUR NEXT GG.</small></span></a><span>COMMUNITY PROJECT · NOT AFFILIATED WITH AGE OF EMPIRES OR MICROSOFT</span><span>© 2026 AOE2 GAME FINDER</span></footer>

      {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow muted">START A NEW LOBBY</div><h3>Create a room</h3></div><button className="icon-button" onClick={() => setShowCreate(false)}><X size={18}/></button></div>
        {!savedNick ? <p className="modal-warning">Join the chat with a nickname before creating a room.</p> : <><label>Room title<input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Arabia 1v1 practice"/></label><div className="modal-grid"><label>Game mode<select value={newMode} onChange={e => setNewMode(e.target.value)}><option>1v1</option><option>2v2</option><option>3v3</option><option>4v4</option></select></label><label>Map<select value={newMap} onChange={e => setNewMap(e.target.value)}><option>Arabia</option><option>Arena</option><option>Black Forest</option><option>Nomad</option><option>Random</option></select></label></div><label>ELO range<select value={newElo} onChange={e => setNewElo(e.target.value)}><option>Any ELO</option><option>Below 1000</option><option>1000–1200</option><option>1200–1400</option><option>1400–1600</option><option>1600+</option></select></label><button className="primary-btn full" onClick={createRoom}><Plus size={16}/> CREATE LOBBY</button></>}
      </div></div>}
    </main>
  );
}
