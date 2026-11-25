// frontend/src/components/ui/Loading.js
import { colors, font } from "../../styles/theme";

function Loading({ label = "Loading…", full }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: full ? 0 : "56px 0",
        minHeight: full ? "100vh" : undefined,
        fontFamily: font.body,
        fontSize: 13,
        color: colors.slate,
      }}
    >
      <div className="am-spinner" />
      <span>{label}</span>
    </div>
  );
}

export default Loading;