import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
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

  const [userId, setUserId] = useState(null);
  const court = localStorage.getItem("court");

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

  /* ================= AUTH ================= */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });

    return () => unsub();
  }, []);

  /* ================= CLIENT ================= */
  const fetchClient = async () => {
    if (!userId) return;

    const snap = await getDoc(doc(db, "users", userId, "clients", id));

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

  /* ================= CASES (FIXED LOGIC) ================= */
  const fetchCases = async () => {
    if (!userId) return;

    const q = query(
      collection(db, "cases"),
      where("userId", "==", userId),
      where("court_type", "==", court)
    );

    const snap = await getDocs(q);

    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // IMPORTANT FIX: filter safely in frontend too
    const filtered = all.filter(c => c.client_id === id);

    setCases(filtered);
  };

  /* ================= HEARINGS ================= */
  const fetchHearings = async () => {
    if (!userId) return;

    const q = query(
      collection(db, "hearings"),
      where("userId", "==", userId),
      where("court_type", "==", court)
    );

    const snap = await getDocs(q);

    setHearings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  /* ================= LOAD ================= */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchClient(), fetchCases(), fetchHearings()]);
      setLoading(false);
    };

    load();
  }, [id, userId, court]);

  /* ================= UPDATE CLIENT ================= */
  const updateClient = async () => {
    await updateDoc(doc(db, "users", userId, "clients", id), form);
    fetchClient();
  };

  /* ================= ADD CASE ================= */
  const addCase = async () => {
    if (!caseForm.title) return;

    await addDoc(collection(db, "cases"), {
      client_id: id,
      title: caseForm.title,
      description: caseForm.description,
      status: "Open",
      court_type: court,
      userId
    });

    setCaseForm({ title: "", description: "" });
    fetchCases();
  };

  /* ================= LOADING ================= */
  if (loading) return <div style={page}>Loading...</div>;
  if (!client) return <div style={page}>Client not found</div>;

  /* ================= CLIENT HEARINGS ================= */
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
          {cases.length === 0 ? (
            <p style={{ color: "#888" }}>No cases found for this client</p>
          ) : (
            cases.map(c => (
              <div
                key={c.id}
                style={miniCard}
                onClick={() => navigate(`/cases/${c.id}`)}
              >
                <h4>{c.title}</h4>
                <p style={{ color: "#888" }}>{c.status}</p>
              </div>
            ))
          )}
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

/* ================= STYLES (UNCHANGED) ================= */

const page = {
  padding: "25px",
  background: "#f4f5f7",
  minHeight: "100vh"
};

const title = { marginBottom: "20px" };

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

const cardTitle = { marginBottom: "15px" };

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
  borderRadius: "8px"
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
  border: "1px solid #eee",
  cursor: "pointer"
};

export default ClientDetails;