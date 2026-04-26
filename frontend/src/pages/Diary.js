import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

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

    // sort by date (timeline order)
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

  if (!userId) return <div style={page}>Loading...</div>;

  return (
    <div style={page}>
      <h2 style={title}>📔 Case Diary (Timeline)</h2>
      <p style={subtitle}>Court: {court?.toUpperCase()}</p>

      {Object.keys(grouped).length === 0 ? (
        <p style={{ color: "#666" }}>No hearings found</p>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} style={dayBlock}>
            <h3 style={dateTitle}>{date}</h3>

            {items.map(h => (
              <div key={h.id} style={card}>
                <h4>{h.event}</h4>
                <p style={meta}>{h.notes}</p>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

/* ================= STYLES ================= */

const page = {
  padding: 20,
  background: "#f5f6fa",
  minHeight: "100vh"
};

const title = { marginBottom: 5 };

const subtitle = { marginBottom: 15, color: "#666" };

const dayBlock = {
  marginBottom: 20
};

const dateTitle = {
  background: "#111",
  color: "#fff",
  padding: "8px 12px",
  borderRadius: 8,
  display: "inline-block"
};

const card = {
  background: "#fff",
  padding: 12,
  marginTop: 10,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
};

const meta = {
  color: "#666",
  fontSize: 13,
  marginTop: 4
};

export default Diary;