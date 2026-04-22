import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import Navbar from "./components/Navbar";

import CourtSelector from "./pages/CourtSelector";
import Dashboard from "./pages/Dashboard";

import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";

import Cases from "./pages/Cases";
import CaseDetails from "./pages/CaseDetails";

import Hearings from "./pages/Hearings";
import HearingDetails from "./pages/HearingDetails";

import HearingsDashboard from "./pages/HearingsDashboard";

import Auth from "./pages/Auth"; // ✅ NEW (combined login + signup)

// =====================
// PROTECTED ROUTE
// =====================
function Protected({ user, children }) {
  const court = localStorage.getItem("court");

  if (!user) return <Navigate to="/auth" replace />;

  if (!court) return <Navigate to="/court-selector" replace />;

  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

// =====================
// PUBLIC ROUTE
// =====================
function PublicRoute({ user, children }) {
  if (user) return <Navigate to="/court-selector" replace />;
  return children;
}

// =====================
// APP
// =====================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <BrowserRouter>
      <Routes>

        {/* ROOT */}
        <Route
          path="/"
          element={
            user
              ? <Navigate to="/court-selector" replace />
              : <Navigate to="/auth" replace />
          }
        />

        {/* AUTH (LOGIN + SIGNUP TOGETHER) */}
        <Route
          path="/auth"
          element={
            <PublicRoute user={user}>
              <Auth />
            </PublicRoute>
          }
        />

        {/* COURT SELECTION */}
        <Route
          path="/court-selector"
          element={
            user
              ? <CourtSelector />
              : <Navigate to="/auth" replace />
          }
        />

        {/* PROTECTED ROUTES */}
        <Route path="/dashboard" element={<Protected user={user}><Dashboard /></Protected>} />
        <Route path="/clients" element={<Protected user={user}><Clients /></Protected>} />
        <Route path="/clients/:id" element={<Protected user={user}><ClientDetails /></Protected>} />

        <Route path="/cases" element={<Protected user={user}><Cases /></Protected>} />
        <Route path="/cases/:id" element={<Protected user={user}><CaseDetails /></Protected>} />

        <Route path="/hearings" element={<Protected user={user}><Hearings /></Protected>} />
        <Route path="/hearings/:id" element={<Protected user={user}><HearingDetails /></Protected>} />

        <Route path="/hearings-dashboard" element={<Protected user={user}><HearingsDashboard /></Protected>} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </BrowserRouter>
  );
}