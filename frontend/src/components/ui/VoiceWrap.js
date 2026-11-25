// frontend/src/components/ui/VoiceWrap.js
// Wrap any <input> or <textarea> to give it a mic button (voice-to-text).
// If the browser can't do speech recognition, it renders the field exactly as before.
import { useEffect, useRef, useState } from "react";
import useVoiceInput, { VOICE_LANGS, setVoiceLang } from "../../hooks/useVoiceInput";

function VoiceWrap({ children, style }) {
  const wrapRef = useRef(null);
  const [multi, setMulti] = useState(false);
  const [hint, setHint] = useState("");
  const getEl = () => (wrapRef.current ? wrapRef.current.querySelector("textarea, input") : null);
  const v = useVoiceInput(getEl);

  useEffect(() => {
    const el = getEl();
    setMulti(!!el && el.tagName === "TEXTAREA");
  }, []);

  useEffect(() => {
    if (!v.message) return undefined;
    const t = setTimeout(v.clearMessage, 5000);
    return () => clearTimeout(t);
  }, [v.message]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!v.supported) {
    const explain = () => {
      setHint("Voice typing isn't supported in this browser. Please open Advomind in Chrome or Edge.");
      setTimeout(() => setHint(""), 5000);
    };
    return (
      <span ref={wrapRef} className="am-voice-wrap" style={style}>
        {children}
        <span className={`am-voice-ctl${multi ? " multi" : ""}`}>
          <button
            type="button"
            className="am-voice-btn"
            style={{ opacity: 0.5 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={explain}
            title="Voice typing isn't supported in this browser. Please use Chrome or Edge."
            aria-label="Voice typing not supported in this browser"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <line x1="12" y1="18" x2="12" y2="22" />
            </svg>
          </button>
        </span>
        {hint && <span role="status" className="am-voice-msg">{hint}</span>}
      </span>
    );
  }

  const idx = Math.max(0, VOICE_LANGS.findIndex((l) => l.code === v.lang));
  const current = VOICE_LANGS[idx];
  const next = VOICE_LANGS[(idx + 1) % VOICE_LANGS.length];

  const switchLang = () => {
    if (v.listening) v.stop();
    setVoiceLang(next.code);
  };
  const keepFocus = (e) => e.preventDefault(); // don't steal focus from the text box

  return (
    <span ref={wrapRef} className="am-voice-wrap" style={style}>
      {children}
      <span className={`am-voice-ctl${multi ? " multi" : ""}`}>
        <button
          type="button"
          className="am-voice-lang"
          onMouseDown={keepFocus}
          onClick={switchLang}
          title={`Voice language: ${current.name}. Click to switch to ${next.name}.`}
          aria-label={`Voice language ${current.name}. Switch to ${next.name}.`}
        >
          {current.short}
        </button>
        <button
          type="button"
          className={`am-voice-btn${v.listening ? " on" : ""}`}
          onMouseDown={keepFocus}
          onClick={v.toggle}
          aria-pressed={v.listening}
          title={v.listening ? "Stop voice typing" : `Voice typing (${current.name})`}
          aria-label={v.listening ? "Stop voice typing" : `Start voice typing in ${current.name}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="22" />
          </svg>
        </button>
      </span>
      {v.message && <span role="status" className="am-voice-msg">{v.message}</span>}
    </span>
  );
}

export default VoiceWrap;