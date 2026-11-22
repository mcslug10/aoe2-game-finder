"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Castle, LoaderCircle, MessageCircle, Send, ShieldCheck, X } from "lucide-react";
import styles from "./live-chat.module.css";

type ChatMessage = { id: string; name: string; text: string; time: string; playerId?: string };
type VisitorSession = { id: string; nickname: string };

function apiMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = String((payload as { error?: unknown }).error ?? "");
    if (error) return error;
  }
  return fallback;
}

export default function LiveChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [needsNickname, setNeedsNickname] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const refreshMessages = useCallback(async () => {
    const response = await fetch("/api/messages", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiMessage(payload, "Não foi possível carregar o chat."));
    setMessages(Array.isArray(payload.messages) ? payload.messages as ChatMessage[] : []);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSessionChecked(false);
    setLoadingMessages(true);
    setError("");

    const load = async () => {
      const sessionTask = (async () => {
        try {
          const response = await fetch("/api/session", { cache: "no-store" });
          if (response.ok) {
            const visitor = await response.json() as VisitorSession;
            if (active) {
              setSavedNickname(visitor.nickname || "");
              setNickname(visitor.nickname || "");
              setPlayerId(visitor.id || "");
            }
          }
        } catch {
          // Keep the nickname prompt available if session restoration is unavailable.
        } finally {
          if (active) setSessionChecked(true);
        }
      })();

      const messageTask = refreshMessages()
        .then(() => { if (active) setError(""); })
        .catch(() => {
          if (active) setError("O chat está temporariamente sem conexão. Tente novamente em instantes.");
        })
        .finally(() => { if (active) setLoadingMessages(false); });

      await Promise.all([sessionTask, messageTask]);
    };

    void load();
    const timer = window.setInterval(() => {
      void refreshMessages().catch(() => {
        if (active) setError("O chat está temporariamente sem conexão. Tente novamente em instantes.");
      });
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [open, refreshMessages]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const postMessage = async (message: string) => {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiMessage(payload, "Não foi possível enviar a mensagem."));
    setDraft("");
    setNeedsNickname(false);
    setError("");
    try { await refreshMessages(); } catch { /* The next polling cycle will refresh the list. */ }
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sending || !sessionChecked) return;
    if (!savedNickname) {
      setNeedsNickname(true);
      return;
    }
    setSending(true);
    try {
      await postMessage(message);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  };

  const handleNicknameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanNickname = nickname.trim();
    if (cleanNickname.length < 3 || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: cleanNickname, language: "pt" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(payload, "Não foi possível salvar seu nick."));
      const visitor = payload as VisitorSession;
      setSavedNickname(visitor.nickname);
      setNickname(visitor.nickname);
      setPlayerId(visitor.id);
      await postMessage(draft.trim());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível entrar no chat.");
    } finally {
      setSending(false);
    }
  };

  const onMessageSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSend();
  };

  return (
    <div className={styles.widget}>
      {open ? (
        <section className={styles.window} aria-label="Chat da comunidade">
          <header className={styles.header}>
            <div className={styles.headerMark}><Castle size={20} /></div>
            <div className={styles.headerText}>
              <strong>CHAT DA COMUNIDADE</strong>
              <span><i /> CONVERSE COM OUTROS JOGADORES</span>
            </div>
            <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Fechar chat">
              <X size={18} />
            </button>
          </header>
          <div className={styles.subheader}>
            <span><MessageCircle size={14} /> CHAT GLOBAL DO GAME FINDER</span>
            {savedNickname ? <b>{savedNickname}</b> : <small>VISITANTE</small>}
          </div>
          <div className={styles.messages} ref={listRef} aria-live="polite">
            {loadingMessages && messages.length === 0 ? (
              <div className={styles.loading}><LoaderCircle size={18} /> Carregando conversa...</div>
            ) : messages.length === 0 ? (
              <div className={styles.empty}>
                <MessageCircle size={26} />
                <strong>O salão está vazio</strong>
                <span>Seja o primeiro a mandar um salve para a comunidade.</span>
              </div>
            ) : messages.map((message) => (
              <article className={styles.message + " " + (message.playerId && playerId && message.playerId === playerId ? styles.mine : "")} key={message.id}>
                <span className={styles.avatar}>{(message.name || "?").slice(0, 1).toUpperCase()}</span>
                <div className={styles.messageBody}>
                  <div className={styles.messageMeta}><strong>{message.name}</strong><time>{message.time}</time></div>
                  <p>{message.text}</p>
                </div>
              </article>
            ))}
          </div>
          {error ? <div className={styles.error} role="status"><AlertCircle size={14} /> {error}</div> : null}
          {needsNickname ? (
            <form className={styles.nicknameGate} onSubmit={handleNicknameSubmit}>
              <label htmlFor="live-chat-nickname">Escolha seu nick para conversar</label>
              <input id="live-chat-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ex.: LordArabia" minLength={3} maxLength={24} autoComplete="nickname" required autoFocus />
              <p>Seu nick ficará salvo neste navegador por 30 dias.</p>
              <button type="submit" disabled={sending || nickname.trim().length < 3}>
                {sending ? <LoaderCircle size={15} className={styles.spin} /> : <ShieldCheck size={15} />}
                SALVAR NICK E ENVIAR
              </button>
            </form>
          ) : (
            <form className={styles.composer} onSubmit={onMessageSubmit}>
              {savedNickname ? <span className={styles.savedAs}>Você está conversando como <b>{savedNickname}</b></span> : null}
              <div className={styles.composeRow}>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={sessionChecked ? "Escreva uma mensagem..." : "Conectando ao chat..."} maxLength={240} disabled={!sessionChecked || sending} aria-label="Mensagem" />
                <button type="submit" disabled={!draft.trim() || !sessionChecked || sending} aria-label="Enviar mensagem">
                  {sending ? <LoaderCircle size={18} className={styles.spin} /> : <Send size={17} />}
                </button>
              </div>
              <small>{savedNickname ? "Até 240 caracteres · Respeite os outros jogadores" : "Ao enviar sua primeira mensagem, você escolhe um nick."}</small>
            </form>
          )}
        </section>
      ) : null}
      <button type="button" className={styles.launcher + (open ? " " + styles.launcherOpen : "")} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Fechar chat da comunidade" : "Abrir chat da comunidade"}>
        {open ? <X size={19} /> : <MessageCircle size={20} />}
        <span>{open ? "FECHAR CHAT" : "CHAT DA COMUNIDADE"}</span>
        {!open ? <i /> : null}
      </button>
    </div>
  );
}
