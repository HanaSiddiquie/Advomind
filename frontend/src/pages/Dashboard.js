import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

function Dashboard() {
  const court = localStorage.getItem("court");

  const [stats, setStats] = useState({
    clients: 0,
    cases: 0,
    hearings: 0
  });

  // =========================
  // GET HEARINGS COUNT (FIXED LOGIC)
  // =========================
  const getHearingsCount = async (caseIds) => {
    if (!caseIds.length) return 0;

    const snap = await getDocs(collection(db, "hearings"));

    const filtered = snap.docs.filter(doc =>
      caseIds.includes(doc.data().case_id)
    );

    return filtered.length;
  };

  // =========================
  // FETCH ANALYTICS
  // =========================
  const fetchStats = async () => {
    try {
      if (!court) return;

      // CLIENTS
      const clientsQ = query(
        collection(db, "clients"),
        where("court_type", "==", court)
      );
      const clientsSnap = await getDocs(clientsQ);

      // CASES
      const casesQ = query(
        collection(db, "cases"),
        where("court_type", "==", court)
      );
      const casesSnap = await getDocs(casesQ);

      const caseIds = casesSnap.docs.map(d => d.id);

      // HEARINGS (FIXED)
      const hearingsCount = await getHearingsCount(caseIds);

      setStats({
        clients: clientsSnap.size,
        cases: casesSnap.size,
        hearings: hearingsCount
      });

    } catch (err) {
      console.log("DASHBOARD ERROR:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [court]);

  return (
    <div style={{ padding: "20px",  background: "#f5f6fa", minHeight: "100vh" }}>

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
const container = {
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