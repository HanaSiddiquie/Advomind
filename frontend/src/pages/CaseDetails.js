// frontend/src/pages/CaseDetails.js
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
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

const TABS = ["view", "details", "diary", "hearings", "files"];

function CaseDetails() {
  const { id } = useParams();
  const caseId = id;

  const [userId, setUserId] = useState(null);
  const courtType = localStorage.getItem("court");

  const [caseData, setCaseData] = useState(null);
  const [hearings, setHearings] = useState([]);
  const [files, setFiles] = useState([]);

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [tab, setTab] = useState("view");

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "",
    details: "",
    diary: ""
  });

  const [hearingForm, setHearingForm] = useState({
    date: "",
    event: "",
    notes: ""
  });

  /* ================= AUTH ================= */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });
    return () => unsub();
  }, []);

  /* ================= CASE ================= */
  const fetchCase = async (uid) => {
    const snap = await getDoc(doc(db, "cases", caseId));
    if (!snap.exists()) return;

    const data = snap.data();
    if (data.userId && data.userId !== uid) return;

    setCaseData(data);

    setForm({
      title: data.title || "",
      description: data.description || "",
      status: data.status || "",
      details: data.details || "",
      diary: data.diary || ""
    });
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
      where("userId", "==", uid)
    );

    const snap = await getDocs(q);
    setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  /* ================= LOAD ================= */
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      await fetchCase(userId);
      await fetchHearings(userId);
      await fetchFiles(userId);
    };

    load();
  }, [caseId, userId]);

  /* ================= UPDATE CASE (ARCHIVE ON CLOSE) ================= */
  const updateCase = async () => {
    try {
      const caseRef = doc(db, "cases", caseId);

      if (form.status === "Closed") {
        await addDoc(collection(db, "archive"), {
          ...form,
          originalCaseId: caseId,
          userId,
          court_type: courtType,
          status: "Closed",
          archivedAt: Date.now()
        });

        await deleteDoc(caseRef);

        alert("Case moved to Archive");
        return;
      }

      await updateDoc(caseRef, form);
      fetchCase(userId);

    } catch (err) {
      console.error(err);
      alert("Failed to update case");
    }
  };

  /* ================= ADD HEARING ================= */
  const addHearing = async () => {
    if (!hearingForm.date || !hearingForm.event) return;

    await addDoc(collection(db, "hearings"), {
      case_id: caseId,
      userId,
      court_type: courtType,
      ...hearingForm
    });

    setHearingForm({ date: "", event: "", notes: "" });
    fetchHearings(userId);
  };

  /* ================= FILE UPLOAD ================= */
  const uploadFile = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !file) return;

      setUploading(true);

      const uid = user.uid;

      const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `cases/${uid}/${caseId}/${Date.now()}_${cleanName}`;

      const fileRef = ref(storage, path);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      await addDoc(collection(db, "files"), {
        case_id: caseId,
        userId: uid,
        name: file.name,
        storagePath: path,
        url,
        createdAt: Date.now()
      });

      setFile(null);
      await fetchFiles(uid);

    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* ================= DELETE FILE ================= */
  const deleteFile = async (f) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      if (f.storagePath) {
        await deleteObject(ref(storage, f.storagePath));
      }

      await deleteDoc(doc(db, "files", f.id));

      fetchFiles(user.uid);

    } catch (err) {
      console.error(err);
    }
  };

  const sortedHearings = [...hearings].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  if (!caseData) return <PageContainer title="Case Dashboard"><p style={emptyText}>Loading…</p></PageContainer>;

  return (
    <PageContainer eyebrow={courtType?.toUpperCase()} title={caseData.title || "Case Dashboard"}>

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
              <option>Closed</option>
            </select>

            <Button onClick={updateCase} style={{ alignSelf: "flex-start" }}>
              Save Changes
            </Button>
          </div>
        )}

        {/* DETAILS */}
        {tab === "details" && (
          <div style={section}>
            <label style={selectLabel}>Details</label>
            <textarea
              className="am-input"
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              style={textareaStyle}
              rows={6}
            />
            <Button onClick={updateCase} style={{ alignSelf: "flex-start" }}>Save Details</Button>
          </div>
        )}

        {/* DIARY */}
        {tab === "diary" && (
          <div style={section}>
            <label style={selectLabel}>Diary</label>
            <textarea
              className="am-input"
              value={form.diary}
              onChange={(e) => setForm({ ...form, diary: e.target.value })}
              style={textareaStyle}
              rows={6}
            />
            <Button onClick={updateCase} style={{ alignSelf: "flex-start" }}>Save Diary</Button>
          </div>
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
                <Button variant="danger" onClick={() => deleteFile(f)}>Delete</Button>
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