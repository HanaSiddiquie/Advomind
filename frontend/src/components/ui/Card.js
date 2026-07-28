// frontend/src/components/ui/Card.js
import { colors, radius, shadow } from "../../styles/theme";

function Card({ children, hoverable, onClick, style }) {
  return (
    <div
      onClick={onClick}
      className={hoverable ? "am-card-hover" : ""}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.hairline}`,
        borderRadius: radius.md,
        boxShadow: shadow.sm,
        padding: "18px",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Card;