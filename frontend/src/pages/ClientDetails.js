import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";

function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);

  const [form, setForm] = useState({
    name: "",
    cnic: "",
    address: "",
    email: "",
    phone: "",
    details: ""
  });

  const [caseForm, setCaseForm] = useState({
    id: "",
    title: "",
    description: ""
  });

  // =========================
  // FETCH CLIENT
  // =========================
  const fetchClient = () => {
    API.get("/clients")
      .then(res => {
        const found = (res.data.data || []).find(
          c => String(c.id) === String(id)
        );

        setClient(found || null);

        if (found) {
          setForm({
            name: found.name || "",
            cnic: found.cnic || "",
            address: found.address || "",
            email: found.email || "",
            phone: found.phone || "",
            details: found.details || ""
          });
        }
      })
      .catch(err => console.log(err));
  };

  // =========================
  // FETCH CASES
  // =========================
  const fetchCases = () => {
    API.get("/cases")
      .then(res => setCases(res.data.data || []))
      .catch(err => console.log(err));
  };

  // =========================
  // FETCH HEARINGS (NEW)
  // =========================
  const fetchHearings = () => {
    API.get("/hearings")
      .then(res => setHearings(res.data.data || []))
      .catch(err => console.log(err));
  };

  useEffect(() => {
    fetchClient();
    fetchCases();
    fetchHearings();
  }, [id]);

  // =========================
  // UPDATE CLIENT
  // =========================
  const updateClient = () => {
    API.put(`/clients/${id}`, form)
      .then(fetchClient)
      .catch(err => console.log(err));
  };

  // =========================
  // ADD CASE
  // =========================
  const addCase = () => {
    API.post("/cases", {
      ...caseForm,
      client_id: id
    })
      .then(() => {
        setCaseForm({ id: "", title: "", description: "" });
        fetchCases();
      })
      .catch(err => console.log(err));
  };

  if (!client) {
    return <p style={{ padding: "20px" }}>Loading client...</p>;
  }

  const clientCases = cases.filter(
    c => String(c.client_id) === String(id)
  );

  const clientCaseIds = clientCases.map(c => c.id);

  const clientHearings = hearings.filter(h =>
    clientCaseIds.includes(h.case_id)
  );

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>
      
      <h2>👤 Client Dashboard</h2>
      <p style={{ color: "gray" }}>Client ID: {id}</p>

      {/* =========================
          CLIENT INFO
      ========================= */}
      <div style={card}>
        <h3>Client Info</h3>

        <input style={input} value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="Name"
        />

        <input style={input} value={form.cnic}
          onChange={e => setForm({ ...form, cnic: e.target.value })}
          placeholder="CNIC"
        />

        <input style={input} value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
          placeholder="Address"
        />

        <button style={btn} onClick={updateClient}>
          Save
        </button>
      </div>

      {/* =========================
          ADD CASE
      ========================= */}
      <div style={card}>
        <h3>➕ Add Case</h3>

        <input style={input}
          value={caseForm.id}
          onChange={e => setCaseForm({ ...caseForm, id: e.target.value })}
          placeholder="Case ID"
        />

        <input style={input}
          value={caseForm.title}
          onChange={e => setCaseForm({ ...caseForm, title: e.target.value })}
          placeholder="Title"
        />

        <textarea style={input}
          value={caseForm.description}
          onChange={e => setCaseForm({ ...caseForm, description: e.target.value })}
          placeholder="Description"
        />

        <button style={btn} onClick={addCase}>
          Add Case
        </button>
      </div>

      {/* =========================
          CASES
      ========================= */}
      <div style={card}>
        <h3>⚖️ Cases</h3>

        <div style={grid}>
          {clientCases.map(c => (
            <div
              key={c.id}
              style={caseCard}
              onClick={() => navigate(`/cases/${c.id}`)}
            >
              <h4>{c.title}</h4>
              <p>{c.status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* =========================
          HEARING SUMMARY (NEW)
      ========================= */}
      <div style={card}>
        <h3>📅 Hearing Summary</h3>

        {clientHearings.length === 0 ? (
          <p>No hearings scheduled</p>
        ) : (
          clientHearings.map(h => (
            <div key={h.id} style={hearingCard}>
              <h4>{h.event}</h4>
              <p><b>Date:</b> {h.date}</p>
              <p><b>Notes:</b> {h.notes}</p>
              <p style={{ fontSize: "12px", color: "gray" }}>
                Case ID: {h.case_id}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =========================
// STYLES
// =========================
const card = {
  background: "white",
  padding: "15px",
  marginBottom: "15px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)"
};

const input = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc"
};

const btn = {
  padding: "10px 15px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "10px"
};

const caseCard = {
  background: "#f9f9f9",
  padding: "10px",
  borderRadius: "10px",
  cursor: "pointer",
  border: "1px solid #ddd"
};

const hearingCard = {
  background: "#eef2ff",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "10px",
  borderLeft: "4px solid #4f46e5"
};

export default ClientDetails;