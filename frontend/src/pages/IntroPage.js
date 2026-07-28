// frontend/src/pages/IntroPage.js
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { colors, font } from "../styles/theme";

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
      <div style={logoBox}>
        <img src={logo} alt="Advomind Logo" style={logoStyle} />
      </div>

      <h1 style={title}>ADVOMIND</h1>
      <p style={subtitle}>Smart Legal Case Management System</p>
      <div style={rule} />
    </div>
  );
}

const container = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  background: colors.ink,
  color: colors.white,
  fontFamily: font.body,
};

const logoBox = {
  marginBottom: "24px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  width: "96px",
  height: "96px",
  borderRadius: "50%",
  background: colors.white,
};

const logoStyle = {
  width: "62px",
  height: "62px",
  objectFit: "contain",
};

const title = {
  fontFamily: font.display,
  fontSize: "40px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: colors.white,
  margin: 0,
};

const subtitle = {
  marginTop: "10px",
  color: "#B7B8BC",
  fontSize: "14px",
  letterSpacing: "0.02em",
};

const rule = {
  marginTop: "28px",
  width: "40px",
  height: "2px",
  background: colors.accent,
};

export default IntroPage;