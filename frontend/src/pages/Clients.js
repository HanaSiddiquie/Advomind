// frontend/src/pages/Clients.js
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
import { colors, font } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

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
    <PageContainer
      eyebrow={court?.toUpperCase()}
      title="Clients"
      subtitle="Manage client records for this court"
    >
      {/* FORM */}
      <Card style={{ marginBottom: 20 }}>
        <h3 style={cardTitle}>Add Client</h3>

        <div style={formRow}>
          <Input
            placeholder="Full name"
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <Input
            placeholder="42101-1234567-1"
            label="CNIC"
            value={form.cnic}
            onChange={(e) => setForm({ ...form, cnic: e.target.value })}
          />

          <Input
            placeholder="03xx-xxxxxxx"
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>

        <Button onClick={handleSubmit} full>
          Add Client
        </Button>
      </Card>

      {/* SEARCH */}
      <Input
        placeholder="Search by name or CNIC…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 6 }}
      />

      {/* LIST */}
      <div style={grid}>
        {filteredClients.length === 0 ? (
          <p style={emptyText}>No clients found</p>
        ) : (
          filteredClients.map(c => (
            <Card key={c.id} hoverable style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>

              <div
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/clients/${c.id}`)}
              >
                <h3 style={clientName}>{c.name}</h3>
                <p style={meta}>CNIC: {c.cnic}</p>
                {c.phone && <p style={meta}>{c.phone}</p>}
              </div>

              <Button
                variant="danger"
                onClick={() => handleDelete(c.id)}
                full
                style={{ marginTop: 14 }}
              >
                Delete
              </Button>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}

/* ================= STYLES ================= */

const cardTitle = {
  fontFamily: font.display,
  fontSize: "16px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 16px",
};

const formRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0 14px",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginTop: 20,
};

const clientName = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 6px",
};

const meta = {
  fontSize: 13,
  color: colors.slate,
  margin: "2px 0",
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default Clients;