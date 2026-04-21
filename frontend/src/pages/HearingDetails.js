import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";

function HearingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [hearing, setHearing] = useState(null);
  const [cases, setCases] = useState([]); // ✅ for linking case

  const [form, setForm] = useState({
    date: "",
    event: "",
    notes: "",
    reminder: ""
  });

  // =========================
  // FETCH HEARING
  // =========================
  const fetchHearing = () => {
    API.get("/hearings")
      .then(res => {
        const found = (res.data.data || []).find(h => h.id === id);
        setHearing(found);

        if (found) {
          setForm({
            date: found.date || "",
            event: found.event || "",
            notes: found.notes || "",
            reminder: found.reminder || ""
          });
        }
      })
      .catch(err => console.log(err));
  };

  // =========================
  // FETCH CASES (for linking)
  // =========================
  const fetchCases = () => {
    API.get("/cases")
      .then(res => setCases(res.data.data || []))
      .catch(err => console.log(err));
  };

  useEffect(() => {
    fetchHearing();
    fetchCases();
  }, [id]);

  // =========================
  // UPDATE
  // =========================
  const updateHearing = () => {
    API.put(`/hearings/${id}`, form)
      .then(() => {
        fetchHearing();
        alert("Updated successfully");
      })
      .catch(err => console.log(err));
  };

  // =========================
  // DELETE
  // =========================
  const deleteHearing = () => {
    if (!window.confirm("Delete this hearing?")) return;

    API.delete(`/hearings/${id}`)
      .then(() => {
        alert("Deleted successfully");
        navigate("/hearings");
      })
      .catch(err => console.log(err));
  };

  if (!hearing) return <p style={{ padding: "20px" }}>Loading...</p>;

  // ✅ Find related case
  const relatedCase = cases.find(c => c.id === hearing.case_id);

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: "15px" }}>
        <h2>⚖️ Hearing Details</h2>
        <p style={{ color: "gray" }}>Hearing ID: {id}</p>
      </div>

      {/* CARD */}
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)"
      }}>
        {/* EVENT */}
        <input
          style={inputStyle}
          value={form.event}
          onChange={e => setForm({ ...form, event: e.target.value })}
          placeholder="Event"
        />

        {/* DATE */}
        <input
          style={inputStyle}
          type="date"
          value={form.date}
          onChange={e => setForm({ ...form, date: e.target.value })}
        />

        {/* NOTES */}
        <textarea
          style={textareaStyle}
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes"
        />

        {/* REMINDER */}
        <input
          style={inputStyle}
          value={form.reminder}
          onChange={e => setForm({ ...form, reminder: e.target.value })}
          placeholder="Reminder"
        />

        {/* BUTTONS */}
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <button style={btnStyle} onClick={updateHearing}>
            Save Changes
          </button>

          <button
            style={{ ...btnStyle, background: "red" }}
            onClick={deleteHearing}
          >
            Delete
          </button>
        </div>
      </div>

      {/* LINKED CASE */}
      {relatedCase && (
        <div style={{ marginTop: "20px" }}>
          <h3>📁 Related Case</h3>

          <div
            style={{
              padding: "12px",
              background: "#eef2ff",
              borderRadius: "10px",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)"
            }}
            onClick={() => navigate(`/cases/${relatedCase.id}`)}
          >
            <h4>{relatedCase.title}</h4>
            <p style={{ color: "gray" }}>Case ID: {relatedCase.id}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================
// STYLES
// =========================
const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc"
};

const textareaStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc"
};

const btnStyle = {
  padding: "10px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

export default HearingDetails;