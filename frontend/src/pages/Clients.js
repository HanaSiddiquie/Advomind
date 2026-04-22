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

  // ✅ COURT STATE (reactive)
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

  // =========================
  // FETCH CLIENTS (COURT FILTERED)
  // =========================
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
    } catch (err) {
      console.log("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [courtType]);

  // =========================
  // DELETE CLIENT
  // =========================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this client?")) return;

    try {
      await deleteDoc(doc(db, "clients", id));
      fetchClients();
    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // EDIT
  // =========================
  const handleEdit = (client) => {
    setForm({
      name: client.name,
      cnic: client.cnic,
      address: client.address,
      email: client.email,
      phone: client.phone
    });

    setEditing(true);
    setCurrentId(client.id);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // =========================
  // VALIDATION
  // =========================
  const validateForm = () => {
    if (!form.name || !form.cnic || !form.address || !form.email || !form.phone) {
      alert("Please fill all fields");
      return false;
    }

    if (!courtType) {
      alert("Court not selected");
      return false;
    }

    return true;
  };

  // =========================
  // SUBMIT (CREATE / UPDATE)
  // =========================
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const payload = {
        ...form,
        court_type: courtType
      };

      if (editing) {
        await updateDoc(doc(db, "clients", currentId), payload);
      } else {
        await addDoc(collection(db, "clients"), payload);
      }

      resetForm();
      fetchClients();
    } catch (err) {
      console.log("Submit error:", err);
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      cnic: "",
      address: "",
      email: "",
      phone: ""
    });

    setEditing(false);
    setCurrentId(null);
  };

  // =========================
  // SEARCH FILTER
  // =========================
  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.cnic?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>

      <h2>👤 Clients Dashboard ({courtType?.toUpperCase() || "NO COURT"})</h2>

      <input
        style={searchBar}
        placeholder="🔍 Search clients..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* FORM */}
      <div style={formCard}>
        <h3>{editing ? "✏️ Edit Client" : "➕ Add New Client"}</h3>

        <div style={grid}>
          <input style={input} name="name" value={form.name} onChange={handleChange} placeholder="Name" />
          <input style={input} name="cnic" value={form.cnic} onChange={handleChange} placeholder="CNIC" />
          <input style={input} name="phone" value={form.phone} onChange={handleChange} placeholder="Phone" />
          <input style={input} name="email" value={form.email} onChange={handleChange} placeholder="Email" />
          <textarea style={textarea} name="address" value={form.address} onChange={handleChange} placeholder="Address" />
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
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

      {loading && <p>Loading clients...</p>}

      {/* CLIENT CARDS */}
      <div style={cardGrid}>
        {filteredClients.map(c => (
          <div key={c.id} style={card}>

            <div
              onClick={() => navigate(`/clients/${c.id}`)}
              style={{ cursor: "pointer" }}
            >
              <h3>{c.name}</h3>
              <p><b>CNIC:</b> {c.cnic}</p>
              <p><b>Email:</b> {c.email}</p>
              <p><b>Phone:</b> {c.phone}</p>
            </div>

            <div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
              <button onClick={() => handleEdit(c)} style={btn}>
                Edit
              </button>

              <button onClick={() => handleDelete(c.id)} style={deleteBtn}>
                🗑 Delete
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}

/* STYLES */
const searchBar = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  marginBottom: "20px"
};

const formCard = {
  background: "white",
  padding: "25px",
  borderRadius: "16px",
  marginBottom: "25px"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "10px"
};

const input = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd"
};

const textarea = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  minHeight: "70px"
};

const btn = {
  padding: "12px 18px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "10px"
};

const cancelBtn = {
  padding: "12px 18px",
  background: "#e5e7eb",
  border: "none",
  borderRadius: "10px"
};

const deleteBtn = {
  padding: "12px 18px",
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: "10px"
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "15px"
};

const card = {
  background: "white",
  padding: "15px",
  borderRadius: "12px"
};

export default Clients;