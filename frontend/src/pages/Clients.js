// frontend/src/pages/Clients.js
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where
} from "firebase/firestore";
import { colors, font } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuthRole } from "../context/AuthRoleContext";
import { cascadeDeleteClient } from "../services/cascadeDelete";

function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const { ownerId: userId, user, canDelete } = useAuthRole();

  const navigate = useNavigate();
  const court = localStorage.getItem("court");

  const [form, setForm] = useState({
    name: "",
    cnic: "",
    phone: ""
  });

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
        court_type: court,
        createdBy: user.uid
      }
    );

    setForm({ name: "", cnic: "", phone: "" });
    fetchClients();
  };

  // ================= DELETE (cascades to cases, hearings, notes, files) =================
  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(
      `Delete ${name || "this client"}? This will also permanently delete every case, hearing, ` +
      `note, and file attached to them (active and archived). This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const result = await cascadeDeleteClient({ clientId: id, ownerId: userId, court });
      const parts = [];
      if (result.deletedCases) parts.push(`${result.deletedCases} case(s)`);
      if (result.deletedArchivedCases) parts.push(`${result.deletedArchivedCases} archived case(s)`);
      if (parts.length) alert(`Client deleted, along with ${parts.join(" and ")}.`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong deleting this client. Some related records may remain — please try again.");
    } finally {
      setDeletingId(null);
    }

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
            <Card
              key={c.id}
              hoverable
              onClick={() => navigate(`/clients/${c.id}`)}
              style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >

              <div>
                <h3 style={clientName}>{c.name}</h3>
                <p style={meta}>CNIC: {c.cnic}</p>
                {c.phone && <p style={meta}>{c.phone}</p>}
              </div>

              {canDelete && (
                <Button
                  variant="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id, c.name);
                  }}
                  disabled={deletingId === c.id}
                  full
                  style={{ marginTop: 14 }}
                >
                  {deletingId === c.id ? "Deleting…" : "Delete"}
                </Button>
              )}
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