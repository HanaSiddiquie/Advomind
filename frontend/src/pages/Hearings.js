import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function Hearings() {
  const [hearings, setHearings] = useState([]);
  const [cases, setCases] = useState([]);

  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    id: "",
    case_id: "",
    date: "",
    event: "",
    notes: "",
    reminder: ""
  });

  // =========================
  // FETCH CASES + HEARINGS
  // =========================
  const fetchData = async () => {
    try {
      const [hRes, cRes] = await Promise.all([
        API.get("/hearings"),
        API.get("/cases")
      ]);

      setHearings(hRes.data.data || []);
      setCases(cRes.data.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // =========================
  // ADD / UPDATE
  // =========================
  const handleSubmit = () => {
    if (editing) {
      API.put(`/hearings/${form.id}`, form)
        .then(() => {
          fetchData();
          resetForm();
        })
        .catch(err => console.log(err));
    } else {
      API.post("/hearings", form)
        .then(() => {
          fetchData();
          resetForm();
        })
        .catch(err => console.log(err));
    }
  };

  const resetForm = () => {
    setForm({
      id: "",
      case_id: "",
      date: "",
      event: "",
      notes: "",
      reminder: ""
    });
    setEditing(false);
  };

  // =========================
  // HELPERS (CASE → CLIENT NAME)
  // =========================
  const getCase = (case_id) => {
    return cases.find(c => String(c.id) === String(case_id));
  };

  const getClientName = (case_id) => {
    const foundCase = getCase(case_id);
    return foundCase ? foundCase.client_id : "Unknown Client";
  };

  const getCaseTitle = (case_id) => {
    const foundCase = getCase(case_id);
    return foundCase ? foundCase.title : "Unknown Case";
  };

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>
      
      <h2>⚖️ Hearings</h2>

      {/* FORM */}
      <div style={formBox}>
        <h3>{editing ? "Edit Hearing" : "Add New Hearing"}</h3>

        <div style={grid}>
          <input name="id" value={form.id} onChange={handleChange} placeholder="Hearing ID" disabled={editing} />
          <input name="case_id" value={form.case_id} onChange={handleChange} placeholder="Case ID" />
          <input type="date" name="date" value={form.date} onChange={handleChange} />
          <input name="event" value={form.event} onChange={handleChange} placeholder="Event" />
          <input name="notes" value={form.notes} onChange={handleChange} placeholder="Notes" />
          <input name="reminder" value={form.reminder} onChange={handleChange} placeholder="Reminder" />
        </div>

        <button style={btn} onClick={handleSubmit}>
          {editing ? "Update Hearing" : "➕ Add Hearing"}
        </button>
      </div>

      {/* CARDS */}
      <div style={cardGrid}>
        {hearings.map(h => (
          <div
            key={h.id}
            style={card}
            onClick={() => navigate(`/hearings/${h.id}`)}
          >
            <h3>{h.event}</h3>

            <p><b>Date:</b> {h.date}</p>

            <p>
              <b>Client:</b> {getClientName(h.case_id)}
            </p>

            <p>
              <b>Case:</b> {getCaseTitle(h.case_id)}
            </p>

            <p style={{ fontSize: "12px", color: "gray" }}>
              Click to open →
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// styles
const formBox = {
  background: "white",
  padding: "15px",
  borderRadius: "12px",
  marginBottom: "20px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "10px"
};

const btn = {
  marginTop: "10px",
  padding: "10px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "15px"
};

const card = {
  background: "white",
  padding: "15px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  cursor: "pointer"
};

export default Hearings;