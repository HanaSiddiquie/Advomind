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
import Modal from "../components/ui/Modal";
import { useAuthRole } from "../context/AuthRoleContext";
import { cascadeDeleteClient } from "../services/cascadeDelete";
import { confirmDialog } from "../components/Notifications";
import { toast } from "../components/Notifications";
import Loading from "../components/ui/Loading";
import MoreMenu from "../components/ui/MoreMenu";
import EmptyState from "../components/ui/EmptyState";

function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
    setLoaded(true);
  };

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, court]);

  // ================= ADD =================
  const handleSubmit = async () => {
    if (!form.name.trim() || !form.cnic.trim()) {
      alert("Name and CNIC are required");
      return;
    }
    if (!userId) return;

    await addDoc(
      collection(db, "users", userId, "clients"),
      {
        ...form,
        court_type: court,
        createdBy: user.uid
      }
    );

    setForm({ name: "", cnic: "", phone: "" });
    setShowAddModal(false);
    fetchClients();
    toast("Client created", "success");
  };

  // ================= DELETE (cascades to cases, hearings, notes, files, billing) =================
  const handleDelete = async (id, name) => {
    const confirmed = await confirmDialog(
      `Delete ${name || "this client"}? This will also permanently delete every case, hearing, ` +
      `note, file, and billing record attached to them (active and archived). This cannot be undone.`
          , { danger: true }
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const result = await cascadeDeleteClient({ clientId: id, ownerId: userId, court });
      const parts = [];
      if (result.deletedCases) parts.push(`${result.deletedCases} case(s)`);
      if (result.deletedArchivedCases) parts.push(`${result.deletedArchivedCases} archived case(s)`);
            toast(parts.length ? `Client deleted, along with ${parts.join(" and ")}.` : "Client deleted", "success");
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
      action={<Button onClick={() => setShowAddModal(true)}>+ Add Client</Button>}
    >
      {/* ADD CLIENT MODAL */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Client"
      >
        <Input
                    voice
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

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Button onClick={handleSubmit} style={{ flex: 1 }}>Add Client</Button>
          <Button variant="secondary" onClick={() => setShowAddModal(false)} style={{ flex: 1 }}>
            Cancel
          </Button>
        </div>
      </Modal>

      {/* SEARCH */}
      <Input
                voice
        placeholder="Search by name or CNIC…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 6 }}
      />

      {/* LIST */}
      <div style={grid}>
                {!loaded ? (
          <Loading />
        ) : clients.length === 0 ? (
                    <EmptyState
            icon="👤"
            title="No clients yet"
            text="Add your first client to start creating cases and scheduling hearings."
            action="+ Add Client"
            onAction={() => setShowAddModal(true)}
          />
        ) : filteredClients.length === 0 ? (
          <p style={emptyText}>No clients match your search</p>
        ) : (
          filteredClients.map(c => (
                        <Card key={c.id} hoverable>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/clients/${c.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate(`/clients/${c.id}`); }}
                  style={{ cursor: "pointer", flex: 1, minWidth: 0 }}
                >
                  <h3 style={clientName}>{c.name}</h3>
                  <p style={meta}>CNIC: {c.cnic}</p>
                  {c.phone && <p style={meta}>{c.phone}</p>}
                </div>

                {canDelete && (
                  <MoreMenu
                    items={[
                      {
                        label: deletingId === c.id ? "Deleting…" : "Delete client…",
                        danger: true,
                        onClick: () => handleDelete(c.id, c.name),
                      },
                    ]}
                  />
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}

/* ================= STYLES ================= */

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