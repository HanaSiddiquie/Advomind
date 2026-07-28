// frontend/src/components/ui/Input.js
import { colors, font, radius } from "../../styles/theme";

function Input({ label, style, className = "", ...props }) {
  return (
    <label style={wrapper}>
      {label && <span style={labelStyle}>{label}</span>}
      <input
        {...props}
        className={`am-input ${className}`}
        style={{ ...inputStyle, ...style }}
      />
    </label>
  );
}

const wrapper = {
  display: "block",
  width: "100%",
  marginBottom: "14px",
  textAlign: "left",
};

const labelStyle = {
  display: "block",
  fontFamily: font.body,
  fontSize: "12px",
  fontWeight: 600,
  color: colors.slate,
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle = {
  boxSizing: "border-box",
  width: "100%",
  padding: "11px 13px",
  fontFamily: font.body,
  fontSize: "14px",
  color: colors.ink,
  background: colors.surface,
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  outline: "none",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

export default Input;