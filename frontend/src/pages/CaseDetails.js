// frontend/src/pages/CaseDetails.js
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";

import { db, storage, auth } from "../firebase";
import { colors, font, radius } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useAuthRole } from "../context/AuthRoleContext";
import { CMS_URL } from "../services/cms";
import { cascadeDeleteArchivedCase } from "../services/cascadeDelete";

const TABS = ["view", "details", "diary", "hearings", "files"];

function CaseDetails() {
  const { id } = useParams();
  const caseId = id;
  const navigate = useNavigate();

  const { ownerId: userId, user: currentUser, isLawyer, canDelete } = useAuthRole();
  const courtType = localStorage.getItem("court");

  const [caseData, setCaseData] = useState(null);
  const [clientName, setClientName] = useState("");
  const [hearings, setHearings] = useState([]);
  const [files, setFiles] = useState([]);
  const [secretaries, setSecretaries] = useState([]);

  // ================= ARCHIVED-CASE FALLBACK =================
  // If a case has been archived, its doc under "cases" is gone — this page
  // needs to fall back to the "archive" collection instead of erroring.
  const [archivedDoc, setArchivedDoc] = useState(null);
  const [lookupDone, setLookupDone] = useState(false);

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [tab, setTab] = useState("view");

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: ""
  });

  const [diaryNotes, setDiaryNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null); // null = list view, "new" = creating, or a note id
  const [noteForm, setNoteForm] = useState({ title: "", body: "" });

  const [detailNotes, setDetailNotes] = useState([]);
  const [activeDetailNoteId, setActiveDetailNoteId] = useState(null);
  const [detailNoteForm, setDetailNoteForm] = useState({ title: "", body: "" });

  const [hearingForm, setHearingForm] = useState({
    date: "",
    event: "",
    notes: ""
  });

  /* ================= CLIENT NAME ================= */
  const fetchClientName = async (uid, clientId) => {
    if (!clientId) {
      setClientName("");
      return;
    }

    const snap = await getDoc(doc(db, "users", uid, "clients", clientId));
    setClientName(snap.exists() ? snap.data().name || "" : "");
  };

  /* ================= CASE (with archive fallback) ================= */
  const fetchCase = async (uid) => {
    setLookupDone(false);

    try {
      const snap = await getDoc(doc(db, "cases", caseId));

      if (snap.exists()) {
        const data = snap.data();
        if (data.userId && data.userId !== uid) {
          setCaseData(null);
          setArchivedDoc(null);
          setLookupDone(true);
          return;
        }

        setCaseData({ id: snap.id, ...data });
        setArchivedDoc(null);
        fetchClientName(uid, data.client_id);

        setForm({
          title: data.title || "",
          description: data.description || "",
          status: data.status || ""
        });

        setLookupDone(true);
        return;
      }
    } catch (err) {
      // A "not found" doc can surface as a permission error from the
      // security rules (resource is null when the doc doesn't exist) —
      // that's expected here, so just fall through to the archive check.
      console.warn("Live case lookup failed, checking archive instead:", err);
    }

    // Not found (or wasn't readable) in the live collection — check archive.
    try {
      const q = query(
        collection(db, "archive"),
        where("originalCaseId", "==", caseId),
        where("userId", "==", uid)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        setArchivedDoc({ id: d.id, ...data });
        setCaseData(null);
        fetchClientName(uid, data.client_id);
      } else {
        setArchivedDoc(null);
        setCaseData(null);
      }
    } catch (err) {
      console.error("Archive lookup failed:", err);
      setArchivedDoc(null);
      setCaseData(null);
    }

    setLookupDone(true);
  };

  /* ================= RESTORE / PERMANENT DELETE (archived view) ================= */
  const restoreThisCase = async () => {
    if (!archivedDoc || !userId) return;

    const { id: archiveDocId, originalCaseId, archivedAt, ...cleanData } = archivedDoc;
    const restoredId = originalCaseId || caseId;

    await setDoc(doc(db, "cases", restoredId), {
      ...cleanData,
      status: "Open",
      restoredAt: Date.now()
    });

    await deleteDoc(doc(db, "archive", archiveDocId));

    alert("Case restored");
    fetchCase(userId);
  };

  const permanentlyDeleteThisCase = async () => {
    if (!archivedDoc || !userId) return;

    if (!window.confirm("Permanently delete this archived case and all its hearings, notes, and files? This cannot be undone.")) return;

    try {
      await cascadeDeleteArchivedCase({
        archiveDocId: archivedDoc.id,
        originalCaseId: archivedDoc.originalCaseId,
        ownerId: userId
      });
      navigate("/archive");
    } catch (err) {
      console.error(err);
      alert("Something went wrong deleting this case. Please try again.");
    }
  };

  /* ================= HEARINGS ================= */
  const fetchHearings = async (uid) => {
    const q = query(
      collection(db, "hearings"),
      where("case_id", "==", caseId),
      where("userId", "==", uid),
      where("court_type", "==", courtType)
    );

    const snap = await getDocs(q);
    setHearings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  /* ================= FILES ================= */
  const fetchFiles = async (uid) => {
    const q = query(
      collection(db, "files"),
      where("case_id", "==", caseId),
      where("userId", "==", uid),
      where("court_type", "==", courtType)
    );

    const snap = await getDocs(q);
    setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  /* ================= DIARY NOTES ================= */
  const fetchDiaryNotes = async (uid) => {
    const q = query(
      collection(db, "diaryNotes"),
      where("case_id", "==", caseId),
      where("userId", "==", uid),
      where("court_type", "==", courtType)
    );

    const snap = await getDocs(q);

    const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    setDiaryNotes(notes);
  };

  /* ================= DETAILS NOTES ================= */
  const fetchDetailNotes = async (uid) => {
    const q = query(
      collection(db, "detailsNotes"),
      where("case_id", "==", caseId),
      where("userId", "==", uid),
      where("court_type", "==", courtType)
    );

    const snap = await getDocs(q);

    const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    setDetailNotes(notes);
  };

  /* ================= SECRETARIES (for Assign To picker, lawyer only) ================= */
  const fetchSecretaries = async (uid) => {
    if (!isLawyer) return;

    const q = query(collection(db, "users"), where("lawyerId", "==", uid));
    const snap = await getDocs(q);

    setSecretaries(
      snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(s => !s.disabled && (s.assignedCourts || []).includes(courtType))
    );
  };

  /* ================= LOAD ================= */
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      await fetchCase(userId);
      await fetchHearings(userId);
      await fetchFiles(userId);
      await fetchDiaryNotes(userId);
      await fetchDetailNotes(userId);
      await fetchSecretaries(userId);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, userId, isLawyer]);

  /* ================= UPDATE CASE (ARCHIVE ON CLOSE) ================= */
  const updateCase = async () => {
    if (form.status === "Closed" && !canDelete) {
      alert("You don't have permission to close and archive a case.");
      return;
    }

    try {
      const caseRef = doc(db, "cases", caseId);

      if (form.status === "Closed") {
        await addDoc(collection(db, "archive"), {
          ...form,
          originalCaseId: caseId,
          userId,
          court_type: courtType,
          status: "Closed",
          archivedAt: Date.now(),
          assignedTo: caseData?.assignedTo || null
        });

        await deleteDoc(caseRef);

        alert("Case moved to Archive");
        fetchCase(userId);
        return;
      }

      await updateDoc(caseRef, form);
      fetchCase(userId);

    } catch (err) {
      console.error(err);
      alert("Failed to update case");
    }
  };

  /* ================= REASSIGN (lawyer only) ================= */
  const reassignCase = async (newAssignee) => {
    await updateDoc(doc(db, "cases", caseId), {
      assignedTo: newAssignee || null
    });
    fetchCase(userId);
  };

  /* ================= ADD HEARING ================= */
  const addHearing = async () => {
    if (!hearingForm.date || !hearingForm.event) return;

    await addDoc(collection(db, "hearings"), {
      case_id: caseId,
      userId,
      court_type: courtType,
      createdBy: currentUser.uid,
      assignedTo: caseData?.assignedTo || null,
      ...hearingForm
    });

    setHearingForm({ date: "", event: "", notes: "" });
    fetchHearings(userId);
  };

  /* ================= DIARY NOTE HANDLERS ================= */
  const openNote = (note) => {
    setActiveNoteId(note.id);
    setNoteForm({ title: note.title || "", body: note.body || "" });
  };

  const startNewNote = () => {
    setActiveNoteId("new");
    setNoteForm({ title: "", body: "" });
  };

  const closeNoteEditor = () => {
    setActiveNoteId(null);
    setNoteForm({ title: "", body: "" });
  };

  const saveNote = async () => {
    if (!noteForm.title.trim()) {
      alert("Give the note a header before saving");
      return;
    }

    if (activeNoteId === "new") {
      await addDoc(collection(db, "diaryNotes"), {
        case_id: caseId,
        userId,
        court_type: courtType,
        createdBy: currentUser.uid,
        assignedTo: caseData?.assignedTo || null,
        title: noteForm.title,
        body: noteForm.body,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      await updateDoc(doc(db, "diaryNotes", activeNoteId), {
        title: noteForm.title,
        body: noteForm.body,
        updatedAt: Date.now()
      });
    }

    closeNoteEditor();
    fetchDiaryNotes(userId);
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm("Delete this note?")) return;

    await deleteDoc(doc(db, "diaryNotes", noteId));
    closeNoteEditor();
    fetchDiaryNotes(userId);
  };

  /* ================= DETAIL NOTE HANDLERS ================= */
  const openDetailNote = (note) => {
    setActiveDetailNoteId(note.id);
    setDetailNoteForm({ title: note.title || "", body: note.body || "" });
  };

  const startNewDetailNote = () => {
    setActiveDetailNoteId("new");
    setDetailNoteForm({ title: "", body: "" });
  };

  const closeDetailNoteEditor = () => {
    setActiveDetailNoteId(null);
    setDetailNoteForm({ title: "", body: "" });
  };

  const saveDetailNote = async () => {
    if (!detailNoteForm.title.trim()) {
      alert("Give the note a header before saving");
      return;
    }

    if (activeDetailNoteId === "new") {
      await addDoc(collection(db, "detailsNotes"), {
        case_id: caseId,
        userId,
        court_type: courtType,
        createdBy: currentUser.uid,
        assignedTo: caseData?.assignedTo || null,
        title: detailNoteForm.title,
        body: detailNoteForm.body,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      await updateDoc(doc(db, "detailsNotes", activeDetailNoteId), {
        title: detailNoteForm.title,
        body: detailNoteForm.body,
        updatedAt: Date.now()
      });
    }

    closeDetailNoteEditor();
    fetchDetailNotes(userId);
  };

  const deleteDetailNote = async (noteId) => {
    if (!window.confirm("Delete this note?")) return;

    await deleteDoc(doc(db, "detailsNotes", noteId));
    closeDetailNoteEditor();
    fetchDetailNotes(userId);
  };

  /* ================= FILE UPLOAD ================= */
  const uploadFile = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !file) return;

      setUploading(true);

      const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `cases/${userId}/${caseId}/${Date.now()}_${cleanName}`;

      const fileRef = ref(storage, path);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      await addDoc(collection(db, "files"), {
        case_id: caseId,
        userId,
        court_type: courtType,
        createdBy: currentUser.uid,
        assignedTo: caseData?.assignedTo || null,
        name: file.name,
        storagePath: path,
        url,
        createdAt: Date.now()
      });

      setFile(null);
      await fetchFiles(userId);

    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* ================= DELETE FILE (gated by canDelete — matches Firestore rules) ================= */
  const deleteFile = async (f) => {
    try {
      if (f.storagePath) {
        await deleteObject(ref(storage, f.storagePath));
      }

      await deleteDoc(doc(db, "files", f.id));

      fetchFiles(userId);

    } catch (err) {
      console.error(err);
    }
  };

  const sortedHearings = [...hearings].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  /* ================= RENDER STATES ================= */

  if (!lookupDone) {
    return <PageContainer title="Case Dashboard"><p style={emptyText}>Loading…</p></PageContainer>;
  }

  // ARCHIVED — read-only summary view with Restore / Permanently Delete
  if (archivedDoc) {
    return (
      <PageContainer
        eyebrow={courtType?.toUpperCase()}
        title={archivedDoc.title || "Archived Case"}
        subtitle={clientName ? `Client: ${clientName}` : undefined}
        action={
          <a href={CMS_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <Button variant="secondary">Open in CMS ↗</Button>
          </a>
        }
      >
        <button onClick={() => navigate("/archive")} className="am-btn" style={backBtn}>
          ← Back to Archive
        </button>

        <Card style={{ maxWidth: 520 }}>
          <Badge tone="neutral">Archived</Badge>

          <h3 style={overviewTitle}>{archivedDoc.title}</h3>

          <div style={overviewRow}>
            <span style={overviewLabel}>Status</span>
            <span style={overviewValue}>{archivedDoc.status || "Closed"}</span>
          </div>

          <div style={overviewRow}>
            <span style={overviewLabel}>Court</span>
            <span style={overviewValue}>{(archivedDoc.court_type || "").toUpperCase()}</span>
          </div>

          <div style={overviewRow}>
            <span style={overviewLabel}>Client</span>
            <span style={overviewValue}>{clientName || "—"}</span>
          </div>

          <div style={overviewRow}>
            <span style={overviewLabel}>Archived</span>
            <span style={overviewValue}>
              {archivedDoc.archivedAt ? new Date(archivedDoc.archivedAt).toLocaleDateString() : "—"}
            </span>
          </div>

          {archivedDoc.description && (
            <div style={{ ...overviewRow, flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <span style={overviewLabel}>Description</span>
              <span style={{ ...overviewValue, fontWeight: 400 }}>{archivedDoc.description}</span>
            </div>
          )}

          {canDelete && (
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <Button onClick={restoreThisCase} style={{ flex: 1 }}>
                Restore
              </Button>
              <Button variant="danger" onClick={permanentlyDeleteThisCase} style={{ flex: 1 }}>
                Delete Permanently
              </Button>
            </div>
          )}
        </Card>
      </PageContainer>
    );
  }

  // NOT FOUND ANYWHERE
  if (!caseData) {
    return (
      <PageContainer title="Case Dashboard">
        <p style={emptyText}>Case not found or not accessible.</p>
      </PageContainer>
    );
  }

  // ACTIVE — normal full tabbed view
  return (
    <PageContainer
      eyebrow={courtType?.toUpperCase()}
      title={caseData.title || "Case Dashboard"}
      subtitle={clientName ? `Client: ${clientName}` : undefined}
      action={
        <a href={CMS_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <Button variant="secondary">Open in CMS ↗</Button>
        </a>
      }
    >

      <div style={tabs}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="am-btn"
            style={tab === t ? activeTab : tabBtn}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <Card>

        {/* VIEW */}
        {tab === "view" && (
          <div style={section}>
            <Input
              label="Case Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />

            <label style={selectLabel}>Status</label>
            <select
              className="am-input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={selectStyle}
            >
              <option value="">Select status</option>
              <option>Open</option>
              <option>In Progress</option>
              <option>On Hold</option>
              {canDelete && <option>Closed</option>}
            </select>

            <label style={selectLabel}>Assigned To</label>
            {isLawyer ? (
              <select
                className="am-input"
                value={caseData.assignedTo || ""}
                onChange={(e) => reassignCase(e.target.value)}
                style={selectStyle}
              >
                <option value="">Unassigned — visible to all secretaries on this court</option>
                {secretaries.map(s => (
                  <option key={s.uid} value={s.uid}>{s.name}</option>
                ))}
              </select>
            ) : (
              <div style={{ marginBottom: 14 }}>
                {caseData.assignedTo ? (
                  <Badge tone="dark">Assigned to you</Badge>
                ) : (
                  <Badge tone="neutral">Unassigned</Badge>
                )}
              </div>
            )}

            <Button onClick={updateCase} style={{ alignSelf: "flex-start" }}>
              Save Changes
            </Button>
          </div>
        )}

        {/* DETAILS */}
        {tab === "details" && (
          activeDetailNoteId === null ? (
            <div style={section}>
              <Button onClick={startNewDetailNote} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
                + New Note
              </Button>

              {detailNotes.length === 0 ? (
                <p style={emptyText}>No notes yet</p>
              ) : (
                detailNotes.map(n => (
                  <div
                    key={n.id}
                    className="am-card-hover"
                    style={noteRow}
                    onClick={() => openDetailNote(n)}
                  >
                    <div style={noteRowTitle}>{n.title}</div>
                    <div style={noteRowPreview}>
                      {n.body ? n.body.slice(0, 80) + (n.body.length > 80 ? "…" : "") : "No details"}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={section}>
              <button onClick={closeDetailNoteEditor} className="am-btn" style={backBtn}>
                ← Back to notes
              </button>

              <Input
                label="Header"
                placeholder="e.g. Key facts"
                value={detailNoteForm.title}
                onChange={(e) => setDetailNoteForm({ ...detailNoteForm, title: e.target.value })}
              />

              <label style={selectLabel}>Details</label>
              <textarea
                className="am-input"
                placeholder="Write the details here…"
                value={detailNoteForm.body}
                onChange={(e) => setDetailNoteForm({ ...detailNoteForm, body: e.target.value })}
                style={{ ...textareaStyle, minHeight: 160 }}
                rows={8}
              />

              <div style={{ display: "flex", gap: 10 }}>
                <Button onClick={saveDetailNote} style={{ flex: 1 }}>
                  Save Note
                </Button>

                {activeDetailNoteId !== "new" && canDelete && (
                  <Button variant="danger" onClick={() => deleteDetailNote(activeDetailNoteId)} style={{ flex: 1 }}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )
        )}

        {/* DIARY */}
        {tab === "diary" && (
          activeNoteId === null ? (
            <div style={section}>
              <Button onClick={startNewNote} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
                + New Note
              </Button>

              {diaryNotes.length === 0 ? (
                <p style={emptyText}>No notes yet</p>
              ) : (
                diaryNotes.map(n => (
                  <div
                    key={n.id}
                    className="am-card-hover"
                    style={noteRow}
                    onClick={() => openNote(n)}
                  >
                    <div style={noteRowTitle}>{n.title}</div>
                    <div style={noteRowPreview}>
                      {n.body ? n.body.slice(0, 80) + (n.body.length > 80 ? "…" : "") : "No details"}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={section}>
              <button onClick={closeNoteEditor} className="am-btn" style={backBtn}>
                ← Back to notes
              </button>

              <Input
                label="Header"
                placeholder="e.g. Call with client"
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
              />

              <label style={selectLabel}>Details</label>
              <textarea
                className="am-input"
                placeholder="Write the details here…"
                value={noteForm.body}
                onChange={(e) => setNoteForm({ ...noteForm, body: e.target.value })}
                style={{ ...textareaStyle, minHeight: 160 }}
                rows={8}
              />

              <div style={{ display: "flex", gap: 10 }}>
                <Button onClick={saveNote} style={{ flex: 1 }}>
                  Save Note
                </Button>

                {activeNoteId !== "new" && canDelete && (
                  <Button variant="danger" onClick={() => deleteNote(activeNoteId)} style={{ flex: 1 }}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )
        )}

        {/* HEARINGS */}
        {tab === "hearings" && (
          <div style={section}>
            <Input
              label="Date"
              type="date"
              value={hearingForm.date}
              onChange={(e) => setHearingForm({ ...hearingForm, date: e.target.value })}
            />

            <Input
              label="Event"
              placeholder="e.g. First hearing"
              value={hearingForm.event}
              onChange={(e) => setHearingForm({ ...hearingForm, event: e.target.value })}
            />

            <label style={selectLabel}>Notes</label>
            <textarea
              className="am-input"
              placeholder="Notes"
              value={hearingForm.notes}
              onChange={(e) => setHearingForm({ ...hearingForm, notes: e.target.value })}
              style={textareaStyle}
            />

            <Button onClick={addHearing} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
              Add Hearing
            </Button>

            {sortedHearings.map(h => (
              <div key={h.id} style={item}>
                <div style={itemTitle}>{h.event}</div>
                <div style={itemMeta}>{h.date}</div>
                {h.notes && <div style={itemMeta}>{h.notes}</div>}
              </div>
            ))}
          </div>
        )}

        {/* FILES */}
        {tab === "files" && (
          <div style={section}>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ marginBottom: 6 }} />

            <Button onClick={uploadFile} disabled={uploading} style={{ alignSelf: "flex-start" }}>
              {uploading ? "Uploading…" : "Upload File"}
            </Button>

            {files.map(f => (
              <div key={f.id} style={{ ...item, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <a href={f.url} target="_blank" rel="noreferrer" style={fileLink}>
                  {f.name}
                </a>
                {canDelete && <Button variant="danger" onClick={() => deleteFile(f)}>Delete</Button>}
              </div>
            ))}
          </div>
        )}

      </Card>
    </PageContainer>
  );
}

/* ================= STYLES ================= */

const tabs = { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" };

const tabBtn = {
  padding: "9px 16px",
  border: `1px solid ${colors.hairline}`,
  background: colors.surface,
  color: colors.charcoal,
  borderRadius: radius.sm,
  fontFamily: font.body,
  fontSize: "13px",
  fontWeight: 600,
};

const activeTab = {
  ...tabBtn,
  background: colors.ink,
  color: colors.white,
  border: `1px solid ${colors.ink}`,
};

const section = { display: "flex", flexDirection: "column", gap: 4 };

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
  resize: "vertical",
};

const item = {
  padding: "12px 14px",
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  marginTop: 10,
  background: colors.paper,
};

const noteRow = {
  padding: "14px 16px",
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  marginTop: 10,
  background: colors.paper,
  cursor: "pointer",
};

const noteRowTitle = {
  fontFamily: font.display,
  fontWeight: 600,
  fontSize: "14px",
  color: colors.ink,
  marginBottom: 4,
};

const noteRowPreview = {
  fontSize: "12px",
  color: colors.slate,
  lineHeight: 1.4,
};

const backBtn = {
  alignSelf: "flex-start",
  background: "transparent",
  border: "none",
  color: colors.accent,
  fontFamily: font.body,
  fontSize: "13px",
  fontWeight: 600,
  padding: "4px 0",
  marginBottom: 18,
  display: "inline-block",
};

const overviewTitle = {
  fontFamily: font.display,
  fontSize: "18px",
  fontWeight: 600,
  color: colors.ink,
  margin: "12px 0 18px",
};

const overviewRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderTop: `1px solid ${colors.hairline}`,
};

const overviewLabel = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: colors.slate,
};

const overviewValue = {
  fontFamily: font.display,
  fontSize: "14px",
  fontWeight: 600,
  color: colors.ink,
  textAlign: "right",
};

const itemTitle = {
  fontFamily: font.display,
  fontWeight: 600,
  fontSize: "14px",
  color: colors.ink,
};

const itemMeta = {
  fontSize: "12px",
  color: colors.slate,
  marginTop: 2,
};

const fileLink = {
  color: colors.accent,
  fontSize: "13px",
  fontWeight: 600,
  textDecoration: "none",
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default CaseDetails;