import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

function Dashboard() {
  const court = localStorage.getItem("court");

  const [userId, setUserId] = useState(null);

  const [stats, setStats] = useState({
    clients: 0,
    cases: 0,
    hearings: 0
  });

  // ================= AUTH =================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });

    return () => unsub();
  }, []);

  // ================= HEARINGS COUNT =================
  const getHearingsCount = async (caseIds) => {
    if (!caseIds.length) return 0;

    const q = query(
      collection(db, "hearings"),
      where("court_type", "==", court),
      where("userId", "==", userId)
    );

    const snap = await getDocs(q);

    const filtered = snap.docs.filter(doc =>
      caseIds.includes(doc.data().case_id)
    );

    return filtered.length;
  };

  // ================= FETCH STATS =================
  const fetchStats = async () => {
    try {
      if (!court || !userId) return;

      // ✅ CLIENTS (FIXED WITH COURT FILTER)
      const clientsSnap = await getDocs(
        collection(db, "users", userId, "clients")
      );

      const clientsCount = clientsSnap.docs.filter(
        d => d.data().court_type === court
      ).length;

      // ✅ CASES
      const casesQ = query(
        collection(db, "cases"),
        where("court_type", "==", court),
        where("userId", "==", userId)
      );

      const casesSnap = await getDocs(casesQ);
      const caseIds = casesSnap.docs.map(d => d.id);

      // ✅ HEARINGS
      const hearingsCount = await getHearingsCount(caseIds);

      setStats({
        clients: clientsCount, // ✅ FIXED
        cases: casesSnap.size,
        hearings: hearingsCount
      });

    } catch (err) {
      console.log("DASHBOARD ERROR:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [court, userId]);

  return (
    <div style={page}>

      <h2>🏛 Dashboard Analytics</h2>

      <p style={{ color: "gray" }}>
        Current Court: <b>{court?.toUpperCase()}</b>
      </p>

      <div style={grid}>

        <div style={card}>
          <h3>👤 Clients</h3>
          <h1>{stats.clients}</h1>
        </div>

        <div style={card}>
          <h3>📁 Cases</h3>
          <h1>{stats.cases}</h1>
        </div>

        <div style={card}>
          <h3>⚖️ Hearings</h3>
          <h1>{stats.hearings}</h1>
        </div>

      </div>

    </div>
  );
}

/* STYLES */
const page = {
  padding: "20px",
  background: "#f5f6fa",
  minHeight: "100vh"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "15px",
  marginTop: "20px"
};

const card = {
  background: "white",
  padding: "20px",
  borderRadius: "12px",
  textAlign: "center",
  boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
};

export default Dashboard;