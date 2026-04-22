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
  // FETCH CLIENT (FIXED)
  // =========================
  const fetchClient = async () => {
    try {
      const ref = doc(db, "clients", id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
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
    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // FETCH CASES
  // =========================
  const fetchCases = async () => {
    try {
      const q = query(
        collection(db, "cases"),
        where("client_id", "==", id)
      );

      const snap = await getDocs(q);

      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setCases(data);
    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // FETCH HEARINGS
  // =========================
  const fetchHearings = async () => {
    try {
      const snap = await getDocs(collection(db, "hearings"));

      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setHearings(data);
    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // INIT
  // =========================
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
    try {
      const ref = doc(db, "clients", id);
      await fetchClient();
      await updateDoc(ref, form);
      fetchClient();
    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // ADD CASE
  // =========================
  const addCase = async () => {
    try {
      const court = localStorage.getItem("court");

      if (!caseForm.title || !caseForm.description) {
        alert("Fill all case fields");
        return;
      }

      await addDoc(collection(db, "cases"), {
        client_id: id,
        title: caseForm.title,
        description: caseForm.description,
        status: "Open",
        court_type: court
      });

      setCaseForm({ title: "", description: "" });
      fetchCases();

    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // LOADING FIX
  // =========================
  if (loading) return <p style={{ padding: "20px" }}>Loading client...</p>;
  if (!client) return <p style={{ padding: "20px" }}>Client not found</p>;

  // =========================
  // FILTERS
  // =========================
  const clientCases = cases;

  const clientCaseIds = clientCases.map(c => c.id);

  const clientHearings = hearings.filter(h =>
    clientCaseIds.includes(h.case_id)
  );

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>

      <h2>👤 Client Dashboard</h2>

      {/* CLIENT INFO */}
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

        <input style={input} value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="Email"
        />

        <input style={input} value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
          placeholder="Phone"
        />

        <button style={btn} onClick={updateClient}>
          Save
        </button>
      </div>

      {/* ADD CASE */}
      <div style={card}>
        <h3>➕ Add Case</h3>

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

      {/* CASES */}
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

      {/* HEARINGS */}
      <div style={card}>
        <h3>📅 Hearings</h3>

        {clientHearings.length === 0 ? (
          <p>No hearings</p>
        ) : (
          clientHearings.map((h, i) => (
            <div key={h.id || i} style={hearingCard}>
              <h4>{h.event}</h4>
              <p>{h.date}</p>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

/* STYLES (same) */

const card = {
  background: "white",
  padding: "15px",
  marginBottom: "15px",
  borderRadius: "12px"
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
  borderRadius: "8px"
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
  cursor: "pointer"
};

const hearingCard = {
  background: "#eef2ff",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "10px"
};

export default ClientDetails;