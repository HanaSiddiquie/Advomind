import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function Navbar() {
  const navigate = useNavigate();

  const court = localStorage.getItem("court");

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("court");
    navigate("/login");
  };

  const changeCourt = () => {
    localStorage.removeItem("court");
    navigate("/court-selector");
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "20px",
      padding: "15px",
      background: "#111",
      color: "white"
    }}>

      <Link to="/dashboard" style={{ color: "white" }}>Dashboard</Link>
      <Link to="/clients" style={{ color: "white" }}>Clients</Link>
      <Link to="/cases" style={{ color: "white" }}>Cases</Link>
      <Link to="/hearings" style={{ color: "white" }}>Hearings</Link>

      {/* spacer */}
      <div style={{ flex: 1 }} />

      {/* 🏛 CURRENT COURT DISPLAY */}
      <div style={{
        fontSize: "14px",
        color: "#cbd5e1",
        marginRight: "10px"
      }}>
        🏛 Current Court: <b style={{ color: "white" }}>
          {court ? court.toUpperCase() : "NOT SELECTED"}
        </b>
      </div>

      {/* Change Court */}
      <button
        onClick={changeCourt}
        style={{
          background: "transparent",
          color: "#ccc",
          border: "1px solid #555",
          padding: "6px 10px",
          borderRadius: "6px",
          cursor: "pointer"
        }}
      >
        Change Court
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          background: "#ef4444",
          color: "white",
          border: "none",
          padding: "6px 12px",
          borderRadius: "6px",
          cursor: "pointer"
        }}
      >
        Logout
      </button>

    </div>
  );
}

export default Navbar;