// frontend/src/components/ChatPanel.js
// The AdvoChat chat. Used on the AdvoChat page (general legal Q&A)
// and inside a case (pass caseId to also answer questions about that case).
import { useEffect, useRef, useState } from "react";
import Button from "./ui/Button";
import MoreMenu from "./ui/MoreMenu";
import VoiceWrap from "./ui/VoiceWrap";
import { askAdvoChat, listThreads, getThread, renameThread, deleteThread, getChatStatus } from "../services/chatApi";
import { confirmDialog, toast } from "./Notifications";

const GENERAL_SUGGESTIONS = [
  "What is the punishment for theft?",
  "When can bail be granted in a non-bailable offence?",
  "Explain Order 7 Rule 11 CPC",
  "دفعہ 302 پی پی سی کیا ہے؟",
  "Chori ki saza kya hai?",
];

const CASE_SUGGESTIONS = [
  "Summarize this case",
  "What hearings are coming up?",
  "Is anything outstanding in this case?",
  "اس کیس کا خلاصہ بتائیں",
];

const MAX_CHARS = 1500;
let idCounter = 0;
const newId = () => `m${Date.now()}_${idCounter++}`;

const MODEL_KEY = "advomind_chat_model";
const modelName = (m) => (String(m || "").startsWith("local:") ? "Own model" : "Gemini");
const readModel = () => {
  try {
    const v = localStorage.getItem(MODEL_KEY);
    return v === "local" || v === "gemini" ? v : "";
  } catch (e) {
    return "";
  }
};

