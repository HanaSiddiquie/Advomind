// frontend/src/hooks/useVoiceInput.js
// Voice-to-text using the browser's built-in speech recognition (free, no API key).
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "advomind_voice_lang";

export const VOICE_LANGS = [
  { code: "en-US", short: "EN", name: "English" },
  { code: "ur-PK", short: "اردو", name: "Urdu" },
];

const MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent || "");

const getSR = () =>
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const voiceSupported = () => !!getSR();

/* ---- language is shared by every mic button and remembered ---- */
function readLang() {
  try {
    const v = localStorage.getItem(KEY);
    if (VOICE_LANGS.some((l) => l.code === v)) return v;
  } catch (e) {}
  return "en-US";
}
let currentLang = readLang();
const listeners = new Set();

export function setVoiceLang(code) {
  currentLang = code;
  try { localStorage.setItem(KEY, code); } catch (e) {}
  listeners.forEach((f) => f(code));
}

/* ---- write into a React-controlled input/textarea so its onChange fires ---- */
function setNativeValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const ERRORS = {
  "not-allowed": "Microphone is blocked. Click the lock icon in the address bar and allow the microphone.",
  "service-not-allowed": "Microphone is blocked. Click the lock icon in the address bar and allow the microphone.",
  "audio-capture": "No microphone found.",
  network: "Voice typing needs an internet connection (and a browser like Chrome or Edge).",
  "no-speech": "Didn't hear anything. Tap the mic and try again.",
  "language-not-supported": "This browser doesn't support that language for voice typing.",
};

let activeStop = null; // only one mic listens at a time

export default function useVoiceInput(getEl) {
  const [lang, setLang] = useState(currentLang);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const sessionRef = useRef(null);
  const getElRef = useRef(getEl);
  getElRef.current = getEl;

  useEffect(() => {
    listeners.add(setLang);
    return () => { listeners.delete(setLang); };
  }, []);

  const stop = useCallback(() => {
    const s = sessionRef.current;
    if (s) s.stop();
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    const el = getElRef.current();
    if (!SR || !el || el.disabled || el.readOnly) return;
    if (activeStop) activeStop();
    setMessage("");

    const rec = new SR();
    rec.lang = currentLang;
    rec.interimResults = true;
    rec.continuous = !MOBILE; // phones repeat words in continuous mode, so tap again after a pause
    rec.maxAlternatives = 1;

    const base = el.value || "";
    const sep = base && !/\s$/.test(base) ? " " : "";
        let ignore = false;
    let last = base; // what the box held after our last write
    el.setAttribute("dir", "auto"); // lets Urdu text sit right-to-left

    const onKey = () => { ignore = true; try { rec.stop(); } catch (e) {} }; // typing takes over
    el.addEventListener("keydown", onKey);

    const stopThis = () => { try { rec.stop(); } catch (e) {} };

    const teardown = () => {
      el.removeEventListener("keydown", onKey);
      if (activeStop === stopThis) activeStop = null;
      if (sessionRef.current && sessionRef.current.rec === rec) sessionRef.current = null;
    };

    rec.onresult = (e) => {
            if (ignore) return;
      // the box was changed by something else (message sent, text pasted/cleared): stop, don't overwrite it
      if (el.value !== last) { ignore = true; try { rec.stop(); } catch (err) {} return; }
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      let value = base + sep + text.replace(/^\s+/, "");
      if (el.maxLength > 0) value = value.slice(0, el.maxLength); // respect maxLength
      last = value;
      setNativeValue(el, value);
      el.scrollTop = el.scrollHeight;
    };
    rec.onerror = (e) => {
      const m = ERRORS[e.error];
      if (m) setMessage(m);
    };
    rec.onend = () => {
      teardown();
      setListening(false);
    };

    try {
      rec.start();
    } catch (e) {
      teardown();
      setMessage("Couldn't start the microphone. Please try again.");
      return;
    }
    sessionRef.current = { rec, stop: stopThis, teardown };
    activeStop = stopThis;
    setListening(true);
  }, []);

  // leaving the page while listening: shut the microphone
  useEffect(() => () => {
    const s = sessionRef.current;
    if (s) {
      s.rec.onresult = s.rec.onerror = s.rec.onend = null;
      try { s.rec.abort(); } catch (e) {}
      s.teardown();
    }
  }, []);

  return {
    supported: voiceSupported(),
    listening,
    lang,
    message,
    clearMessage: () => setMessage(""),
    toggle: () => (listening ? stop() : start()),
    stop,
  };
}