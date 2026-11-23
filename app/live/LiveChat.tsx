"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AlertCircle, Castle, LoaderCircle, MessageCircle, Send, ShieldCheck, X } from "lucide-react";
import styles from "./live-chat.module.css";
import { liveText, type LiveLocale } from "./translations";

type ChatMessage = { id: string; name: string; text: string; time: string; playerId?: string };
type VisitorSession = { id: string; nickname: string };

function apiMessage(payload: unknown, fallback: string, locale: LiveLocale) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = String((payload as { error?: unknown }).error ?? "");
    if (error) {
      if (locale === "en") {
        if (error.includes("nickname já está em uso")) return liveText.en.nicknameInUse;
        if (error.includes("nickname de 3 a 24")) return liveText.en.nicknameLength;
      }
      return error;
    }
  }
  return fallback;
}

export default function LiveChat({ locale }: { locale: LiveLocale }) {
  const t = liveText[locale];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [needsNickname, setNeedsNickname] = useState(false);
  const [isChangingNickname, setIsChangingNickname] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const positionRef = useRef<{ left: number; top: number } | null>(null);

  const clampPosition = useCallback((left: number, top: number) => {
    const rect = widgetRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 390;
    const height = rect?.height ?? 590;
    return {
      left: Math.min(Math.max(8, left), Math.max(8, window.innerWidth - width - 8)),
      top: Math.min(Math.max(8, top), Math.max(8, window.innerHeight - height - 8)),
    };
  }, []);

  const updatePosition = useCallback((next: { left: number; top: number }) => {
    positionRef.current = next;
    setPosition(next);
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("aoe2-live-chat-position-v1");
      if (stored) {
        const parsed = JSON.parse(stored) as { left?: unknown; top?: unknown };
        if (typeof parsed.left === "number" && typeof parsed.top === "number") {
          updatePosition(clampPosition(parsed.left, parsed.top));
        }
      }
    } catch {
      // Ignore invalid or unavailable local storage and keep the default corner.
    }

    const onResize = () => {
      const current = positionRef.current;
      if (current) updatePosition(clampPosition(current.left, current.top));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPosition, updatePosition]);

  const handleDragStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    const rect = widgetRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    updatePosition(clampPosition(rect.left, rect.top));
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updatePosition(clampPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY));
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    const finalPosition = positionRef.current;
    if (finalPosition) {
      try {
        window.localStorage.setItem("aoe2-live-chat-position-v1", JSON.stringify(finalPosition));
      } catch {
        // The chat remains movable even when the browser blocks local storage.
      }
    }
  };

  const refreshMessages = useCallback(async () => {
    const response = await fetch("/api/messages", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiMessage(payload, t.loadChatError, locale));
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
          if (active) setError(t.chatConnectionError);
        })
        .finally(() => { if (active) setLoadingMessages(false); });

      await Promise.all([sessionTask, messageTask]);
    };

    void load();
    const timer = window.setInterval(() => {
      void refreshMessages().catch(() => {
        if (active) setError(t.chatConnectionError);
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
    if (!response.ok) throw new Error(apiMessage(payload, t.sendMessageError, locale));
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
      setError(sendError instanceof Error ? sendError.message : t.sendMessageError);
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
        body: JSON.stringify({ nickname: cleanNickname, language: locale }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(payload, t.saveNicknameError, locale));
      const visitor = payload as VisitorSession;
      setSavedNickname(visitor.nickname);
      setNickname(visitor.nickname);
      setPlayerId(visitor.id);

      if (isChangingNickname) {
        // The server updates the existing player row, so previous messages
        // are automatically displayed with the new nickname too.
        setIsChangingNickname(false);
        setNeedsNickname(false);
        setError("");
        try { await refreshMessages(); } catch { /* The next polling cycle will refresh the list. */ }
      } else {
        setNeedsNickname(false);
        if (draft.trim()) await postMessage(draft.trim());
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.enterChatError);
    } finally {
      setSending(false);
    }
  };

  const beginNicknameChange = () => {
    setNickname(savedNickname);
    setIsChangingNickname(true);
    setNeedsNickname(true);
    setError("");
  };

  const cancelNicknameChange = () => {
    setNickname(savedNickname);
    setIsChangingNickname(false);
    setNeedsNickname(false);
    setError("");
  };

  const onMessageSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSend();
  };

  return (
    <div ref={widgetRef} className={styles.widget} style={position ? { left: position.left, top: position.top, right: "auto", bottom: "auto" } : undefined}>
      {open ? (
        <section className={styles.window} aria-label={t.communityChat}>
          <header
            className={styles.header + (isDragging ? " " + styles.dragging : "")}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            title={t.dragChat}
          >
            <div className={styles.headerMark}><Castle size={20} /></div>
            <div className={styles.headerText}>
              <strong>{t.communityChat.toUpperCase()}</strong>
              <span><i /> {t.chatSubtitle.toUpperCase()}</span>
            </div>
            <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label={t.chatClose}>
              <X size={18} />
            </button>
          </header>
          <div className={styles.subheader}>
            <span><MessageCircle size={14} /> {t.globalChat.toUpperCase()}</span>
            {savedNickname ? <b>{savedNickname}</b> : <small>{t.visitor.toUpperCase()}</small>}
          </div>
          <div className={styles.messages} ref={listRef} aria-live="polite">
            {loadingMessages && messages.length === 0 ? (
              <div className={styles.loading}><LoaderCircle size={18} /> {t.loadingChat}</div>
            ) : messages.length === 0 ? (
              <div className={styles.empty}>
                <MessageCircle size={26} />
                <strong>{t.chatEmpty}</strong>
                <span>{t.chatEmptyHint}</span>
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
              <label htmlFor="live-chat-nickname">
                {isChangingNickname ? t.chooseNewNickname : t.chooseNickname}
              </label>
              <input id="live-chat-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ex.: LordArabia" minLength={3} maxLength={24} autoComplete="nickname" required autoFocus />
              <p>
                {isChangingNickname
                  ? t.nicknameChangedHint
                  : t.nicknameHint}
              </p>
              <div className={styles.nicknameActions}>
                <button type="submit" disabled={sending || nickname.trim().length < 3}>
                  {sending ? <LoaderCircle size={15} className={styles.spin} /> : <ShieldCheck size={15} />}
                  {isChangingNickname ? t.saveNewNickname.toUpperCase() : t.saveNicknameAndSend.toUpperCase()}
                </button>
                {isChangingNickname ? (
                  <button type="button" className={styles.cancelNickname} onClick={cancelNicknameChange} disabled={sending}>
                    CANCELAR
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <form className={styles.composer} onSubmit={onMessageSubmit}>
              {savedNickname ? (
                <div className={styles.savedAs}>
                  <span>{t.chattingAs} <b>{savedNickname}</b></span>
                  <button type="button" className={styles.changeNicknameButton} onClick={beginNicknameChange} disabled={sending}>
                    TROCAR NICK
                  </button>
                </div>
              ) : null}
              <div className={styles.composeRow}>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={sessionChecked ? t.messagePlaceholder : t.connectingChat} maxLength={240} disabled={!sessionChecked || sending} aria-label={t.messagePlaceholder} />
                <button type="submit" disabled={!draft.trim() || !sessionChecked || sending} aria-label={t.sendMessage}>
                  {sending ? <LoaderCircle size={18} className={styles.spin} /> : <Send size={17} />}
                </button>
              </div>
              <small>{savedNickname ? t.messageGuideline : t.firstMessageHint}</small>
            </form>
          )}
        </section>
      ) : null}
      <button type="button" className={styles.launcher + (open ? " " + styles.launcherOpen : "")} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? t.chatClose : t.openCommunityChat}>
        {open ? <X size={19} /> : <MessageCircle size={20} />}
        <span>{open ? t.chatClose.toUpperCase() : t.communityChat.toUpperCase()}</span>
        {!open ? <i /> : null}
      </button>
    </div>
  );
}
