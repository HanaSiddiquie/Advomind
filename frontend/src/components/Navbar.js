import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function Navbar() {
  const navigate = useNavigate();

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem("court");
    navigate("/auth");
  };

  const court = localStorage.getItem("court");

  return (
    <div style={nav}>

      {/* LEFT: BRAND */}
      <div style={left}>
        <h2 style={{ margin: 0, color: "white" }}>⚖️ ADVOMIND</h2>

        {court && (
          <span style={courtTag}>
            🏛 {court.toUpperCase()}
          </span>
        )}
      </div>

      {/* CENTER LINKS */}
      <div style={center}>
        <Link to="/dashboard" style={link}>Dashboard</Link>
        <Link to="/clients" style={link}>Clients</Link>
        <Link to="/cases" style={link}>Cases</Link>
        <Link to="/hearings" style={link}>Hearings</Link>
      </div>

      {/* RIGHT */}
      <div style={right}>

        {/* SWITCH COURT BUTTON */}
        <button
          onClick={() => navigate("/courtselector")}
          style={switchBtn}
        >
          Switch Court
        </button>

        {/* LOGOUT */}
        <button onClick={logout} style={btn}>
          Logout
        </button>

      </div>

    </div>
  );
}

/* =========================
   STYLES (UNCHANGED THEME)
========================= */

const nav = {
  position: "sticky",
  top: 0,
  zIndex: 1000,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 20px",
  background: "#111",
  color: "white"
};

const left = {
  display: "flex",
  alignItems: "center",
  gap: "10px"
};

const center = {
  display: "flex",
  gap: "15px"
};

const right = {
  display: "flex",
  gap: "10px"
};

const link = {
  color: "white",
  textDecoration: "none",
  padding: "8px 12px",
  borderRadius: "6px",
  background: "#222"
};

const switchBtn = {
  padding: "8px 14px",
  background: "#222",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer"
};

const btn = {
  padding: "8px 14px",
  background: "red",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer"
};

const courtTag = {
  fontSize: "12px",
  padding: "4px 8px",
  background: "#333",
  borderRadius: "6px",
  color: "#aaa"
};

export default Navbar;