// frontend/src/pages/ManageSecretaries.js
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "../firebase";
import { useAuthRole } from "../context/AuthRoleContext";
import { createSecretary, setSecretaryStatus, deleteSecretary } from "../services/adminApi";
import { colors, font, radius } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

const COURTS = [
  { key: "civil", label: "Civil" },
  { key: "session", label: "Session" },
  { key: "high", label: "High" },
];

function ManageSecretaries() {
  const { user } = useAuthRole();
  const [secretaries, setSecretaries] = useState([]);
  const [busyUid, setBusyUid] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingUid, setEditingUid] = useState(null);
  const [editForm, setEditForm] = useState({ assignedCourts: [], canDelete: false });

  const [form, setForm] = useState({
    name: "",
    email: "",
    assignedCourts: []
  });

  // Live list of this lawyer's secretaries
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users"),
      where("lawyerId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setSecretaries(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [user]);

  const toggleCourt = (key) => {
    setForm(f => ({
      ...f,
      assignedCourts: f.assignedCourts.includes(key)
        ? f.assignedCourts.filter(c => c !== key)
        : [...f.assignedCourts, key]
    }));
  };

  const handleAdd = async () => {
    if (!form.name || !form.email || form.assignedCourts.length === 0) {
      alert("Name, email, and at least one court are required");
      return;
    }

    setSubmitting(true);
    try {
      await createSecretary(form);

      // Triggers Firebase's built-in password-reset email — the secretary
      // uses it to set her own password on first login.
      await sendPasswordResetEmail(auth, form.email);

      alert(`Secretary account created. An invite email was sent to ${form.email}.`);
      setForm({ name: "", email: "", assignedCourts: [] });
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDisabled = async (secretary) => {
    setBusyUid(secretary.uid);
    try {
      await setSecretaryStatus(secretary.uid, !secretary.disabled);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyUid(null);
    }
  };

  const handleDelete = async (secretary) => {
    if (!window.confirm(`Remove ${secretary.name}? This permanently deletes their login.`)) return;

    setBusyUid(secretary.uid);
    try {
      await deleteSecretary(secretary.uid);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyUid(null);
    }
  };

  const startEditing = (secretary) => {
    setEditingUid(secretary.uid);
    setEditForm({
      assignedCourts: secretary.assignedCourts || [],
      canDelete: secretary.canDelete === true
    });
  };

  const toggleEditCourt = (key) => {
    setEditForm(f => ({
      ...f,
      assignedCourts: f.assignedCourts.includes(key)
        ? f.assignedCourts.filter(c => c !== key)
        : [...f.assignedCourts, key]
    }));
  };

  const saveEdit = async (secretaryUid) => {
    if (editForm.assignedCourts.length === 0) {
      alert("A secretary needs at least one assigned court");
      return;
    }

    setBusyUid(secretaryUid);
    try {
      // Allowed directly via Firestore rules — a lawyer can update fields
      // (other than role/lawyerId) on their own secretaries' profiles.
      await updateDoc(doc(db, "users", secretaryUid), {
        assignedCourts: editForm.assignedCourts,
        canDelete: editForm.canDelete
      });
      setEditingUid(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <PageContainer
      title="Manage Secretaries"
      subtitle="Invite staff and control which courts they can access"
    >
      {/* ADD FORM */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={cardTitle}>Invite Secretary</h3>

        <div style={formRow}>
          <Input
            label="Name"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <Input
            label="Email"
            placeholder="secretary@lawfirm.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <label style={selectLabel}>Assigned Courts</label>
        <div style={courtRow}>
          {COURTS.map(c => (
            <button
              key={c.key}
              type="button"
              className="am-btn"
              onClick={() => toggleCourt(c.key)}
              style={form.assignedCourts.includes(c.key) ? courtChipActive : courtChip}
            >
              {c.label}
            </button>
          ))}
        </div>

        <Button onClick={handleAdd} disabled={submitting} style={{ marginTop: 10 }}>
          {submitting ? "Creating…" : "Send Invite"}
        </Button>
      </Card>

      {/* LIST */}
      <h3 style={groupTitle}>Your Secretaries</h3>

      {secretaries.length === 0 ? (
        <p style={emptyText}>No secretaries added yet</p>
      ) : (
        <div style={grid}>
          {secretaries.map(s => (
            <Card key={s.uid}>
              <h3 style={secName}>{s.name}</h3>
              <p style={meta}>{s.email}</p>

              {editingUid === s.uid ? (
                <>
                  <label style={{ ...selectLabel, marginTop: 12 }}>Assigned Courts</label>
                  <div style={courtRow}>
                    {COURTS.map(c => (
                      <button
                        key={c.key}
                        type="button"
                        className="am-btn"
                        onClick={() => toggleEditCourt(c.key)}
                        style={editForm.assignedCourts.includes(c.key) ? courtChipActive : courtChip}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, color: colors.charcoal, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editForm.canDelete}
                      onChange={(e) => setEditForm(f => ({ ...f, canDelete: e.target.checked }))}
                    />
                    Allow deleting &amp; archiving
                  </label>

                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <Button
                      onClick={() => saveEdit(s.uid)}
                      disabled={busyUid === s.uid}
                      style={{ flex: 1 }}
                    >
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEditingUid(null)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
                    {(s.assignedCourts || []).map(c => (
                      <Badge key={c} tone="accent">{c}</Badge>
                    ))}
                    <Badge tone={s.disabled ? "danger" : "success"}>
                      {s.disabled ? "Disabled" : "Active"}
                    </Badge>
                    {s.canDelete && <Badge tone="dark">Can delete</Badge>}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <Button
                      variant="secondary"
                      onClick={() => startEditing(s)}
                      style={{ flex: 1 }}
                    >
                      Edit Access
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleToggleDisabled(s)}
                      disabled={busyUid === s.uid}
                      style={{ flex: 1 }}
                    >
                      {s.disabled ? "Enable" : "Disable"}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleDelete(s)}
                      disabled={busyUid === s.uid}
                      style={{ flex: 1 }}
                    >
                      Remove
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
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

const groupTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 14px",
};

const formRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "0 14px",
};

const selectLabel = {
  display: "block",
  fontFamily: font.body,
  fontSize: "12px",
  fontWeight: 600,
  color: colors.slate,
  marginBottom: "8px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const courtRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const courtChip = {
  padding: "8px 16px",
  borderRadius: radius.sm,
  border: `1px solid ${colors.hairline}`,
  background: colors.surface,
  color: colors.charcoal,
  fontFamily: font.body,
  fontSize: "13px",
  fontWeight: 600,
};

const courtChipActive = {
  ...courtChip,
  background: colors.ink,
  color: colors.white,
  border: `1px solid ${colors.ink}`,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const secName = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 4px",
};

const meta = {
  fontSize: 13,
  color: colors.slate,
  margin: 0,
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default ManageSecretaries;