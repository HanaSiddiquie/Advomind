// frontend/src/components/Navbar.js
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { colors, font } from "../styles/theme";
import Button from "./ui/Button";
import { useAuthRole } from "../context/AuthRoleContext";

const BASE_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/clients", label: "Clients" },
  { to: "/cases", label: "Cases" },
  { to: "/hearings", label: "Hearings" },
  { to: "/diary", label: "Diary" },
  { to: "/archive", label: "Archive" },
];

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const court = localStorage.getItem("court");
  const { isLawyer } = useAuthRole();

  const NAV_LINKS = isLawyer
    ? [...BASE_LINKS, { to: "/secretaries", label: "Secretaries" }]
    : BASE_LINKS;

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem("court");
    navigate("/auth");
  };

  return (
    <div style={nav}>
      {/* LEFT: BRAND */}
      <div style={left}>
        <h2 style={brand}>⚖ ADVOMIND</h2>
        {court && <span style={courtTag}>{court.toUpperCase()} COURT</span>}
        <span style={roleTag}>{isLawyer ? "Lawyer" : "Secretary"}</span>
      </div>

      {/* CENTER LINKS */}
      <div style={center}>
        {NAV_LINKS.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`am-nav-link ${location.pathname === to ? "active" : ""}`}
            style={link}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* RIGHT */}
      <div style={right}>
        <Button variant="secondary" onClick={() => navigate("/court-selector")} style={switchBtnStyle}>
          Switch Court
        </Button>
        <Button variant="danger" onClick={logout}>
          Logout
        </Button>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const nav = {
  position: "sticky",
  top: 0,
  zIndex: 1000,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 28px",
  background: colors.ink,
  color: colors.white,
  fontFamily: font.body,
  flexWrap: "wrap",
  gap: "12px",
  borderBottom: `1px solid #000`,
};

const left = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const brand = {
  margin: 0,
  fontFamily: font.display,
  fontSize: "18px",
  letterSpacing: "0.03em",
  color: colors.white,
};

const center = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};

const right = {
  display: "flex",
  gap: "10px",
};

const link = {
  color: "#D6D7DA",
  textDecoration: "none",
  padding: "8px 14px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 600,
};

const switchBtnStyle = {
  background: "transparent",
  color: colors.white,
  borderColor: "#4A4A4E",
};

const courtTag = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.05em",
  padding: "5px 10px",
  background: colors.accent,
  borderRadius: "6px",
  color: colors.white,
};

const roleTag = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.05em",
  padding: "5px 10px",
  background: "transparent",
  border: "1px solid #4A4A4E",
  borderRadius: "6px",
  color: "#D6D7DA",
};

export default Navbar;