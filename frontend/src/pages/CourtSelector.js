// frontend/src/pages/CourtSelector.js
import { useNavigate } from "react-router-dom";
import { colors, font, radius, shadow } from "../styles/theme";
import { useAuthRole } from "../context/AuthRoleContext";

const ALL_COURTS = [
  { key: "civil", label: "Civil Court", desc: "Contracts, property, and civil disputes" },
  { key: "session", label: "Session Court", desc: "Criminal trials and sessions matters" },
  { key: "high", label: "High Court", desc: "Appeals and constitutional matters" },
];

function CourtSelector() {
  const navigate = useNavigate();
  const { isLawyer, assignedCourts } = useAuthRole();

  const COURTS = isLawyer
    ? ALL_COURTS
    : ALL_COURTS.filter(c => (assignedCourts || []).includes(c.key));

  const selectCourt = (court) => {
    localStorage.setItem("court", court);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div style={container}>
      <div style={box}>
        <div style={eyebrow}>Before you continue</div>
        <h1 style={title}>Select Court</h1>
        <p style={subtitle}>
          {isLawyer
            ? "Choose which court's caseload you'd like to work in."
            : "Choose which of your assigned courts to work in."}
        </p>

        {COURTS.length === 0 && (
          <p style={{ color: colors.slate, fontSize: 13 }}>
            You haven't been assigned to any court yet. Contact your lawyer.
          </p>
        )}

        <div style={cardContainer}>
          {COURTS.map((c) => (
            <div
              key={c.key}
              className="am-court-card"
              style={card}
              onClick={() => selectCourt(c.key)}
            >
              <div style={cardLabel}>{c.label}</div>
              <div style={cardDesc}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const container = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: colors.paper,
  fontFamily: font.body,
};

const box = {
  textAlign: "center",
  background: colors.surface,
  padding: "44px 48px",
  borderRadius: radius.lg,
  boxShadow: shadow.lg,
  border: `1px solid ${colors.hairline}`,
  maxWidth: "640px",
};

const eyebrow = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: colors.accent,
  marginBottom: "8px",
};

const title = {
  margin: 0,
  fontFamily: font.display,
  fontSize: "28px",
  fontWeight: 600,
  color: colors.ink,
};

const subtitle = {
  marginTop: "8px",
  marginBottom: "28px",
  fontSize: "14px",
  color: colors.slate,
};

const cardContainer = {
  display: "flex",
  gap: "16px",
  justifyContent: "center",
  flexWrap: "wrap",
};

const card = {
  padding: "24px 22px",
  background: colors.ink,
  color: colors.white,
  borderRadius: radius.md,
  cursor: "pointer",
  width: "180px",
  textAlign: "left",
  border: "1px solid transparent",
};

const cardLabel = {
  fontFamily: font.display,
  fontWeight: 600,
  fontSize: "16px",
  marginBottom: "6px",
};

const cardDesc = {
  fontSize: "12px",
  color: "#B7B8BC",
  lineHeight: 1.4,
};

export default CourtSelector;