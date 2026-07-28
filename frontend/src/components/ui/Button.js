// frontend/src/components/ui/Button.js
import { colors, font, radius } from "../../styles/theme";

const variants = {
  primary: {
    background: colors.accent,
    color: colors.white,
    border: `1px solid ${colors.accent}`,
  },
  dark: {
    background: colors.ink,
    color: colors.white,
    border: `1px solid ${colors.ink}`,
  },
  secondary: {
    background: colors.surface,
    color: colors.ink,
    border: `1px solid ${colors.hairline}`,
  },
  danger: {
    background: colors.dangerSoft,
    color: colors.danger,
    border: `1px solid ${colors.danger}`,
  },
  ghost: {
    background: "transparent",
    color: colors.slate,
    border: "1px solid transparent",
  },
};

function Button({ variant = "primary", full, style, className = "", children, ...props }) {
  return (
    <button
      {...props}
      className={`am-btn ${className}`}
      style={{
        ...base,
        ...variants[variant],
        width: full ? "100%" : "auto",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

const base = {
  padding: "10px 18px",
  fontFamily: font.body,
  fontSize: "14px",
  fontWeight: 600,
  borderRadius: radius.sm,
  outline: "none",
};

export default Button;