import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where
} from "firebase/firestore";

function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState(null);

  const navigate = useNavigate();
  const court = localStorage.getItem("court");

  const [form, setForm] = useState({
    name: "",
    cnic: "",
    phone: ""
  });

  // ================= AUTH =================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });

    return () => unsub();
  }, []);

  // ================= FETCH =================
  const fetchClients = async () => {
    if (!userId || !court) return;

    const q = query(
      collection(db, "users", userId, "clients"),
      where("court_type", "==", court)
    );

    const snap = await getDocs(q);

    setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchClients();
  }, [userId, court]);

  // ================= ADD =================
  const handleSubmit = async () => {
    if (!form.name || !form.cnic || !userId) return;

    await addDoc(
      collection(db, "users", userId, "clients"),
      {
        ...form,
        court_type: court
      }
    );

    setForm({ name: "", cnic: "", phone: "" });
    fetchClients();
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "users", userId, "clients", id));
    fetchClients();
  };

  // ================= FILTER =================
  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.cnic?.includes(search)
  );

  // ================= UI =================
  return (
    <div style={page}>
      <h2 style={title}>👤 Clients</h2>
      <p style={subtitle}>Court: {court?.toUpperCase()}</p>

      {/* FORM */}
      <div style={card}>
        <h3>Add Client</h3>

        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={input}
        />

        <input
          placeholder="CNIC"
          value={form.cnic}
          onChange={(e) => setForm({ ...form, cnic: e.target.value })}
          style={input}
        />

        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          style={input}
        />

        <button onClick={handleSubmit} style={btn}>
          Add Client
        </button>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search by name or CNIC..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={searchBox}
      />

      {/* LIST */}
      <div style={grid}>
        {filteredClients.length === 0 ? (
          <p style={{ color: "#666" }}>No clients found</p>
        ) : (
          filteredClients.map(c => (
            <div key={c.id} style={cardBox}>
              
              <div
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/clients/${c.id}`)}
              >
                <h3>{c.name}</h3>
                <p style={meta}>CNIC: {c.cnic}</p>
                {c.phone && <p style={meta}>📞 {c.phone}</p>}
              </div>

              <button
                onClick={() => handleDelete(c.id)}
                style={danger}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const page = {
  padding: 20,
  background: "#f5f6fa",
  minHeight: "100vh"
};

const title = { marginBottom: "5px" };

const subtitle = { marginBottom: "15px", color: "#666" };

const card = {
  background: "#fff",
  padding: 15,
  borderRadius: 12,
  marginBottom: 15,
  boxShadow: "0 3px 10px rgba(0,0,0,0.05)"
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #ddd"
};

const btn = {
  width: "100%",
  padding: 10,
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: 10
};

const searchBox = {
  width: "100%",
  padding: 10,
  marginBottom: 15,
  borderRadius: 10,
  border: "1px solid #ddd"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12
};

const cardBox = {
  background: "#fff",
  padding: 15,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
};

const meta = {
  fontSize: 13,
  color: "#666",
  marginTop: 3
};

const danger = {
  marginTop: 10,
  width: "100%",
  padding: 8,
  background: "red",
  color: "#fff",
  border: "none",
  borderRadius: 8
};

export default Clients;