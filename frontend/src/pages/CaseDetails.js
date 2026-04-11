import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";

function CaseDetails() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [tab, setTab] = useState("view");

  const [allHearings, setAllHearings] = useState([]);

  // ✅ NEW: Add Hearing form
  const [hearingForm, setHearingForm] = useState({
    id: "",
    date: "",
    event: "",
    notes: "",
    reminder: ""
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "",
    details: "",
    diary: ""
  });

  // =========================
  // FETCH CASE
  // =========================
  const fetchCase = () => {
    API.get("/cases")
      .then(res => {
        const found = (res.data.data || []).find(c => c.id === id);
        setCaseData(found);

        if (found) {
          setForm({
            title: found.title || "",
            description: found.description || "",
            status: found.status || "",
            details: found.details || "",
            diary: found.diary || ""
          });
        }
      })
      .catch(err => console.log(err));
  };

  // =========================
  // FETCH HEARINGS
  // =========================
  const fetchHearings = () => {
    API.get("/hearings")
      .then(res => setAllHearings(res.data.data || []))
      .catch(err => console.log(err));
  };

  useEffect(() => {
    fetchCase();
    fetchHearings();
  }, [id]);

  // =========================
  // UPDATE CASE
  // =========================
  const updateCase = () => {
    API.put(`/cases/${id}`, form)
      .then(() => fetchCase())
      .catch(err => console.log(err));
  };

  // =========================
  // ADD HEARING (NEW)
  // =========================
  const addHearing = () => {
    API.post("/hearings", {
      ...hearingForm,
      case_id: id
    })
      .then(() => {
        fetchHearings();
        setHearingForm({
          id: "",
          date: "",
          event: "",
          notes: "",
          reminder: ""
        });
      })
      .catch(err => console.log(err));
  };

  if (!caseData) return <p style={{ padding: "20px" }}>Loading case...</p>;

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>
      
      <h2>📁 Case Dashboard</h2>
      <p style={{ color: "gray" }}>Case ID: {id}</p>

      {/* TABS */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        {["view", "details", "diary", "files", "hearings"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: tab === t ? "#4f46e5" : "white",
              color: tab === t ? "white" : "black",
              cursor: "pointer"
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* CARD */}
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)"
      }}>

        {/* VIEW */}
        {tab === "view" && (
          <div>
            <h3>View / Edit Case</h3>

            <input style={inputStyle}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Title"
            />

            <input style={inputStyle}
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
              placeholder="Status"
            />

            <textarea style={textareaStyle}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Description"
            />

            <button style={btnStyle} onClick={updateCase}>
              Save Changes
            </button>
          </div>
        )}

        {/* DETAILS */}
        {tab === "details" && (
          <div>
            <h3>📒 Case Details</h3>
            <textarea style={{ ...textareaStyle, height: "300px" }}
              value={form.details}
              onChange={e => setForm({ ...form, details: e.target.value })}
            />
            <button style={btnStyle} onClick={updateCase}>Save Details</button>
          </div>
        )}

        {/* DIARY */}
        {tab === "diary" && (
          <div>
            <h3>📝 Diary</h3>
            <textarea style={{ ...textareaStyle, height: "300px" }}
              value={form.diary}
              onChange={e => setForm({ ...form, diary: e.target.value })}
            />
            <button style={btnStyle} onClick={updateCase}>Save Diary</button>
          </div>
        )}

        {/* FILES */}
        {tab === "files" && (
          <div>
            <h3>📂 Files</h3>
            <p>File upload coming soon</p>
          </div>
        )}

        {/* HEARINGS + ADD (🔥 NEW FULL FEATURE) */}
        {tab === "hearings" && (
          <div>
            <h3>⚖️ Hearing Timeline</h3>

            {/* ADD HEARING FORM */}
            <div style={{
              padding: "15px",
              border: "1px solid #ddd",
              borderRadius: "10px",
              marginBottom: "20px",
              background: "#fafafa"
            }}>
              <h4>Add Hearing</h4>

              <input style={inputStyle}
                placeholder="ID"
                value={hearingForm.id}
                onChange={e => setHearingForm({ ...hearingForm, id: e.target.value })}
              />

              <input style={inputStyle}
                type="date"
                value={hearingForm.date}
                onChange={e => setHearingForm({ ...hearingForm, date: e.target.value })}
              />

              <input style={inputStyle}
                placeholder="Event"
                value={hearingForm.event}
                onChange={e => setHearingForm({ ...hearingForm, event: e.target.value })}
              />

              <input style={inputStyle}
                placeholder="Notes"
                value={hearingForm.notes}
                onChange={e => setHearingForm({ ...hearingForm, notes: e.target.value })}
              />

              <button style={btnStyle} onClick={addHearing}>
                ➕ Add Hearing
              </button>
            </div>

            {/* TIMELINE */}
            {allHearings
              .filter(h => h.case_id === id)
              .length === 0 ? (
              <p style={{ color: "gray" }}>No hearings yet</p>
            ) : (
              allHearings
                .filter(h => h.case_id === id)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(h => (
                  <div key={h.id} style={{
                    background: "white",
                    padding: "12px",
                    marginBottom: "10px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                  }}>
                    <h4>⚖️ {h.event}</h4>
                    <p><b>Date:</b> {h.date}</p>
                    <p><b>Notes:</b> {h.notes}</p>
                    <p style={{ fontSize: "12px", color: "gray" }}>
                      ID: {h.id}
                    </p>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// styles
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
  padding: "10px 15px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

export default CaseDetails;