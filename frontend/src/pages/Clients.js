import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function Clients() {
  const [clients, setClients] = useState([]);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    id: "",
    name: "",
    cnic: "",
    address: "",
    email: "",
    phone: ""
  });

  const [editing, setEditing] = useState(false);

  // =========================
  // FETCH CLIENTS
  // =========================
  const fetchClients = () => {
    API.get("/clients")
      .then(res => setClients(res.data.data || []))
      .catch(err => console.log(err));
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // =========================
  // FORM HANDLER
  // =========================
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // =========================
  // ADD / UPDATE
  // =========================
  const handleSubmit = () => {
    if (editing) {
      API.put(`/clients/${form.id}`, form)
        .then(() => {
          fetchClients();
          resetForm();
        })
        .catch(err => console.log(err));
    } else {
      API.post("/clients", form)
        .then(() => {
          fetchClients();
          resetForm();
        })
        .catch(err => console.log(err));
    }
  };

  const resetForm = () => {
    setForm({
      id: "",
      name: "",
      cnic: "",
      address: "",
      email: "",
      phone: ""
    });
    setEditing(false);
  };

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>
      
      <h2>👤 Clients Dashboard</h2>

      {/* =========================
          MODERN FORM CARD (UPGRADED UI)
      ========================= */}
      <div style={formCard}>
        <h3 style={{ marginBottom: "15px" }}>
          {editing ? "✏️ Edit Client" : "➕ Add New Client"}
        </h3>

        <div style={row}>
          <input
            style={input}
            name="id"
            value={form.id}
            onChange={handleChange}
            placeholder="Client ID"
            disabled={editing}
          />

          <input
            style={input}
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Full Name"
          />
        </div>

        <div style={row}>
          <input
            style={input}
            name="cnic"
            value={form.cnic}
            onChange={handleChange}
            placeholder="CNIC"
          />

          <input
            style={input}
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Phone Number"
          />
        </div>

        <input
          style={input}
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email Address"
        />

        <textarea
          style={textarea}
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="Full Address"
        />

        <div style={{ display: "flex", gap: "10px" }}>
          <button style={btn} onClick={handleSubmit}>
            {editing ? "Update Client" : "➕ Add Client"}
          </button>

          {editing && (
            <button style={cancelBtn} onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* =========================
          CLIENT CARDS
      ========================= */}
      <div style={cardGrid}>
        {clients.map(c => (
          <div
            key={c.id}
            style={card}
            onClick={() => navigate(`/clients/${c.id}`)}
          >
            <h3>{c.name}</h3>
            <p><b>ID:</b> {c.id}</p>
            <p><b>CNIC:</b> {c.cnic}</p>
            <p><b>Email:</b> {c.email}</p>
            <p><b>Phone:</b> {c.phone}</p>
            <p style={{ color: "gray", fontSize: "12px" }}>
              Click to open →
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================
// STYLES
// =========================
const formCard = {
  background: "white",
  padding: "20px",
  borderRadius: "15px",
  boxShadow: "0 3px 15px rgba(0,0,0,0.08)",
  marginBottom: "20px"
};

const row = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  marginBottom: "10px"
};

const input = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  width: "100%"
};

const textarea = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  minHeight: "80px",
  marginBottom: "10px"
};

const btn = {
  padding: "10px 15px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const cancelBtn = {
  padding: "10px 15px",
  background: "#e5e7eb",
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
  cursor: "pointer",
  transition: "0.2s"
};

export default Clients;