// frontend/src/components/Notifications.js
// Toasts + confirm dialog. Mount <Notifications /> ONCE (in App.js).
//
// - Every existing alert("...") in the app now shows as a toast automatically.
// - Use `await confirmDialog("...")` instead of window.confirm("...").
import { useEffect, useRef, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";

const toastListeners = new Set();
const confirmListeners = new Set();
let nextId = 1;

function guessKind(text) {
  if (/please note|warning/i.test(text)) return "warn";
  if (/fail|error|wrong|denied|permission|invalid|unsupported|couldn't|can't|cannot|disabled|not found/i.test(text)) return "error";
  if (/success|created|sent|deleted|removed|moved|restored|updated|saved|extracted|\bdone\b/i.test(text)) return "success";
  return "info";
}

export function toast(message, kind) {
  const text = String(message == null ? "" : message);
  if (!text) return;
  const item = { id: nextId++, text, kind: kind || guessKind(text) };
  toastListeners.forEach((fn) => fn(item));
}

export function confirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    // Safety net: if the host isn't mounted, fall back to the browser's dialog.
    if (confirmListeners.size === 0) {
      resolve(window.__amNativeConfirm ? window.__amNativeConfirm(String(message)) : false);
      return;
    }
    const text = String(message);
    const danger = options.danger != null ? options.danger : /delete|remove|permanent/i.test(text);
    const confirmText =
      options.confirmText ||
      (/delete/i.test(text) ? "Delete" : /remove/i.test(text) ? "Remove" : "Confirm");
    const req = { message: text, danger, confirmText, title: options.title || (danger ? "Are you sure?" : "Please confirm"), requireText: options.requireText || null, resolve };
    confirmListeners.forEach((fn) => fn(req));
  });
}

// Route every existing alert("...") through the toast host.
if (typeof window !== "undefined") {
  if (!window.__amNativeAlert) window.__amNativeAlert = window.alert.bind(window);
  if (!window.__amNativeConfirm) window.__amNativeConfirm = window.confirm.bind(window);
  window.alert = (message) => {
    if (toastListeners.size === 0) window.__amNativeAlert(message);
    else toast(message);
  };
}

export default function Notifications() {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [typed, setTyped] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    const onToast = (t) => {
      setToasts((list) => [...list.slice(-3), t]);
      const ms = Math.min(12000, 3500 + t.text.length * 35);
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), ms);
    };
    const onConfirm = (req) => {
      if (dialogRef.current) dialogRef.current.resolve(false);
      dialogRef.current = req;
      setTyped("");
      setDialog(req);
    };
    toastListeners.add(onToast);
    confirmListeners.add(onConfirm);
    return () => {
      toastListeners.delete(onToast);
      confirmListeners.delete(onConfirm);
    };
  }, []);

  const closeDialog = (result) => {
    const d = dialogRef.current;
    dialogRef.current = null;
    setDialog(null);
    if (d) d.resolve(result);
  };

  return (
    <>
      <div className="am-toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`am-toast am-toast-${t.kind}`}
            role="status"
            onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
          >
            {t.text}
          </div>
        ))}
      </div>

      <Modal open={!!dialog} onClose={() => closeDialog(false)} title={dialog ? dialog.title : ""} maxWidth={420}>
        {dialog && (
          <>
                        <p className="am-confirm-text">{dialog.message}</p>
            {dialog.requireText && (
              <Input
                label={`Type ${dialog.requireText} to confirm`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" autoFocus onClick={() => closeDialog(false)} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button
  variant={dialog.danger ? "danger" : "primary"}
  disabled={!!dialog.requireText && typed.trim().toLowerCase() !== dialog.requireText.trim().toLowerCase()}
  onClick={() => closeDialog(true)}
  style={{ flex: 1 }}
>
                {dialog.confirmText}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}