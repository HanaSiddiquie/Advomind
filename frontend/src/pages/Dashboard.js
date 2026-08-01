// frontend/src/pages/Dashboard.js
import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { colors, font, radius, shadow } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import { useAuthRole } from "../context/AuthRoleContext";

function Dashboard() {
  const court = localStorage.getItem("court");
  const { ownerId: userId } = useAuthRole();

  const [stats, setStats] = useState({
    clients: 0,
    cases: 0,
    hearings: 0
  });

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

      const clientsQ = query(
        collection(db, "users", userId, "clients"),
        where("court_type", "==", court)
      );

      const clientsSnap = await getDocs(clientsQ);
      const clientsCount = clientsSnap.size;

      const casesQ = query(
        collection(db, "cases"),
        where("court_type", "==", court),
        where("userId", "==", userId)
      );

      const casesSnap = await getDocs(casesQ);
      const caseIds = casesSnap.docs.map(d => d.id);

      const hearingsCount = await getHearingsCount(caseIds);

      setStats({
        clients: clientsCount,
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

  const cards = [
    { label: "Clients", value: stats.clients },
    { label: "Cases", value: stats.cases },
    { label: "Hearings", value: stats.hearings },
  ];

  return (
    <PageContainer
      eyebrow={court?.toUpperCase()}
      title="Dashboard"
      subtitle="An overview of your current caseload"
    >
      <div style={grid}>
        {cards.map((c) => (
          <div key={c.label} style={card}>
            <div style={cardLabel}>{c.label}</div>
            <div style={cardValue}>{c.value}</div>
            <div style={cardRule} />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

/* STYLES */

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const card = {
  background: colors.surface,
  padding: "24px",
  borderRadius: radius.md,
  border: `1px solid ${colors.hairline}`,
  boxShadow: shadow.sm,
};

const cardLabel = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.slate,
  marginBottom: "10px",
};

const cardValue = {
  fontFamily: font.display,
  fontSize: "40px",
  fontWeight: 600,
  color: colors.ink,
};

const cardRule = {
  marginTop: "14px",
  width: "28px",
  height: "3px",
  background: colors.accent,
  borderRadius: "2px",
};

export default Dashboard;