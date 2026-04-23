import { useEffect, useState } from "react";
import { db } from "../firebase";
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

  const courtType = localStorage.getItem("court");

  const [form, setForm] = useState({
    case_id: "",
    date: "",
    event: "",
    notes: "",
    reminder: ""
  });

  const fetchData = async () => {
    try {
      if (!courtType) return;

      const caseQ = query(
        collection(db, "cases"),
        where("court_type", "==", courtType)
      );

      const caseSnap = await getDocs(caseQ);

      const caseData = caseSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setCases(caseData);

      const hearingSnap = await getDocs(collection(db, "hearings"));

      const allHearings = hearingSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      const filtered = allHearings.filter(
        h => !h.court_type || h.court_type === courtType
      );

      setHearings(filtered);

    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courtType]);

  const handleSubmit = async () => {
    try {
      if (!form.case_id || !form.date || !form.event) {
        alert("Fill required fields");
        return;
      }

      await addDoc(collection(db, "hearings"), {
        ...form,
        court_type: courtType
      });

      setForm({
        case_id: "",
        date: "",
        event: "",
        notes: "",
        reminder: ""
      });

      fetchData();

    } catch (err) {
      console.log(err);
    }
  };

  const getCaseTitle = (id) => {
    const found = cases.find(c => c.id === id);
    return found ? found.title : "Unknown Case";
  };

  const sortedHearings = [...hearings].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  return (
    <div style={page}>

      <h2 style={title}>Hearings ({courtType?.toUpperCase()})</h2>

      {/* FORM CARD */}
      <div style={card}>
        <h3 style={heading}>Add Hearing</h3>

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

        <input
          style={input}
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
          <p style={{ color: "#666" }}>No hearings found</p>
        ) : (
          sortedHearings.map(h => (
            <div key={h.id} style={timelineCard}>
              <div>
                <h3 style={{ marginBottom: "5px" }}>{h.event}</h3>
                <div style={meta}>Date: {h.date}</div>
                <div style={meta}>Case: {getCaseTitle(h.case_id)}</div>
                <div style={notes}>{h.notes}</div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

/* ================= CLEAN THEME ================= */

const page = {
  padding: "20px",
  minHeight: "100vh",
  background: "#f5f6fa",
  color: "#111"
};

const title = {
  marginBottom: "15px",
  fontWeight: "600"
};

const card = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  marginBottom: "20px"
};

const heading = {
  marginBottom: "10px"
};

const input = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  outline: "none"
};

const btn = {
  width: "100%",
  padding: "10px",
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const timeline = {
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const timelineCard = {
  background: "#fff",
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb"
};

const meta = {
  fontSize: "13px",
  color: "#666",
  marginTop: "3px"
};

const notes = {
  marginTop: "8px",
  color: "#333"
};

export default Hearings;