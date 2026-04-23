import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where
} from "firebase/firestore";

function Cases() {
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const court = localStorage.getItem("court");

  const [form, setForm] = useState({
    client_id: "",
    title: "",
    description: "",
    status: "Open"
  });

  // =========================
  // FETCH DATA
  // =========================
  const fetchData = async () => {
    setLoading(true);

    try {
      if (!court) return;

      const caseSnap = await getDocs(
        query(collection(db, "cases"), where("court_type", "==", court))
      );

      const clientSnap = await getDocs(
        query(collection(db, "clients"), where("court_type", "==", court))
      );

      setCases(caseSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err) {
      console.log(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [court]);

  // =========================
  // DELETE
  // =========================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this case?")) return;
    await deleteDoc(doc(db, "cases", id));
    fetchData();
  };

  // =========================
  // SUBMIT
  // =========================
  const handleSubmit = async () => {
    if (!form.client_id || !form.title || !form.description) return;

    await addDoc(collection(db, "cases"), {
      ...form,
      court_type: court
    });

    setForm({
      client_id: "",
      title: "",
      description: "",
      status: "Open"
    });

    fetchData();
  };

  const getClientName = (id) => {
    const c = clients.find(x => x.id === id);
    return c ? c.name : "Unknown Client";
  };

  const filteredCases = cases.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={page}>

      <h2 style={title}>📁 Cases</h2>
      <p style={subtitle}>Court: {court?.toUpperCase()}</p>

      {/* SEARCH */}
      <input
        style={searchBar}
        placeholder="Search cases..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* =========================
          ADD CASE CARD (IMPROVED)
      ========================= */}
      <div style={formCard}>
        <h3 style={cardTitle}>➕ Create New Case</h3>

        <select
          style={input}
          name="client_id"
          value={form.client_id}
          onChange={(e) => setForm({ ...form, client_id: e.target.value })}
        >
          <option value="">Select Client</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.cnic}
            </option>
          ))}
        </select>

        <input
          style={input}
          placeholder="Case Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <textarea
          style={textarea}
          placeholder="Case Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <button style={btn} onClick={handleSubmit}>
          Create Case
        </button>
      </div>

      {loading && <p style={{ color: "#666" }}>Loading...</p>}

      {/* =========================
          CASE LIST
      ========================= */}
      <div style={grid}>
        {filteredCases.map(c => (
          <div key={c.id} style={card}>

            <div onClick={() => navigate(`/cases/${c.id}`)}>
              <h3 style={{ marginBottom: "5px" }}>{c.title}</h3>

              <p style={meta}>
                <b>Client:</b> {getClientName(c.client_id)}
              </p>

              <p style={meta}>
                <b>Status:</b> {c.status}
              </p>
            </div>

            <button style={deleteBtn} onClick={() => handleDelete(c.id)}>
              Delete
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================
   THEME STYLES (CLEAN UI)
========================= */

const page = {
  padding: "25px",
  background: "#f4f5f7",
  minHeight: "100vh"
};

const title = {
  marginBottom: "5px",
  color: "#111"
};

const subtitle = {
  marginBottom: "15px",
  color: "#666"
};

const searchBar = {
  width: "100%",
  padding: "12px",
  marginBottom: "20px",
  borderRadius: "10px",
  border: "1px solid #ddd"
};

const formCard = {
  background: "#ffffff",
  padding: "20px",
  borderRadius: "14px",
  marginBottom: "25px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)"
};

const cardTitle = {
  marginBottom: "15px",
  color: "#111"
};

const input = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd"
};

const textarea = {
  width: "100%",
  height: "80px",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd"
};

const btn = {
  width: "100%",
  padding: "10px",
  background: "#1f2937",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "15px"
};

const card = {
  background: "#fff",
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid #eee",
  cursor: "pointer"
};

const meta = {
  color: "#666",
  fontSize: "14px",
  margin: "4px 0"
};

const deleteBtn = {
  marginTop: "10px",
  width: "100%",
  padding: "8px",
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: "8px"
};

export default Cases;