import { useNavigate } from "react-router-dom";

function CourtSelector() {
  const navigate = useNavigate();

  const selectCourt = (court) => {
    localStorage.setItem("court", court);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div style={container}>

      <div style={box}>
        <h1 style={title}>🏛 Select Court</h1>
        <p > </p>

        <div style={cardContainer}>

          <div style={card} onClick={() => selectCourt("civil")}>
            ⚖️ Civil Court
          </div>

          <div style={card} onClick={() => selectCourt("session")}>
            🏢 Session Court
          </div>

          <div style={card} onClick={() => selectCourt("high")}>
            🏛 High Court
          </div>

        </div>
      </div>

    </div>
  );
}

/* ================= THEME STYLES ================= */

const container = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#e5e7eb" // soft grey theme
};

const box = {
  textAlign: "center",
  background: "#ffffff",
  padding: "40px",
  borderRadius: "16px",
  boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
  border: "1px solid #e5e7eb"
};

const title = {
  marginBottom: "6px",
  fontSize: "26px",
  fontWeight: "700",
  color: "#111827"
};

const subtitle = {
  marginBottom: "25px",
  fontSize: "14px",
  color: "#6b7280"
};

const cardContainer = {
  display: "flex",
  gap: "20px",
  justifyContent: "center",
  flexWrap: "wrap"
};

const card = {
  padding: "22px 26px",
  background: "#111827",
  color: "white",
  borderRadius: "12px",
  cursor: "pointer",
  minWidth: "160px",
  fontWeight: "600",
  boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
  transition: "0.2s"
};

export default CourtSelector;