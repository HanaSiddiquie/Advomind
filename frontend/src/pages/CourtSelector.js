import { useNavigate } from "react-router-dom";

function CourtSelector() {
  const navigate = useNavigate();

  const selectCourt = (court) => {
    localStorage.setItem("court", court);

    // 🔥 IMPORTANT: force navigation reset
    navigate("/dashboard", { replace: true });
  };

  return (
    <div style={container}>
      <h1>🏛️ Select Court</h1>

      <div style={cardContainer}>

        <div style={card} onClick={() => selectCourt("civil")}>
          ⚖️ Civil Court
        </div>

        <div style={card} onClick={() => selectCourt("session")}>
          🏢 Session Court
        </div>

        <div style={card} onClick={() => selectCourt("high")}>
          🏛️ High Court
        </div>

      </div>
    </div>
  );
}

const container = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  background: "#f5f6fa"
};

const cardContainer = {
  display: "flex",
  gap: "20px"
};

const card = {
  padding: "20px",
  background: "white",
  borderRadius: "10px",
  cursor: "pointer",
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
};

export default CourtSelector;