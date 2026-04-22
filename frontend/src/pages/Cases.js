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
  // FETCH DATA (COURT FIXED)
  // =========================
  const fetchData = async () => {
    setLoading(true);

    try {
      if (!court) return;

      // CASES (COURT FILTER)
      const caseQuery = query(
        collection(db, "cases"),
        where("court_type", "==", court)
      );

      const caseSnap = await getDocs(caseQuery);

      const caseData = caseSnap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));

      // CLIENTS (COURT FILTER)
      const clientQuery = query(
        collection(db, "clients"),
        where("court_type", "==", court)
      );

      const clientSnap = await getDocs(clientQuery);

      const clientData = clientSnap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));

      setCases(caseData);
      setClients(clientData);

    } catch (err) {
      console.log("FETCH ERROR:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [court]);

  // =========================
  // DELETE CASE
  // =========================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this case?")) return;

    try {
      await deleteDoc(doc(db, "cases", id));
      fetchData();
    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // INPUT
  // =========================
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // =========================
  // SUBMIT CASE
  // =========================
  const handleSubmit = async () => {
    try {
      if (!court) {
        alert("Select court first");
        return;
      }

      if (!form.client_id || !form.title || !form.description) {
        alert("Fill all fields");
        return;
      }

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

    } catch (err) {
      console.log("SUBMIT ERROR:", err);
    }
  };

  // =========================
  // HELPERS
  // =========================
  const getClientName = (id) => {
    const c = clients.find((x) => x.id === id);
    return c ? c.name : "Unknown Client";
  };

  // =========================
  // SEARCH
  // =========================
  const filteredCases = cases.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>

      <h2>📁 Cases ({court?.toUpperCase()})</h2>

      <input
        style={searchBar}
        placeholder="Search cases..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* FORM */}
      <div style={formBox}>
        <h3>Add Case</h3>

        <select
          style={input}
          name="client_id"
          value={form.client_id}
          onChange={handleChange}
        >
          <option value="">Select Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.cnic}
            </option>
          ))}
        </select>

        <input
          style={input}
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Title"
        />

        <input
          style={input}
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Description"
        />

        <button onClick={handleSubmit} style={btn}>
          ➕ Add Case
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {/* LIST */}
      <div style={grid}>
        {filteredCases.map((c) => (
          <div key={c.id} style={card}>

            <div onClick={() => navigate(`/cases/${c.id}`)}>
              <h3>{c.title}</h3>
              <p><b>Client:</b> {getClientName(c.client_id)}</p>
              <p><b>Status:</b> {c.status}</p>
              <p style={{ fontSize: "12px", color: "gray" }}>
                Court: {c.court_type}
              </p>
            </div>

            <button onClick={() => handleDelete(c.id)} style={deleteBtn}>
              Delete
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}

/* STYLES */
const searchBar = {
  width: "100%",
  padding: "10px",
  marginBottom: "15px",
  border: "1px solid #ddd",
  borderRadius: "8px"
};

const formBox = {
  background: "white",
  padding: "15px",
  borderRadius: "10px",
  marginBottom: "20px"
};

const input = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  border: "1px solid #ddd",
  borderRadius: "8px"
};

const btn = {
  padding: "10px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "8px",
  width: "100%"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "15px"
};

const card = {
  background: "white",
  padding: "15px",
  borderRadius: "10px",
  cursor: "pointer"
};

const deleteBtn = {
  marginTop: "10px",
  width: "100%",
  padding: "8px",
  background: "red",
  color: "white",
  border: "none",
  borderRadius: "8px"
};

export default Cases;