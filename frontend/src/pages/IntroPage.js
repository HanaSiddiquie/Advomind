import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

function IntroPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/auth");
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={container}>

      {/* LOGO CARD */}
      <div style={logoBox}>
        <img src={logo} alt="Advomind Logo" style={logoStyle} />
      </div>

      {/* TITLE */}
      <h1 style={title}>ADVOMIND</h1>

      <p style={subtitle}>Smart Legal Case Management System</p>

    </div>
  );
}

/* ================= THEME: CLEAN LAW DASHBOARD ================= */

const container = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  background: "#e5e7eb",   // ✅ balanced soft grey
  color: "#111"
};

const logoBox = {
  background: "transparent",
  padding: "0",
  marginBottom: "20px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};

const logoStyle = {
  width: "110px",
  height: "110px",
  objectFit: "contain",
  background: "transparent",
  mixBlendMode: "multiply"
};

const title = {
  fontSize: "44px",
  fontWeight: "700",
  letterSpacing: "2px",
  color: "#111"
};

const subtitle = {
  marginTop: "8px",
  color: "#6b7280",
  fontSize: "14px"
};

export default IntroPage;