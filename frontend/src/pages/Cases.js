// frontend/src/pages/Cases.js
import { useEffect, useMemo, useState } from "react";
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
import Badge, { statusTone } from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import MoreMenu from "../components/ui/MoreMenu";
import Loading from "../components/ui/Loading";
import { confirmDialog, toast } from "../components/Notifications";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";
import { cascadeDeleteCase, cascadeDeleteArchivedCase } from "../services/cascadeDelete";
import { CMS_URL } from "../services/cms";
import { todayKey, formatDate } from "../utils/dates";
import EmptyState from "../components/ui/EmptyState";
import { CASE_CLASSES, classLabel, classTone, matchesClass } from "../utils/caseClass";
import VoiceWrap from "../components/ui/VoiceWrap";

function Cases() {
  const [cases, setCases] = useState({ active: [], archived: [] });
  const [clients, setClients] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [secretaries, setSecretaries] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [classFilter, setClassFilter] = useState("All");

  const { ownerId: userId, user, isLawyer, canDelete } = useAuthRole();
  const court = localStorage.getItem("court");

  const navigate = useNavigate();

  const [form, setForm] = useState({
    client_id: "",
    title: "",
    description: "",
    case_class: "",
    assignedTo: ""
  });

  // ================= FETCH =================
  const fetchData = async () => {
    if (!userId || !court) return;

    try {
      const scopedOpts = { ownerId: userId, isLawyer, myUid: user?.uid, extraWhere: [where("court_type", "==", court)] };

      const [active, archived, hearingList] = await Promise.all([
        fetchScoped("cases", scopedOpts),
        fetchScoped("archive", scopedOpts),
        // hearings are only used to show "next hearing" — never let them break the page
        fetchScoped("hearings", scopedOpts).catch(() => []),
      ]);

      setCases({ active, archived });
      setHearings(hearingList);

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
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, court, isLawyer]);

  // ================= DERIVED =================
  const clientNameOf = (c) => clients.find(x => x.id === c.client_id)?.name || "";
  const assigneeNameOf = (c) => secretaries.find(s => s.uid === c.assignedTo)?.name || "";

  // earliest hearing today-or-later, per case
  const nextHearingByCase = useMemo(() => {
    const today = todayKey();
    const map = {};
    hearings.forEach(h => {
      const d = String(h.date || "").slice(0, 10);
      if (!d || d < today) return;
      if (!map[h.case_id] || d < map[h.case_id]) map[h.case_id] = d;
    });
    return map;
  }, [hearings]);

  const matchesSearch = (c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
        return [c.title, c.description, c.status, classLabel(c.case_class), clientNameOf(c), assigneeNameOf(c)]
      .some(v => String(v || "").toLowerCase().includes(q));
  };

    const shownActive = cases.active.filter(c =>
    matchesSearch(c) && matchesClass(c, classFilter) && (statusFilter === "All" || c.status === statusFilter)
  );
  const shownArchived = cases.archived.filter(c => matchesSearch(c) && matchesClass(c, classFilter));
  const filtering = search.trim() !== "" || statusFilter !== "All" || classFilter !== "All";

  // ================= ADD =================
  const handleSubmit = async () => {
        if (!form.title || !form.client_id || !form.case_class || !userId) {
      alert("Please select the client, choose Civil or Criminal, and fill all fields");
      return;
    }

    await addDoc(collection(db, "cases"), {
      client_id: form.client_id,
      title: form.title,
      description: form.description,
      userId,
      court_type: court,
      case_class: form.case_class,
      status: "Open",
      createdAt: Date.now(),
      createdBy: user.uid,
      assignedTo: isLawyer && form.assignedTo ? form.assignedTo : null
    });

        setForm({ client_id: "", title: "", description: "", case_class: "", assignedTo: "" });
    setShowAddModal(false);
    fetchData();
    toast("Case created", "success");
  };

  // ================= REASSIGN (lawyer only) =================
  const reassignCase = async (caseItem, newAssignee) => {
    await updateDoc(doc(db, "cases", caseItem.id), {
      assignedTo: newAssignee || null
    });
    fetchData();
    toast("Assignment updated", "success");
  };


    // ================= CIVIL / CRIMINAL =================
  const setCaseClass = async (caseItem, value) => {
    if (!value) return;
    try {
      await updateDoc(doc(db, "cases", caseItem.id), { case_class: value });
      fetchData();
      toast(`Marked as ${classLabel(value)}`, "success");
    } catch (err) {
      console.error(err);
      toast("Couldn't update the case type. Please try again.", "error");
    }
  };

  // ================= DELETE (cascades to hearings, notes, files, billing) =================
  const handleDelete = async (caseItem) => {
    const ok = await confirmDialog(
      "Delete this case? This also permanently deletes its hearings, notes, files, and billing records.",
            { danger: true }
    );
    if (!ok) return;

    try {
      await cascadeDeleteCase({ caseId: caseItem.id, ownerId: userId });
      toast("Case deleted", "success");
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
      toast("Case moved to Archive", "success");
    } catch (err) {
      console.error("Archive failed:", err);
      toast("Couldn't archive this case. Please try again.", "error");
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
      toast("Case restored", "success");
    } catch (err) {
      console.error("Restore failed:", err);
      toast("Couldn't restore this case. Please try again.", "error");
    }
  };

  // ================= PERMANENTLY DELETE ARCHIVED CASE =================
  const permanentlyDeleteArchived = async (caseItem) => {
    const ok = await confirmDialog(
      "Permanently delete this archived case and all its hearings, notes, files, and billing records? This cannot be undone.",
      { danger: true }
    );
    if (!ok) return;

    try {
      await cascadeDeleteArchivedCase({
        archiveDocId: caseItem.id,
        originalCaseId: caseItem.originalCaseId,
        ownerId: userId
      });
      toast("Case deleted", "success");
    } catch (err) {
      console.error(err);
      alert("Something went wrong deleting this case. Please try again.");
    }
    fetchData();
  };

  const openCase = (id) => navigate(`/cases/${id}`);

  return (
    <PageContainer
      eyebrow={court?.toUpperCase()}
      title="Cases"
      subtitle="Manage active case files and view your archive"
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={() => setShowAddModal(true)}>+ Add Case</Button>
          <a href={CMS_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <Button variant="secondary">Open CMS ↗</Button>
          </a>
        </div>
      }
    >
      {/* ADD CASE MODAL */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Case"
      >
        {clients.length === 0 && (
          <p style={modalHint}>
            You don't have any clients on this court yet — add a client from the Clients page first,
            then come back to create a case for them.
          </p>
        )}

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
                    voice
          placeholder="e.g. Ahmed vs. Metro Properties"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />


        <label style={selectLabel}>Case Type</label>
        <select
          className="am-input"
          style={selectStyle}
          value={form.case_class}
          onChange={(e) => setForm({ ...form, case_class: e.target.value })}
        >
          <option value="">Select Civil or Criminal</option>
          {CASE_CLASSES.map(k => (
            <option key={k.key} value={k.key}>{k.label}</option>
          ))}
        </select>

        <label style={selectLabel}>Description</label>
                <VoiceWrap>
          <textarea
            className="am-input"
            placeholder="Brief summary of the case…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={textareaStyle}
          />
        </VoiceWrap>

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

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Button onClick={handleSubmit} style={{ flex: 1 }}>Add Case</Button>
          <Button variant="secondary" onClick={() => setShowAddModal(false)} style={{ flex: 1 }}>
            Cancel
          </Button>
        </div>
      </Modal>

      {/* SEARCH + FILTER */}
      <div style={filterRow}>
        <div style={{ flex: "1 1 240px" }}>
          <Input
            type="search"
                        voice
            placeholder="Search by title, client, status or assignee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="am-input"
          aria-label="Filter by status"
          style={{ ...selectStyle, width: "auto", minWidth: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All statuses</option>
          <option>Open</option>
          <option>In Progress</option>
          <option>On Hold</option>
        </select>
                <select
          className="am-input"
          aria-label="Filter by case type"
          style={{ ...selectStyle, width: "auto", minWidth: 150 }}
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="All">Civil &amp; Criminal</option>
          <option value="civil">Civil</option>
          <option value="criminal">Criminal</option>
          <option value="unclassified">Unclassified</option>
        </select>
      </div>

      {/* ACTIVE */}
      <h3 style={groupTitle}>Active Cases</h3>

      <div style={grid}>
        {!loaded ? (
          <Loading />
        ) : cases.active.length === 0 ? (
                    <EmptyState
            icon="📁"
            title="No cases yet"
            text="Create your first case to track hearings, notes and billing in one place."
            action="+ Add Case"
            onAction={() => setShowAddModal(true)}
          />
        ) : shownActive.length === 0 ? (
          <p style={emptyText}>No cases match your search or filter.</p>
        ) : (
          shownActive.map(c => {
            const next = nextHearingByCase[c.id];
            const client = clientNameOf(c);
            return (
              <Card key={c.id} hoverable style={caseCard}>
                <div style={cardTop}>
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => openCase(c.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") openCase(c.id); }}
                    style={{ cursor: "pointer", flex: 1, minWidth: 0 }}
                  >
                    <h3 style={caseTitle}>{c.title}</h3>
                    {client && <div style={cardMeta}>Client: {client}</div>}
                    <div style={badgeRow}>
                      <Badge tone={classTone(c.case_class)}>{classLabel(c.case_class)}</Badge>
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                      {c.assignedTo && (
                        <Badge tone="dark">
                          {assigneeNameOf(c) || "Assigned"}
                        </Badge>
                      )}
                    </div>
                    <div style={cardMeta}>
                      {next ? `Next hearing: ${formatDate(next)}` : "No upcoming hearing"}
                    </div>
                  </div>

                  {canDelete && (
                    <MoreMenu
                      items={[
                        { label: "Archive case", onClick: () => archiveCase(c) },
                        { label: "Delete case…", danger: true, onClick: () => handleDelete(c) },
                      ]}
                    />
                  )}
                </div>
                {!c.case_class && (
                  <select
                    className="am-input"
                    aria-label="Set case type"
                    style={{ ...selectStyle, marginTop: 10, marginBottom: 0, fontSize: 12, padding: "7px 10px" }}
                    value=""
                    onChange={(e) => setCaseClass(c, e.target.value)}
                  >
                    <option value="">Set as Civil or Criminal…</option>
                    {CASE_CLASSES.map(k => (
                      <option key={k.key} value={k.key}>{k.label}</option>
                    ))}
                  </select>
                )}

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
              </Card>
            );
          })
        )}
      </div>

      {/* ARCHIVED */}
      <h3 style={groupTitle}>Archived Cases</h3>

      <div style={grid}>
        {!loaded ? (
          <Loading />
        ) : cases.archived.length === 0 ? (
          <p style={emptyText}>No archived cases</p>
        ) : shownArchived.length === 0 ? (
          <p style={emptyText}>{filtering ? "No archived cases match your search." : "No archived cases"}</p>
        ) : (
          shownArchived.map(c => (
            <Card key={c.id} style={{ ...caseCard, opacity: 0.8 }}>
              <div style={cardTop}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={caseTitle}>{c.title}</h3>
                  {clientNameOf(c) && <div style={cardMeta}>Client: {clientNameOf(c)}</div>}
                  <div style={badgeRow}>
                    <Badge tone={classTone(c.case_class)}>{classLabel(c.case_class)}</Badge>
                    <Badge tone="neutral">Archived</Badge>
                  </div>
                </div>

                {canDelete && (
                  <MoreMenu
                    items={[
                      { label: "Delete permanently…", danger: true, onClick: () => permanentlyDeleteArchived(c) },
                    ]}
                  />
                )}
              </div>

              {canDelete && (
                <div style={cardActions}>
                  <Button variant="dark" onClick={() => restoreCase(c)} style={{ flex: 1 }}>
                    Restore
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

const groupTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "8px 0 14px",
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

const modalHint = {
  fontSize: "13px",
  color: colors.slate,
  background: colors.paper,
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  padding: "10px 12px",
  marginBottom: 16,
  lineHeight: 1.45,
};

const filterRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
  marginBottom: 20,
};

const caseCard = {
  boxShadow: shadow.sm,
};

const cardTop = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
};

const caseTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 6px",
  overflowWrap: "anywhere",
};

const cardMeta = {
  fontSize: "12px",
  color: colors.slate,
  marginTop: 6,
};

const badgeRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};

const cardActions = {
  display: "flex",
  gap: 8,
  marginTop: 12,
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default Cases;