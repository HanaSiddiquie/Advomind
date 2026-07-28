// frontend/src/pages/Diary.js
import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { colors, font, radius, shadow } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";

function Diary() {
  const [userId, setUserId] = useState(null);
  const [hearings, setHearings] = useState([]);

  const court = localStorage.getItem("court");

  // ================= AUTH =================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });

    return () => unsub();
  }, []);

  // ================= FETCH HEARINGS =================
  const fetchHearings = async () => {
    if (!userId || !court) return;

    const q = query(
      collection(db, "hearings"),
      where("userId", "==", userId),
      where("court_type", "==", court)
    );

    const snap = await getDocs(q);

    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    data.sort((a, b) => new Date(a.date) - new Date(b.date));

    setHearings(data);
  };

  useEffect(() => {
    fetchHearings();
  }, [userId, court]);

  // ================= GROUP BY DATE =================
  const grouped = hearings.reduce((acc, h) => {
    const date = h.date || "Unknown Date";
    if (!acc[date]) acc[date] = [];
    acc[date].push(h);
    return acc;
  }, {});

  if (!userId) return <PageContainer title="Case Diary"><p style={emptyText}>Loading…</p></PageContainer>;

  return (
    <PageContainer
      eyebrow={court?.toUpperCase()}
      title="Case Diary"
      subtitle="A running timeline of every hearing, by date"
    >
      {Object.keys(grouped).length === 0 ? (
        <p style={emptyText}>No hearings found</p>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} style={dayBlock}>
            <h3 style={dateTitle}>{date}</h3>

            {items.map(h => (
              <div key={h.id} style={card}>
                <h4 style={eventTitle}>{h.event}</h4>
                {h.notes && <p style={meta}>{h.notes}</p>}
              </div>
            ))}
          </div>
        ))
      )}
    </PageContainer>
  );
}

/* ================= STYLES ================= */

const dayBlock = {
  marginBottom: 22,
};

const dateTitle = {
  background: colors.ink,
  color: colors.white,
  fontFamily: font.body,
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  padding: "8px 14px",
  borderRadius: radius.sm,
  display: "inline-block",
  margin: 0,
};

const card = {
  background: colors.surface,
  padding: "14px 16px",
  marginTop: 10,
  borderRadius: radius.md,
  border: `1px solid ${colors.hairline}`,
  boxShadow: shadow.sm,
  borderLeft: `3px solid ${colors.accent}`,
};

const eventTitle = {
  fontFamily: font.display,
  fontSize: "14px",
  fontWeight: 600,
  color: colors.ink,
  margin: 0,
};

const meta = {
  color: colors.slate,
  fontSize: 13,
  marginTop: 6,
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default Diary;