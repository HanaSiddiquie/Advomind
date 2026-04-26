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

function Cases() {
  const [cases, setCases] = useState({ active: [], archived: [] });
  const [clients, setClients] = useState([]);

  const [userId, setUserId] = useState(null);
  const court = localStorage.getItem("court");

  const navigate = useNavigate();

  const [form, setForm] = useState({
    client_id: "",
    title: "",
    description: ""
  });

  // ================= AUTH =================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });
    return () => unsub();
  }, []);

  // ================= FETCH =================
  const fetchData = async () => {
    if (!userId || !court) return;

    const caseQ = query(
      collection(db, "cases"),
      where("userId", "==", userId),
      where("court_type", "==", court)
    );

    const archiveQ = query(
      collection(db, "archive"),
      where("userId", "==", userId),
      where("court_type", "==", court)
    );

    const clientQ = query(
      collection(db, "clients"),
      where("userId", "==", userId),
      where("court_type", "==", court)
    );

    const [caseSnap, archiveSnap, clientSnap] = await Promise.all([
      getDocs(caseQ),
      getDocs(archiveQ),
      getDocs(clientQ)
    ]);

    const active = caseSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const archived = archiveSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    setCases({ active, archived });
    setClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchData();
  }, [userId, court]);

  // ================= ADD =================
  const handleSubmit = async () => {
    if (!form.title || !userId) return;

    await addDoc(collection(db, "cases"), {
      ...form,
      userId,
      court_type: court,
      status: "Open",
      createdAt: Date.now()
    });

    setForm({ client_id: "", title: "", description: "" });
    fetchData();
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "cases", id));
    fetchData();
  };

  // ================= ARCHIVE FIXED =================
  const archiveCase = async (caseItem) => {
    try {
      const { id, ...data } = caseItem;

      await addDoc(collection(db, "archive"), {
        ...data,
        originalCaseId: id,
        archivedAt: Date.now()
      });

      await deleteDoc(doc(db, "cases", id));

      fetchData();
    } catch (err) {
      console.error("Archive failed:", err);
      alert("Archive failed");
    }
  };

  // ================= RESTORE FIXED =================
  const restoreCase = async (caseItem) => {
    try {
      const { id, originalCaseId, archivedAt, ...cleanData } = caseItem;

      await addDoc(collection(db, "cases"), {
        ...cleanData,
        status: "Open",
        restoredAt: Date.now()
      });

      await deleteDoc(doc(db, "archive", id));

      fetchData();
    } catch (err) {
      console.error("Restore failed:", err);
      alert("Restore failed");
    }
  };

  return (
    <div style={page}>
      <h2 style={title}>📁 Cases</h2>
      <p style={subtitle}>Court: {court?.toUpperCase()}</p>

      {/* FORM */}
      <div style={card}>
        <h3>Add New Case</h3>

        <select
          style={input}
          value={form.client_id}
          onChange={(e) =>
            setForm({ ...form, client_id: e.target.value })
          }
        >
          <option value="">Select Client</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          placeholder="Case Title"
          value={form.title}
          onChange={(e) =>
            setForm({ ...form, title: e.target.value })
          }
          style={input}
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
          style={input}
        />

        <button onClick={handleSubmit} style={btn}>
          Add Case
        </button>
      </div>

      {/* ACTIVE */}
      <h3 style={{ marginTop: 20 }}>🟢 Active Cases</h3>

      <div style={grid}>
        {cases.active.length === 0 ? (
          <p>No active cases</p>
        ) : (
          cases.active.map(c => (
            <div key={c.id} style={cardBox}>
              <div onClick={() => navigate(`/cases/${c.id}`)}>
                <h3>{c.title}</h3>
                <p>{c.status}</p>
              </div>

              <button onClick={() => archiveCase(c)} style={btn}>
                Archive
              </button>

              <button onClick={() => handleDelete(c.id)} style={danger}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {/* ARCHIVED */}
      <h3 style={{ marginTop: 30 }}>📦 Archived Cases</h3>

      <div style={grid}>
        {cases.archived.length === 0 ? (
          <p>No archived cases</p>
        ) : (
          cases.archived.map(c => (
            <div key={c.id} style={{ ...cardBox, opacity: 0.7 }}>
              <h3>{c.title}</h3>
              <p>Archived</p>

              <button
                onClick={() => restoreCase(c)}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: 8,
                  background: "green",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8
                }}
              >
                Restore
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* styles unchanged */
const page = { padding: 20, background: "#f5f6fa", minHeight: "100vh" };
const title = { marginBottom: 5 };
const subtitle = { marginBottom: 15, color: "#666" };
const card = { background: "#fff", padding: 15, borderRadius: 12, marginBottom: 15 };
const input = { width: "100%", padding: 10, marginBottom: 10 };
const btn = { width: "100%", padding: 10, background: "#111", color: "#fff" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const cardBox = { background: "#fff", padding: 15, borderRadius: 12 };
const danger = { marginTop: 10, width: "100%", padding: 8, background: "red", color: "#fff" };

export default Cases;