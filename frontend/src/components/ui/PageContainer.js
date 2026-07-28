// frontend/src/components/ui/PageContainer.js
import { colors, font } from "../../styles/theme";

function PageContainer({ eyebrow, title, subtitle, action, children }) {
  return (
    <div style={page}>
      <div style={header}>
        <div>
          {eyebrow && <div style={eyebrowStyle}>{eyebrow}</div>}
          {title && <h1 style={titleStyle}>{title}</h1>}
          {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

const page = {
  padding: "28px 32px 60px",
  background: colors.paper,
  minHeight: "100vh",
  fontFamily: font.body,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: "24px",
  gap: "16px",
  flexWrap: "wrap",
};

const eyebrowStyle = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: colors.accent,
  marginBottom: "4px",
};

const titleStyle = {
  fontFamily: font.display,
  fontSize: "26px",
  fontWeight: 600,
  color: colors.ink,
  margin: 0,
};

const subtitleStyle = {
  fontSize: "13px",
  color: colors.slate,
  marginTop: "4px",
};

export default PageContainer;