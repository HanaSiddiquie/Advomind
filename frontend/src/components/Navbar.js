// frontend/src/components/Navbar.js
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuthRole } from "../context/AuthRoleContext";

const BASE_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/clients", label: "Clients" },
  { to: "/cases", label: "Cases" },
  { to: "/hearings", label: "Hearings" },
  { to: "/diary", label: "Diary" },
  { to: "/archive", label: "Archive" },
  { to: "/search", label: "Search" },
  { to: "/advochat", label: "AdvoChat" },
  { to: "/court-day-prep", label: "Court Day Prep" },
];

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const court = localStorage.getItem("court");
  const { isLawyer, profile } = useAuthRole();
  const displayName = profile?.name || profile?.email || "User";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  const [menuOpen, setMenuOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const navRef = useRef(null);
  const acctRef = useRef(null);

  const links = isLawyer
    ? [...BASE_LINKS, { to: "/secretaries", label: "Secretaries" }]
    : BASE_LINKS;

  const isActive = (to) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  // Close both menus whenever the page changes
  useEffect(() => {
    setMenuOpen(false);
    setAcctOpen(false);
  }, [location.pathname]);

  // Close on outside tap / Escape
  useEffect(() => {
    if (!menuOpen && !acctOpen) return;

    const onDown = (e) => {
      if (acctRef.current && !acctRef.current.contains(e.target)) setAcctOpen(false);
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setAcctOpen(false);
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, acctOpen]);

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem("court");
    navigate("/auth");
  };

  return (
    <header className="am-nav" ref={navRef}>
      <div className="am-nav-bar">
        <button
          type="button"
          className="am-nav-burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((o) => !o);
            setAcctOpen(false);
          }}
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <Link to="/dashboard" className="am-nav-brand">⚖ ADVOMIND</Link>

        <nav className={`am-nav-links${menuOpen ? " open" : ""}`} aria-label="Main">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`am-nav-link${isActive(to) ? " active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="am-nav-right">
          {court && (
            <span className="am-nav-court">
              {court.toUpperCase()}
              <span className="am-hide-sm"> COURT</span>
            </span>
          )}

          <div className="am-acct" ref={acctRef}>
            <button
              type="button"
              className="am-acct-btn"
              aria-haspopup="menu"
              aria-expanded={acctOpen}
              onClick={() => {
                setAcctOpen((o) => !o);
                setMenuOpen(false);
              }}
            >
              <span className="am-avatar">{initial}</span>
              <span className="am-acct-name">{displayName}</span>
              <span aria-hidden="true" className="am-caret">▾</span>
            </button>

            {acctOpen && (
              <div className="am-acct-menu" role="menu">
                <div className="am-acct-head">
                  <strong>{displayName}</strong>
                  <span>
                    {isLawyer ? "Lawyer" : "Secretary"}
                    {court ? ` · ${court.charAt(0).toUpperCase() + court.slice(1)} court` : ""}
                  </span>
                </div>
                <button type="button" role="menuitem" onClick={() => navigate("/court-selector")}>
                  Switch Court
                </button>
                <button type="button" role="menuitem" className="danger" onClick={logout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;