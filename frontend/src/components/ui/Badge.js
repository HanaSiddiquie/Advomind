// frontend/src/components/ui/Badge.js
import { colors, font, radius } from "../../styles/theme";

const tones = {
  neutral: { background: colors.hairline, color: colors.charcoal },
  accent: { background: colors.accentSoft, color: colors.accent },
  success: { background: colors.successSoft, color: colors.success },
  danger: { background: colors.dangerSoft, color: colors.danger },
  dark: { background: colors.ink, color: colors.white },
};

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
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export default Badge;