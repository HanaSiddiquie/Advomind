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

  // =========================
  // FETCH DATA (FIXED)
  // =========================
  const fetchData = async () => {
    try {
      if (!courtType) return;

      // CASES (filtered by court)
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

      // HEARINGS (SAFE FILTER FIX)
      const hearingSnap = await getDocs(collection(db, "hearings"));

      const allHearings = hearingSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // 🔥 IMPORTANT FIX:
      // includes old + new data safely
      const filtered = allHearings.filter(h =>
        !h.court_type || h.court_type === courtType
      );

      setHearings(filtered);

    } catch (err) {
      console.log("FETCH ERROR:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courtType]);

  // =========================
  // ADD HEARING (COURT SAFE)
  // =========================
  const handleSubmit = async () => {
    try {
      if (!form.case_id || !form.date || !form.event) {
        alert("Please fill required fields");
        return;
      }

      await addDoc(collection(db, "hearings"), {
        ...form,
        court_type: courtType   // 🔥 IMPORTANT
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
      console.log("ADD ERROR:", err);
    }
  };

  // =========================
  // HELPERS
  // =========================
  const getCaseTitle = (id) => {
    const found = cases.find(c => c.id === id);
    return found ? found.title : "Unknown Case";
  };

  const sortedHearings = [...hearings].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>

      <h2>⚖️ Hearings ({courtType?.toUpperCase()})</h2>

      {/* FORM */}
      <div style={formBox}>
        <h3>Add Hearing</h3>

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
          ➕ Add Hearing
        </button>
      </div>

      {/* TIMELINE */}
      <div style={timelineContainer}>
        {sortedHearings.length === 0 ? (
          <p>No hearings found</p>
        ) : (
          sortedHearings.map(h => (
            <div key={h.id} style={timelineCard}>
              <h3>{h.event}</h3>
              <p><b>Date:</b> {h.date}</p>
              <p><b>Case:</b> {getCaseTitle(h.case_id)}</p>
              <p style={{ color: "gray" }}>{h.notes}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* STYLES */
const formBox = {
  background: "white",
  padding: "15px",
  borderRadius: "10px",
  marginBottom: "20px"
};

const input = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  border: "1px solid #ddd",
  borderRadius: "8px"
};

const btn = {
  width: "100%",
  padding: "10px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "8px"
};

const timelineContainer = {
  marginTop: "20px"
};

const timelineCard = {
  background: "white",
  padding: "15px",
  marginBottom: "10px",
  borderRadius: "10px"
};

export default Hearings;