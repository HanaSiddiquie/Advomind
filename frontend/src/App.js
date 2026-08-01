// frontend/src/App.js
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

import { AuthRoleProvider, useAuthRole } from "./context/AuthRoleContext";
import Navbar from "./components/Navbar";

import IntroPage from "./pages/IntroPage";
import Auth from "./pages/Auth";

import CourtSelector from "./pages/CourtSelector";
import Dashboard from "./pages/Dashboard";

import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";

import Cases from "./pages/Cases";
import CaseDetails from "./pages/CaseDetails";

import Hearings from "./pages/Hearings";
import HearingDetails from "./pages/HearingDetails";

import HearingsDashboard from "./pages/HearingsDashboard";
import ArchivePage from "./pages/ArchivePage";
import Diary from "./pages/Diary";
import ManageSecretaries from "./pages/ManageSecretaries";

// Shown instead of redirecting when we can't resolve a role — redirecting
// here would just bounce back and forth with the Auth page forever.
function NoProfileScreen() {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h2>We couldn't find a profile for this account</h2>
      <p style={{ color: "#6B6F76", maxWidth: 480 }}>
        This can happen with accounts created before role support was added,
        or if a secretary invite didn't finish setting up correctly. Log out
        and sign up again, or contact support if this persists.
      </p>
      <button
        onClick={() => signOut(auth)}
        style={{ marginTop: 16, padding: "10px 18px", cursor: "pointer" }}
      >
        Log out
      </button>
    </div>
  );
}

// =====================
// PROTECTED ROUTE
// Requires: signed in, a resolved role/profile, and (unless the route says
// otherwise) a court already chosen.
// =====================
function Protected({ children, requireCourt = true, lawyerOnly = false }) {
  const { user, role, isDisabled, loading } = useAuthRole();
  const court = localStorage.getItem("court");

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/auth" replace />;

  if (isDisabled) {
    return <p style={{ padding: 40 }}>Your account has been disabled by your lawyer. Contact them for access.</p>;
  }

  // Signed in but no resolved role — show a static screen, NEVER navigate
  // here, or this ping-pongs with PublicRoute below.
  if (!role) return <NoProfileScreen />;

  if (lawyerOnly && role !== "lawyer") return <Navigate to="/dashboard" replace />;
  if (requireCourt && !court) return <Navigate to="/court-selector" replace />;

  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

// =====================
// PUBLIC ROUTE
// Only bounce away from /auth once we've confirmed BOTH a user AND a
// resolved role — otherwise a profile-less account would loop right back
// here via Protected's NoProfileScreen... except that no longer navigates,
// so this guard is now just for a clean, non-flickering experience.
// =====================
function PublicRoute({ children }) {
  const { user, role, loading } = useAuthRole();
  if (loading) return <p>Loading...</p>;
  if (user && role) return <Navigate to="/court-selector" replace />;
  if (user && !role) return <NoProfileScreen />;
  return children;
}

// =====================
// APP
// =====================
function AppRoutes() {
  const { user, role, loading } = useAuthRole();

  if (loading) return <p>Loading...</p>;

  return (
    <Routes>

      {/* INTRO PAGE */}
      <Route path="/" element={<IntroPage />} />

      <Route
        path="/home"
        element={
          user && role
            ? <Navigate to="/court-selector" replace />
            : <Navigate to="/auth" replace />
        }
      />

      {/* AUTH */}
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        }
      />

      {/* COURT SELECTION */}
      <Route
        path="/court-selector"
        element={
          <Protected requireCourt={false}>
            <CourtSelector />
          </Protected>
        }
      />

      {/* PROTECTED ROUTES */}
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/clients" element={<Protected><Clients /></Protected>} />
      <Route path="/clients/:id" element={<Protected><ClientDetails /></Protected>} />

      <Route path="/cases" element={<Protected><Cases /></Protected>} />
      <Route path="/cases/:id" element={<Protected><CaseDetails /></Protected>} />

      <Route path="/hearings" element={<Protected><Hearings /></Protected>} />
      <Route path="/hearings/:id" element={<Protected><HearingDetails /></Protected>} />

      <Route path="/hearings-dashboard" element={<Protected><HearingsDashboard /></Protected>} />
      <Route path="/archive" element={<Protected><ArchivePage /></Protected>} />
      <Route path="/diary" element={<Protected><Diary /></Protected>} />

      {/* LAWYER-ONLY */}
      <Route
        path="/secretaries"
        element={<Protected lawyerOnly><ManageSecretaries /></Protected>}
      />

      {/* FALLBACK — must stay last, React Router matches routes in order */}
      <Route path="*" element={<Navigate to="/" />} />

    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthRoleProvider>
        <AppRoutes />
      </AuthRoleProvider>
    </BrowserRouter>
  );
}