// frontend/src/pages/Cases.js
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from "firebase/firestore";
import { colors, font, radius, shadow } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { CMS_URL } from "../services/cms";
import Badge from "../components/ui/Badge";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";
import { cascadeDeleteCase, cascadeDeleteArchivedCase } from "../services/cascadeDelete";

function Cases() {
  const [cases, setCases] = useState({ active: [], archived: [] });
  const [clients, setClients] = useState([]);
  const [secretaries, setSecretaries] = useState([]);

  const { ownerId: userId, user, isLawyer, canDelete } = useAuthRole();
  const court = localStorage.getItem("court");

  const navigate = useNavigate();

  const [form, setForm] = useState({
    client_id: "",
    title: "",
    description: "",
    assignedTo: ""
  });

  // ================= FETCH =================
  const fetchData = async () => {
    if (!userId || !court) return;

    try {
      const scopedOpts = { ownerId: userId, isLawyer, myUid: user?.uid, extraWhere: [where("court_type", "==", court)] };

      const [active, archived] = await Promise.all([
        fetchScoped("cases", scopedOpts),
        fetchScoped("archive", scopedOpts),
      ]);

      setCases({ active, archived });

      const clientQ = collection(db, "users", userId, "clients");
      const clientSnap = await getDocs(clientQ);

      const filteredClients = clientSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.court_type === court);

      setClients(filteredClients);

      // Secretaries assigned to this court — for the "Assign to" pickers.
      // Lawyers can read any secretary profile where lawyerId == their own uid.
      if (isLawyer) {
        const secQ = query(collection(db, "users"), where("lawyerId", "==", userId));
        const secSnap = await getDocs(secQ);
        setSecretaries(
          secSnap.docs
            .map(d => ({ uid: d.id, ...d.data() }))
            .filter(s => !s.disabled && (s.assignedCourts || []).includes(court))
        );
      }

    } catch (err) {
      console.error("FETCH ERROR:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId, court, isLawyer]);

  // ================= ADD =================
  const handleSubmit = async () => {
    if (!form.title || !form.client_id || !userId) {
      alert("Please select client and fill all fields");
      return;
    }

    await addDoc(collection(db, "cases"), {
      client_id: form.client_id,
      title: form.title,
      description: form.description,
      userId,
      court_type: court,
      status: "Open",
      createdAt: Date.now(),
      createdBy: user.uid,
      assignedTo: isLawyer && form.assignedTo ? form.assignedTo : null
    });

    setForm({ client_id: "", title: "", description: "", assignedTo: "" });
    fetchData();
  };

  // ================= REASSIGN (lawyer only) =================
  const reassignCase = async (caseItem, newAssignee) => {
    await updateDoc(doc(db, "cases", caseItem.id), {
      assignedTo: newAssignee || null
    });
    fetchData();
  };

  // ================= DELETE (cascades to hearings, notes, files) =================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this case? This also permanently deletes its hearings, notes, and files.")) return;

    try {
      await cascadeDeleteCase({ caseId: id, ownerId: userId });
    } catch (err) {
      console.error(err);
      alert("Something went wrong deleting this case. Please try again.");
    }
    fetchData();
  };

  // ================= ARCHIVE =================
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
    }
  };

  // ================= RESTORE (preserves original case ID so hearings/notes/files stay linked) =================
  const restoreCase = async (caseItem) => {
    try {
      const { id, originalCaseId, archivedAt, ...cleanData } = caseItem;

      const restoredId = originalCaseId || id;

      await setDoc(doc(db, "cases", restoredId), {
        ...cleanData,
        status: "Open",
        restoredAt: Date.now()
      });

      await deleteDoc(doc(db, "archive", id));

      fetchData();
    } catch (err) {
      console.error("Restore failed:", err);
    }
  };

  // ================= PERMANENTLY DELETE ARCHIVED CASE =================
  const permanentlyDeleteArchived = async (caseItem) => {
    if (!window.confirm("Permanently delete this archived case and all its hearings, notes, and files? This cannot be undone.")) return;

    try {
      await cascadeDeleteArchivedCase({
        archiveDocId: caseItem.id,
        originalCaseId: caseItem.originalCaseId,
        ownerId: userId
      });
    } catch (err) {
      console.error(err);
      alert("Something went wrong deleting this case. Please try again.");
    }
    fetchData();
  };

  return (
    <PageContainer
      eyebrow={court?.toUpperCase()}
      title="Cases"
      subtitle="Manage active case files and view your archive"
      action={
        <a href={CMS_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <Button variant="secondary">Open CMS ↗</Button>
        </a>
      }
    >
      {/* FORM */}
      <Card style={{ marginBottom: 28 }}>
        <h3 style={sectionTitle}>Add New Case</h3>

        <label style={selectLabel}>Client</label>
        <select
          className="am-input"
          style={selectStyle}
          value={form.client_id}
          onChange={(e) => setForm({ ...form, client_id: e.target.value })}
        >
          <option value="">Select client</option>

          {clients.length === 0 ? (
            <option disabled>No clients found</option>
          ) : (
            clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </select>

        <Input
          label="Case Title"
          placeholder="e.g. Ahmed vs. Metro Properties"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <label style={selectLabel}>Description</label>
        <textarea
          className="am-input"
          placeholder="Brief summary of the case…"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={textareaStyle}
        />

        {isLawyer && (
          <>
            <label style={selectLabel}>Assign To (optional)</label>
            <select
              className="am-input"
              style={selectStyle}
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            >
              <option value="">Unassigned — visible to all secretaries on this court</option>
              {secretaries.map(s => (
                <option key={s.uid} value={s.uid}>{s.name}</option>
              ))}
            </select>
          </>
        )}

        <Button onClick={handleSubmit} full>Add Case</Button>
      </Card>

      {/* ACTIVE */}
      <h3 style={groupTitle}>Active Cases</h3>

      <div style={grid}>
        {cases.active.length === 0 ? (
          <p style={emptyText}>No active cases</p>
        ) : (
          cases.active.map(c => (
            <Card key={c.id} hoverable style={caseCard}>
              <div onClick={() => navigate(`/cases/${c.id}`)} style={{ cursor: "pointer" }}>
                <h3 style={caseTitle}>{c.title}</h3>
                <Badge tone="accent">{c.status}</Badge>
                {c.assignedTo && (
                  <Badge tone="dark" style={{ marginLeft: 6 }}>
                    {secretaries.find(s => s.uid === c.assignedTo)?.name || "Assigned"}
                  </Badge>
                )}
              </div>

              {isLawyer && (
                <select
                  className="am-input"
                  style={{ ...selectStyle, marginTop: 10, marginBottom: 0, fontSize: 12, padding: "7px 10px" }}
                  value={c.assignedTo || ""}
                  onChange={(e) => reassignCase(c, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {secretaries.map(s => (
                    <option key={s.uid} value={s.uid}>{s.name}</option>
                  ))}
                </select>
              )}

              {canDelete && (
                <div style={cardActions}>
                  <Button variant="secondary" onClick={() => archiveCase(c)} style={{ flex: 1 }}>
                    Archive
                  </Button>
                  <Button variant="danger" onClick={() => handleDelete(c.id)} style={{ flex: 1 }}>
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* ARCHIVED */}
      <h3 style={groupTitle}>Archived Cases</h3>

      <div style={grid}>
        {cases.archived.length === 0 ? (
          <p style={emptyText}>No archived cases</p>
        ) : (
          cases.archived.map(c => (
            <Card key={c.id} style={{ ...caseCard, opacity: 0.75 }}>
              <h3 style={caseTitle}>{c.title}</h3>
              <Badge tone="neutral">Archived</Badge>

              {canDelete && (
                <div style={cardActions}>
                  <Button
                    variant="dark"
                    onClick={() => restoreCase(c)}
                    style={{ flex: 1 }}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => permanentlyDeleteArchived(c)}
                    style={{ flex: 1 }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}

/* ================= STYLES ================= */

const sectionTitle = {
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
  margin: "28px 0 14px",
};

const selectLabel = {
  display: "block",
  fontFamily: font.body,
  fontSize: "12px",
  fontWeight: 600,
  color: colors.slate,
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const selectStyle = {
  boxSizing: "border-box",
  width: "100%",
  padding: "11px 13px",
  marginBottom: "14px",
  fontFamily: font.body,
  fontSize: "14px",
  color: colors.ink,
  background: colors.surface,
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  outline: "none",
};

const textareaStyle = {
  ...selectStyle,
  minHeight: "80px",
  resize: "vertical",
  fontFamily: font.body,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const caseCard = {
  boxShadow: shadow.sm,
};

const caseTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 8px",
};

const cardActions = {
  display: "flex",
  gap: 8,
  marginTop: 14,
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default Cases;