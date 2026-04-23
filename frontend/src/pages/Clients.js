import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where
} from "firebase/firestore";

function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const [courtType, setCourtType] = useState(localStorage.getItem("court"));

  useEffect(() => {
    const handler = () => {
      setCourtType(localStorage.getItem("court"));
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const [form, setForm] = useState({
    name: "",
    cnic: "",
    address: "",
    email: "",
    phone: ""
  });

  const [editing, setEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);

  // ================= FETCH =================
  const fetchClients = async () => {
    setLoading(true);

    try {
      if (!courtType) return;

      const q = query(
        collection(db, "clients"),
        where("court_type", "==", courtType)
      );

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setClients(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [courtType]);

  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this client?")) return;
    await deleteDoc(doc(db, "clients", id));
    fetchClients();
  };

  const handleEdit = (client) => {
    setForm(client);
    setEditing(true);
    setCurrentId(client.id);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const payload = { ...form, court_type: courtType };

    if (editing) {
      await updateDoc(doc(db, "clients", currentId), payload);
    } else {
      await addDoc(collection(db, "clients"), payload);
    }

    setForm({ name: "", cnic: "", address: "", email: "", phone: "" });
    setEditing(false);
    setCurrentId(null);
    fetchClients();
  };

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.cnic?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={container}>

      {/* HEADER */}
      <div style={header}>
        <div>
          <h2 style={{ margin: 0 }}>👤 Clients</h2>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Court: {courtType?.toUpperCase()}
          </p>
        </div>

        <input
          style={searchBar}
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* FORM CARD */}
      <div style={formCard}>
        <h3 style={{ marginBottom: 15 }}>
          {editing ? "✏️ Edit Client" : "➕ Add New Client"}
        </h3>

        <div style={grid}>
          <input style={input} name="name" value={form.name} onChange={handleChange} placeholder="Name" />
          <input style={input} name="cnic" value={form.cnic} onChange={handleChange} placeholder="CNIC" />
          <input style={input} name="phone" value={form.phone} onChange={handleChange} placeholder="Phone" />
          <input style={input} name="email" value={form.email} onChange={handleChange} placeholder="Email" />
          <input style={{ ...input, gridColumn: "span 2" }} name="address" value={form.address} onChange={handleChange} placeholder="Address" />
        </div>

        <button style={btn} onClick={handleSubmit}>
          {editing ? "Update Client" : "Save Client"}
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {/* CLIENT CARDS */}
      <div style={cardGrid}>
        {filteredClients.map(c => (
          <div key={c.id} style={card}>

            <div onClick={() => navigate(`/clients/${c.id}`)} style={{ cursor: "pointer" }}>
              <h3 style={{ marginBottom: 5 }}>{c.name}</h3>
              <p style={meta}><b>CNIC:</b> {c.cnic}</p>
              <p style={meta}><b>Email:</b> {c.email}</p>
              <p style={meta}><b>Phone:</b> {c.phone}</p>
            </div>

            <div style={btnRow}>
              <button onClick={() => handleEdit(c)} style={editBtn}>Edit</button>
              <button onClick={() => handleDelete(c.id)} style={deleteBtn}>Delete</button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}

/* ================= THEME ================= */

const container = {
  padding: "20px",
  background: "#e5e7eb",
  minHeight: "100vh"
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px"
};

const searchBar = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  width: "260px"
};

const formCard = {
  background: "#fff",
  padding: "20px",
  borderRadius: "14px",
  marginBottom: "25px",
  boxShadow: "0 6px 20px rgba(0,0,0,0.08)"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "10px"
};

const input = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db"
};

const btn = {
  marginTop: "10px",
  padding: "12px",
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: "10px",
  width: "100%",
  cursor: "pointer"
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "15px"
};

const card = {
  background: "#fff",
  padding: "15px",
  borderRadius: "12px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.08)"
};

const meta = {
  fontSize: "13px",
  color: "#6b7280"
};

const btnRow = {
  display: "flex",
  gap: "10px",
  marginTop: "10px"
};

const editBtn = {
  flex: 1,
  padding: "8px",
  background: "#374151",
  color: "white",
  border: "none",
  borderRadius: "8px"
};

const deleteBtn = {
  flex: 1,
  padding: "8px",
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: "8px"
};

export default Clients;