// frontend/src/components/ui/EmptyState.js
import { colors, font, radius } from "../../styles/theme";
import Button from "./Button";

export default function EmptyState({ icon = "📄", title, text, action, onAction }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        textAlign: "center",
        padding: "36px 20px",
        background: colors.surface,
        border: `1px dashed ${colors.hairline}`,
        borderRadius: radius.md,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden="true">{icon}</div>
      <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: colors.ink }}>
        {title}
      </div>
      {text && (
        <p style={{ fontSize: 13, color: colors.slate, margin: "6px auto 0", maxWidth: 380, lineHeight: 1.5 }}>
          {text}
        </p>
      )}
      {action && onAction && (
        <Button onClick={onAction} style={{ marginTop: 16 }}>{action}</Button>
      )}
    </div>
  );
}