import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";

function CaseDetails() {
  const { id } = useParams();
  const caseId = String(id);

  const [caseData, setCaseData] = useState(null);
  const [allHearings, setAllHearings] = useState([]);
  const [tab, setTab] = useState("view");
  const [loading, setLoading] = useState(true);

  // =========================
  // FORM (CASE)
  // =========================
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "",
    details: "",
    diary: ""
  });

  // =========================
  // FORM (HEARING)
  // =========================
  const [hearingForm, setHearingForm] = useState({
    id: "",
    date: "",
    event: "",
    notes: "",
    reminder: ""
  });

  // =========================
  // FETCH CASE
  // =========================
  const fetchCase = () => {
    setLoading(true);

    API.get("/cases")
      .then(res => {
        const found = (res.data.data || []).find(
          c => String(c.id) === caseId
        );

        setCaseData(found || null);

        if (found) {
          setForm({
            title: found.title || "",
            description: found.description || "",
            status: found.status || "",
            details: found.details || "",
            diary: found.diary || ""
          });
        }

        setLoading(false);
      })
      .catch(() => setLoading(false));
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
    API.put(`/cases/${caseId}`, form)
      .then(fetchCase)
      .catch(err => console.log(err));
  };

  // =========================
  // ADD HEARING
  // =========================
  const addHearing = () => {
    API.post("/hearings", {
      ...hearingForm,
      case_id: caseId
    })
      .then(() => {
        setHearingForm({
          id: "",
          date: "",
          event: "",
          notes: "",
          reminder: ""
        });
        fetchHearings();
      })
      .catch(err => console.log(err));
  };

  // =========================
  // LOADING
  // =========================
  if (loading) return <p style={{ padding: "20px" }}>Loading case...</p>;
  if (!caseData) return <p style={{ padding: "20px" }}>Case not found</p>;

  const caseHearings = allHearings
    .filter(h => String(h.case_id) === caseId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>
      
      <h2>📁 Case Dashboard</h2>
      <p style={{ color: "gray" }}>Case ID: {caseId}</p>

      {/* TABS */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        {["view", "details", "diary", "files", "hearings"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px",
              background: tab === t ? "#4f46e5" : "white",
              color: tab === t ? "white" : "black",
              border: "1px solid #ccc",
              borderRadius: "8px"
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ background: "white", padding: "20px", borderRadius: "10px" }}>

        {/* VIEW */}
        {tab === "view" && (
          <div>
            <h3>Edit Case</h3>

            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" />
            <input value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} placeholder="Status" />
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

            <button onClick={updateCase}>Save</button>
          </div>
        )}

        {/* DETAILS */}
        {tab === "details" && (
          <textarea
            style={{ width: "100%", height: "200px" }}
            value={form.details}
            onChange={e => setForm({ ...form, details: e.target.value })}
          />
        )}

        {/* DIARY */}
        {tab === "diary" && (
          <textarea
            style={{ width: "100%", height: "200px" }}
            value={form.diary}
            onChange={e => setForm({ ...form, diary: e.target.value })}
          />
        )}

        {/* FILES */}
        {tab === "files" && <p>Files coming soon</p>}

        {/* =========================
            HEARINGS (FULL FEATURE)
        ========================= */}
        {tab === "hearings" && (
          <div>

            <h3>⚖️ Add Hearing</h3>

            <div style={{
              border: "1px solid #ddd",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "10px"
            }}>
              <input
                placeholder="Hearing ID"
                value={hearingForm.id}
                onChange={e => setHearingForm({ ...hearingForm, id: e.target.value })}
              />

              <input
                type="date"
                value={hearingForm.date}
                onChange={e => setHearingForm({ ...hearingForm, date: e.target.value })}
              />

              <input
                placeholder="Event"
                value={hearingForm.event}
                onChange={e => setHearingForm({ ...hearingForm, event: e.target.value })}
              />

              <input
                placeholder="Notes"
                value={hearingForm.notes}
                onChange={e => setHearingForm({ ...hearingForm, notes: e.target.value })}
              />

              <input
                placeholder="Reminder"
                value={hearingForm.reminder}
                onChange={e => setHearingForm({ ...hearingForm, reminder: e.target.value })}
              />

              <button onClick={addHearing} style={{ marginTop: "10px" }}>
                ➕ Add Hearing
              </button>
            </div>

            <h3>Timeline</h3>

            {caseHearings.length === 0 ? (
              <p>No hearings yet</p>
            ) : (
              caseHearings.map(h => (
                <div key={h.id} style={{
                  border: "1px solid #ddd",
                  padding: "10px",
                  marginBottom: "10px",
                  borderRadius: "8px"
                }}>
                  <b>{h.event}</b>
                  <p>Date: {h.date}</p>
                  <p>Notes: {h.notes}</p>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default CaseDetails;