/* ---------- tiny formatter: **bold**, bullet / numbered lists, [n] citations ---------- */
function inline(text, onCite, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*|\[\d{1,2}\])/g).map((part, i) => {
    if (!part) return null;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${keyPrefix}${i}`}>{part.slice(2, -2)}</strong>;
    const cite = part.match(/^\[(\d{1,2})\]$/);
    if (cite && onCite) {
      return (
        <button
          key={`${keyPrefix}${i}`}
          type="button"
          className="am-cite"
          aria-label={`Open source ${cite[1]}`}
          onClick={() => onCite(Number(cite[1]))}
        >
          {cite[1]}
        </button>
      );
    }
    return part;
  });
}

function RichText({ text, onCite }) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let list = null;

  const flush = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) {
        flush();
        list = { type, items: [] };
      }
      list.items.push((bullet || numbered)[1]);
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      blocks.push({ type: "p", text: line });
    }
    if (idx === lines.length - 1) flush();
  });

  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "p") {
          return <p key={i} className="am-chat-p" dir="auto">{inline(b.text, onCite, `p${i}-`)}</p>;
        }
        const Tag = b.type;
        return (
          <Tag key={i} className="am-chat-list" dir="auto">
            {b.items.map((it, j) => <li key={j}>{inline(it, onCite, `l${i}-${j}-`)}</li>)}
          </Tag>
        );
      })}
    </>
  );
}

function Sources({ sources, openN, setOpenN }) {
  const cited = sources.filter((s) => s.cited);
  const shown = cited.length ? cited : sources.slice(0, 3);
  if (!shown.length) return null;

  const open = sources.find((s) => s.n === openN);

  return (
    <div className="am-sources">
      <div className="am-sources-label">{cited.length ? "Sources" : "Related sections searched"}</div>
      <div className="am-sources-row">
        {shown.map((s) => (
          <button
            key={s.n}
            type="button"
            className={`am-source-chip${openN === s.n ? " active" : ""}`}
            aria-expanded={openN === s.n}
            onClick={() => setOpenN(openN === s.n ? null : s.n)}
          >
            <span className="am-source-n">{s.n}</span> {s.short}
            {s.parts > 1 ? ` (${s.part}/${s.parts})` : ""}
          </button>
        ))}
      </div>
      {open && (
        <div className="am-source-detail">
          <div className="am-source-title">
            {open.citation}
            {open.omitted ? " — omitted / repealed" : ""}
          </div>
          {open.heading && <div className="am-source-heading">{open.heading}</div>}
          <div className="am-source-text">{open.text}</div>
        </div>
      )}
    </div>
  );
}

function Bubble({ m, onRetry, onSwitch, switchLabel }) {
  const [openN, setOpenN] = useState(null);

  if (m.role === "user") {
    return (
      <div className="am-msg am-msg-user">
        <div className="am-bubble am-bubble-user" dir="auto">{m.text}</div>
      </div>
    );
  }

  if (m.error) {
    return (
      <div className="am-msg">
        <div className="am-bubble am-bubble-error" role="alert">
          <div>{m.text}</div>
                    {onRetry && (
            <button type="button" className="am-link-btn" onClick={onRetry}>Try again</button>
          )}
          {onSwitch && (
            <button type="button" className="am-link-btn" onClick={onSwitch}>{switchLabel}</button>
          )}
        </div>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.text);
      toast("Answer copied", "success");
    } catch (e) {
      toast("Couldn't copy — select the text and copy manually", "error");
    }
  };

  return (
    <div className="am-msg">
      <div className="am-bubble am-bubble-bot">
        <RichText text={m.text} onCite={(n) => setOpenN((cur) => (cur === n ? null : n))} />
        <Sources sources={m.sources || []} openN={openN} setOpenN={setOpenN} />
        {m.filesSkipped && m.filesSkipped.length > 0 && (
          <div className="am-chat-note">
            {m.filesSkipped.length} uploaded file{m.filesSkipped.length > 1 ? "s were" : " was"} not used
            (text not extracted or low quality).
          </div>
        )}
                <div className="am-bubble-actions">
          <button type="button" className="am-link-btn" onClick={copy}>Copy</button>
          {m.model && <span className="am-model-tag">Answered by {modelName(m.model)}</span>}
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel({ caseId, bare }) {
  const [threads, setThreads] = useState([]);
  const [threadsState, setThreadsState] = useState("loading"); // loading | ready | error
  const [activeId, setActiveId] = useState(null);              // null = a new, unsaved chat
  const [title, setTitle] = useState("New chat");
  const [messages, setMessages] = useState([]);
  const [opening, setOpening] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [model, setModel] = useState(readModel);       // "local" (own model) | "gemini" | "" (not chosen yet)
  const [providers, setProviders] = useState(null);    // what the server has set up
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const renamingRef = useRef(null);

  const loadThreads = async () => {
    setThreadsState("loading");
    try {
      setThreads(await listThreads(caseId));
      setThreadsState("ready");
    } catch (err) {
      setThreadsState("error");
    }
  };

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

    useEffect(() => {
    let alive = true;
    getChatStatus().then((s) => {
      if (!alive || !s || !s.providers) return;
      setProviders(s.providers);
      setModel((cur) => {
        if (cur === "local" && !s.providers.local) return s.providers.gemini ? "gemini" : "";
        if (cur === "gemini" && !s.providers.gemini) return s.providers.local ? "local" : "";
        if (cur) return cur;
        return s.providers.local ? "local" : "gemini";
      });
    });
    return () => { alive = false; };
  }, []);

  const chooseModel = (value) => {
    setModel(value);
    try { localStorage.setItem(MODEL_KEY, value); } catch (e) {}
  };

  useEffect(() => {
    if (bottomRef.current && bottomRef.current.scrollIntoView) {
      bottomRef.current.scrollIntoView({ block: "end" });
    }
  }, [messages, busy, opening]);

  const newChat = () => {
    setActiveId(null);
    setTitle("New chat");
    setMessages([]);
    setDrawer(false);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
  };

  const openThread = async (id) => {
    if (busy || id === activeId) {
      setDrawer(false);
      return;
    }
    setOpening(true);
    setDrawer(false);
    try {
      const t = await getThread(id);
      setActiveId(id);
      setTitle(t.title || "Chat");
      setMessages(t.messages || []);
    } catch (err) {
      toast(err.message || "Couldn't open that chat", "error");
    } finally {
      setOpening(false);
    }
  };

  const bumpThread = (id, newTitle) => {
    setThreads((list) => {
      const existing = list.find((t) => t.id === id);
      const updated = { id, title: newTitle || (existing && existing.title) || "New chat", updatedAt: Date.now() };
      return [updated, ...list.filter((t) => t.id !== id)];
    });
  };

    const send = async (textOverride, modelOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy || opening) return;

    setMessages((list) => [...list.filter((m) => !m.error), { id: newId(), role: "user", text }]);
    setInput("");
    setBusy(true);

    try {
            const data = await askAdvoChat({ message: text, threadId: activeId, caseId, model: modelOverride || model || undefined });
      setMessages((list) => [
        ...list,
        {
          id: newId(),
          role: "assistant",
          text: data.answer,
          sources: data.sources || [],
                    filesSkipped: data.filesSkipped || [],
          model: data.model || "",
        },
      ]);
      if (data.saved === false) {
        toast("Answer shown, but it couldn't be saved to your chat history", "warn");
      } else if (data.threadId) {
        if (!activeId) {
          setActiveId(data.threadId);
          setTitle(data.title || "New chat");
        }
        bumpThread(data.threadId, data.title);
      }
    } catch (err) {
      setMessages((list) => [
        ...list,
                { id: newId(), role: "assistant", error: true, text: err.message || "Something went wrong.", retryText: text, usedModel: modelOverride || model },
      ]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

    const retry = (m, useModel) => {
    if (useModel) chooseModel(useModel);
    // drop the failed attempt and its question, then ask again
    setMessages((list) => {
      const idx = list.findIndex((x) => x.id === m.id);
      return idx > 0 ? list.slice(0, idx - 1) : list.filter((x) => x.id !== m.id);
    });
        setTimeout(() => send(m.retryText, useModel), 0);
  };

  const startRename = (t) => {
    renamingRef.current = t.id;
    setRenamingId(t.id);
    setRenameValue(t.title);
  };

  const commitRename = async (t, save) => {
    if (renamingRef.current !== t.id) return; // already handled (Enter then blur)
    renamingRef.current = null;
    setRenamingId(null);
    const name = renameValue.trim();
    if (!save || !name || name === t.title) return;
    try {
      const r = await renameThread(t.id, name);
      setThreads((list) => list.map((x) => (x.id === t.id ? { ...x, title: r.title } : x)));
      if (t.id === activeId) setTitle(r.title);
      toast("Chat renamed", "success");
    } catch (err) {
      toast(err.message || "Couldn't rename this chat", "error");
    }
  };

  const removeThread = async (t) => {
    const ok = await confirmDialog(`Delete "${t.title}"? This can't be undone.`, { danger: true, confirmText: "Delete" });
    if (!ok) return;
    try {
      await deleteThread(t.id);
      setThreads((list) => list.filter((x) => x.id !== t.id));
      if (t.id === activeId) newChat();
      toast("Chat deleted", "success");
    } catch (err) {
      toast(err.message || "Couldn't delete this chat", "error");
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

    const suggestions = caseId ? CASE_SUGGESTIONS : GENERAL_SUGGESTIONS;

  // after a failed answer, offer the other model
  const switchFor = (m) => {
    if (!m.error || !m.retryText) return {};
    const other = m.usedModel === "local" ? "gemini" : m.usedModel === "gemini" ? "local" : null;
    if (!other || (providers && !providers[other])) return {};
    return {
      onSwitch: () => retry(m, other),
      switchLabel: other === "gemini" ? "Ask Gemini instead" : "Ask our own model instead",
    };
  };

  return (
    <div className={`am-chat${bare ? " am-chat-bare" : ""}`}>
      <aside className={`am-chat-side${drawer ? " open" : ""}`} aria-label="Your chats">
        <button type="button" className="am-newchat" onClick={newChat}>+ New chat</button>

        <div className="am-thread-label">{caseId ? "Chats about this case" : "Your chats"}</div>

        <ul className="am-thread-list">
          {threadsState === "loading" && <li className="am-thread-note">Loading…</li>}
          {threadsState === "error" && (
            <li className="am-thread-note">
              Couldn't load your chats.{" "}
              <button type="button" className="am-link-btn" onClick={loadThreads}>Retry</button>
            </li>
          )}
          {threadsState === "ready" && threads.length === 0 && (
            <li className="am-thread-note">No saved chats yet. Ask a question to start one.</li>
          )}

          {threads.map((t) => (
            <li key={t.id} className={`am-thread${t.id === activeId ? " active" : ""}`}>
              {renamingId === t.id ? (
                <input
                  className="am-thread-rename"
                  autoFocus
                  dir="auto"
                  maxLength={60}
                  value={renameValue}
                  aria-label="Chat name"
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(t, true);
                    if (e.key === "Escape") commitRename(t, false);
                  }}
                  onBlur={() => commitRename(t, true)}
                />
              ) : (
                <button type="button" className="am-thread-btn" dir="auto" title={t.title} onClick={() => openThread(t.id)}>
                  {t.title}
                </button>
              )}
              <MoreMenu
                label={`Options for ${t.title}`}
                items={[
                  { label: "Rename", onClick: () => startRename(t) },
                  { label: "Delete…", danger: true, onClick: () => removeThread(t) },
                ]}
              />
            </li>
          ))}
        </ul>
      </aside>

      {drawer && <div className="am-chat-backdrop" onClick={() => setDrawer(false)} />}

      <section className="am-chat-main">
        <div className="am-chat-head">
          <button type="button" className="am-chat-menu-btn" onClick={() => setDrawer((d) => !d)} aria-expanded={drawer}>
            ☰ Chats
          </button>
                    <span className="am-chat-title" dir="auto">{title}</span>
          <select
            className="am-model-select"
            aria-label="Answer with"
            title="Choose which model answers your questions"
            value={model || (providers && providers.local ? "local" : "gemini")}
            disabled={busy}
            onChange={(e) => chooseModel(e.target.value)}
          >
            <option value="local" disabled={!!providers && !providers.local}>
              Own model{providers && providers.local && providers.localReachable === false ? " (offline?)" : ""}
            </option>
            <option value="gemini" disabled={!!providers && !providers.gemini}>Gemini</option>
          </select>
          <button type="button" className="am-link-btn am-chat-newbtn" onClick={newChat}>+ New</button>
        </div>

        <div className="am-chat-scroll" aria-live="polite">
          {opening && <div className="am-thread-note" style={{ textAlign: "center" }}>Opening chat…</div>}

          {!opening && messages.length === 0 && (
            <div className="am-chat-empty">
              <div className="am-chat-empty-icon" aria-hidden="true">⚖</div>
              <div className="am-chat-empty-title">
                {caseId ? "Ask AdvoChat about this case" : "Ask AdvoChat a legal question"}
              </div>
              <p className="am-chat-empty-text">
                {caseId
                  ? "I can answer from this case's notes, hearings and documents, and cite the statutes."
                  : "I search the Constitution, PPC, CrPC, CPC, Qanun-e-Shahadat and Contract Act, and cite the sections I use."}
                {" "}English, اردو and Roman Urdu are all fine.
              </p>
              <div className="am-chat-suggestions">
                {suggestions.map((s) => (
                  <button key={s} type="button" className="am-chip" dir="auto" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!opening && messages.map((m) => (
            <Bubble key={m.id} m={m} onRetry={m.error && m.retryText ? () => retry(m) : null} {...switchFor(m)} />
          ))}

          {busy && (
            <div className="am-msg">
              <div className="am-bubble am-bubble-bot am-typing" role="status">
                <span /><span /><span />
                <em>Thinking…</em>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="am-chat-inputbar">
                    <VoiceWrap style={{ flex: "1 1 auto", minWidth: 0 }}>
            <textarea
              ref={inputRef}
              className="am-input am-chat-input"
              dir="auto"
              rows={2}
              maxLength={MAX_CHARS}
              value={input}
              disabled={busy || opening}
              placeholder="Type your question…  (Enter to send, Shift+Enter for a new line)"
              aria-label="Your question"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </VoiceWrap>
          <Button onClick={() => send()} disabled={busy || opening || !input.trim()} style={{ alignSelf: "stretch" }}>
            Send
          </Button>
        </div>

        <div className="am-chat-footer">
          <span>
            AdvoChat answers only from the statutes loaded in Advomind and may not reflect recent amendments.
            Always verify before relying on them.
          </span>
        </div>
      </section>
    </div>
  );
}