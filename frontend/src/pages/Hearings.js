import { useEffect, useState, useMemo } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where
} from "firebase/firestore";

function Hearings() {
  const [hearings, setHearings] = useState([]);
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);

  const [userId, setUserId] = useState(null);
  const courtType = localStorage.getItem("court");

  const [form, setForm] = useState({
    case_id: "",
    date: "",
    event: "",
    notes: ""
  });

  // ================= AUTH LISTENER =================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });

    return () => unsub();
  }, []);

  // ================= FETCH =================
  const fetchData = async () => {
    try {
      if (!courtType || !userId) return;

      const caseSnap = await getDocs(
        query(
          collection(db, "cases"),
          where("court_type", "==", courtType),
          where("userId", "==", userId)
        )
      );

      const caseData = caseSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCases(caseData);

      const clientSnap = await getDocs(
        query(
          collection(db, "clients"),
          where("court_type", "==", courtType),
          where("userId", "==", userId)
        )
      );

      setClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const hearingSnap = await getDocs(
        query(
          collection(db, "hearings"),
          where("court_type", "==", courtType),
          where("userId", "==", userId)
        )
      );

      setHearings(
        hearingSnap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );

    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courtType, userId]);

  // ================= MAPS (FAST LOOKUP) =================
  const caseMap = useMemo(() => {
    const map = {};
    cases.forEach(c => (map[c.id] = c));
    return map;
  }, [cases]);

  const clientMap = useMemo(() => {
    const map = {};
    clients.forEach(c => (map[c.id] = c));
    return map;
  }, [clients]);

  // ================= ADD HEARING =================
  const handleSubmit = async () => {
    if (!form.case_id || !form.date || !form.event || !userId) return;

    await addDoc(collection(db, "hearings"), {
      case_id: form.case_id,
      date: form.date,
      event: form.event,
      notes: form.notes,
      court_type: courtType,
      userId
    });

    setForm({ case_id: "", date: "", event: "", notes: "" });
    fetchData();
  };

  // ================= HELPERS =================
  const getCaseTitle = (id) => caseMap[id]?.title || "Unknown Case";

  const getClientName = (caseId) => {
    const clientId = caseMap[caseId]?.client_id;
    return clientMap[clientId]?.name || "Unknown Client";
  };

  const sortedHearings = useMemo(() => {
    return [...hearings].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
  }, [hearings]);

  // ================= UI =================
  return (
    <div style={page}>
      <h2 style={title}>📅 Hearings Timeline</h2>
      <p style={subtitle}>Court: {courtType?.toUpperCase()}</p>

      {/* FORM */}
      <div style={formCard}>
        <h3 style={cardTitle}>➕ Add Hearing</h3>

        <select
          style={input}
          value={form.case_id}
          onChange={(e) => setForm({ ...form, case_id: e.target.value })}
        >
          <option value="">Select Case</option>
          {cases.map(c => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        <input
          style={input}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />

        <input
          style={input}
          placeholder="Event"
          value={form.event}
          onChange={(e) => setForm({ ...form, event: e.target.value })}
        />

        <textarea
          style={textarea}
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <button style={btn} onClick={handleSubmit}>
          Add Hearing
        </button>
      </div>

      {/* TIMELINE */}
      <div style={timeline}>
        {sortedHearings.length === 0 ? (
          <p style={{ color: "#666" }}>No hearings scheduled</p>
        ) : (
          sortedHearings.map(h => (
            <div key={h.id} style={card}>
              <div style={badge}>{h.date}</div>

              <h3 style={{ margin: "8px 0" }}>{h.event}</h3>

              <div style={meta}>📁 {getCaseTitle(h.case_id)}</div>
              <div style={meta}>👤 {getClientName(h.case_id)}</div>

              {h.notes && <div style={notes}>{h.notes}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const page = {
  padding: "20px",
  minHeight: "100vh",
  background: "#f4f6f8"
};

const title = { marginBottom: "5px" };

const subtitle = { marginBottom: "15px", color: "#666" };

const formCard = {
  background: "#fff",
  padding: "20px",
  borderRadius: "14px",
  marginBottom: "25px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.06)"
};

const cardTitle = { marginBottom: "15px" };

const input = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd"
};

const textarea = {
  ...input,
  height: "80px"
};

const btn = {
  width: "100%",
  padding: "10px",
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer"
};

const timeline = {
  display: "flex",
  flexDirection: "column",
  gap: "12px"
};

const card = {
  background: "#fff",
  padding: "15px",
  borderRadius: "14px",
  borderLeft: "5px solid #111",
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
};

const badge = {
  fontSize: "12px",
  color: "#fff",
  background: "#111",
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: "6px"
};

const meta = {
  fontSize: "13px",
  color: "#666",
  marginTop: "4px"
};

const notes = {
  marginTop: "8px",
  color: "#333",
  fontSize: "14px"
};

export default Hearings;