import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
  addDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    cnic: "",
    address: "",
    email: "",
    phone: ""
  });

  const [caseForm, setCaseForm] = useState({
    title: "",
    description: ""
  });

  // =========================
  // FETCH CLIENT
  // =========================
  const fetchClient = async () => {
    const snap = await getDoc(doc(db, "clients", id));

    if (snap.exists()) {
      const data = snap.data();
      setClient(data);

      setForm({
        name: data.name || "",
        cnic: data.cnic || "",
        address: data.address || "",
        email: data.email || "",
        phone: data.phone || ""
      });
    } else {
      setClient(null);
    }
  };

  // =========================
  // FETCH CASES
  // =========================
  const fetchCases = async () => {
    const q = query(collection(db, "cases"), where("client_id", "==", id));
    const snap = await getDocs(q);

    setCases(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
    );
  };

  // =========================
  // FETCH HEARINGS
  // =========================
  const fetchHearings = async () => {
    const snap = await getDocs(collection(db, "hearings"));

    setHearings(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
    );
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchClient(), fetchCases(), fetchHearings()]);
      setLoading(false);
    };

    load();
  }, [id]);

  // =========================
  // UPDATE CLIENT
  // =========================
  const updateClient = async () => {
    await updateDoc(doc(db, "clients", id), form);
    fetchClient();
  };

  // =========================
  // ADD CASE
  // =========================
  const addCase = async () => {
    if (!caseForm.title || !caseForm.description) return;

    await addDoc(collection(db, "cases"), {
      client_id: id,
      title: caseForm.title,
      description: caseForm.description,
      status: "Open",
      court_type: localStorage.getItem("court")
    });

    setCaseForm({ title: "", description: "" });
    fetchCases();
  };

  if (loading) return <div style={page}>Loading...</div>;
  if (!client) return <div style={page}>Client not found</div>;

  const clientCaseIds = cases.map(c => c.id);
  const clientHearings = hearings.filter(h =>
    clientCaseIds.includes(h.case_id)
  );

  return (
    <div style={page}>

      <h2 style={title}>👤 Client Dashboard</h2>

      <div style={grid}>

        {/* CLIENT INFO */}
        <div style={card}>
          <h3 style={cardTitle}>Client Information</h3>

          <input style={input} value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Full Name"
          />

          <input style={input} value={form.cnic}
            onChange={e => setForm({ ...form, cnic: e.target.value })}
            placeholder="CNIC"
          />

          <input style={input} value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Address"
          />

          <input style={input} value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
          />

          <input style={input} value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone"
          />

          <button style={btn} onClick={updateClient}>
            Save Changes
          </button>
        </div>

        {/* ADD CASE */}
        <div style={card}>
          <h3 style={cardTitle}>➕ Add Case</h3>

          <input style={input}
            value={caseForm.title}
            onChange={e => setCaseForm({ ...caseForm, title: e.target.value })}
            placeholder="Case Title"
          />

          <textarea style={textarea}
            value={caseForm.description}
            onChange={e => setCaseForm({ ...caseForm, description: e.target.value })}
            placeholder="Case Description"
          />

          <button style={btn} onClick={addCase}>
            Create Case
          </button>
        </div>

      </div>

      {/* CASES */}
      <div style={card}>
        <h3 style={cardTitle}>⚖️ Cases</h3>

        <div style={cardGrid}>
          {cases.map(c => (
            <div
              key={c.id}
              style={miniCard}
              onClick={() => navigate(`/cases/${c.id}`)}
            >
              <h4>{c.title}</h4>
              <p style={{ color: "#888" }}>{c.status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HEARINGS */}
      <div style={card}>
        <h3 style={cardTitle}>📅 Hearings</h3>

        {clientHearings.length === 0 ? (
          <p style={{ color: "#888" }}>No hearings</p>
        ) : (
          clientHearings.map(h => (
            <div key={h.id} style={miniCard}>
              <h4>{h.event}</h4>
              <p style={{ color: "#888" }}>{h.date}</p>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

/* ================= THEME ================= */

const page = {
  padding: "25px",
  background: "#f4f5f7",
  minHeight: "100vh"
};

const title = {
  marginBottom: "20px",
  color: "#111"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px"
};

const card = {
  background: "#ffffff",
  padding: "20px",
  borderRadius: "12px",
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
  padding: "10px",
  height: "80px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd"
};

const btn = {
  padding: "10px 15px",
  background: "#1f2937",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "10px"
};

const miniCard = {
  background: "#f9fafb",
  padding: "12px",
  borderRadius: "10px",
  cursor: "pointer",
  border: "1px solid #eee"
};

export default ClientDetails;