// frontend/src/components/ui/Modal.js
import { useEffect, useRef } from "react";
import { colors, font, radius, shadow } from "../../styles/theme";

function Modal({ open, onClose, title, children, maxWidth = 480 }) {
  // Keep the latest onClose in a ref so the effect below only re-runs when
  // `open` changes, not every time the parent re-renders with a new function.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close on Escape, and lock page scroll while the modal is open.
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div
        style={{ ...panel, maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={header}>
          <h3 style={titleStyle}>{title}</h3>
          <button onClick={onClose} className="am-btn" style={closeBtn} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const backdrop = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(26,26,29,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
  padding: 20,
};

const panel = {
  background: colors.surface,
  borderRadius: radius.lg,
  boxShadow: shadow.lg,
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "24px 26px",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
};

const titleStyle = {
  margin: 0,
  fontFamily: font.display,
  fontSize: "18px",
  fontWeight: 600,
  color: colors.ink,
};

const closeBtn = {
  background: "transparent",
  border: "none",
  fontSize: "26px",
  lineHeight: 1,
  color: colors.slate,
  padding: "0 4px",
};

export default Modal;