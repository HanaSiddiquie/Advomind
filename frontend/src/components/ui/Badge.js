// frontend/src/components/ui/Badge.js
import { colors, font, radius } from "../../styles/theme";

const tones = {
  neutral: { background: colors.hairline, color: colors.charcoal },
  accent: { background: colors.accentSoft, color: colors.accent },
  success: { background: colors.successSoft, color: colors.success },
  danger: { background: colors.dangerSoft, color: colors.danger },
  dark: { background: colors.ink, color: colors.white },
  warn: { background: "#FBF3E0", color: "#8A5A00" },
  info: { background: "#E8EEF7", color: "#234A7D" },
  civil: { background: "#E3F1EF", color: "#0F5E55" },
  criminal: { background: "#F1E6F4", color: "#6B2A7A" },
};

// Case status -> badge colour
export function statusTone(status) {
  switch (status) {
    case "Open": return "success";
    case "In Progress": return "info";
    case "On Hold": return "warn";
    default: return "neutral"; // Closed, Archived, unknown
  }
}

function Badge({ children, tone = "neutral", style }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: font.body,
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "4px 10px",
        borderRadius: radius.sm,
        ...(tones[tone] || tones.neutral),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export default Badge;