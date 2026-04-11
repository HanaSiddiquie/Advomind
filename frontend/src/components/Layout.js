import { Link } from "react-router-dom";

function Navbar() {
  return (
    <div style={{
      display: "flex",
      gap: "20px",
      padding: "15px",
      background: "#111",
      color: "white"
    }}>
      <Link to="/" style={{ color: "white" }}>Dashboard</Link>
      <Link to="/clients" style={{ color: "white" }}>Clients</Link>
      <Link to="/cases" style={{ color: "white" }}>Cases</Link>
      <Link to="/hearings" style={{ color: "white" }}>Hearings</Link>
    </div>
  );
}

export default Navbar;