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

  /* ================= UPDATE CASE (ARCHIVE FIX HERE) ================= */
  const updateCase = async () => {
    try {
      const caseRef = doc(db, "cases", caseId);

      // 🚨 MOVE TO ARCHIVE IF CLOSED
      if (form.status === "Closed") {
        await addDoc(collection(db, "archive"), {
          ...form,
          originalCaseId: caseId,
          userId,
          court_type: courtType,   // ✅ FIXED FIELD NAME
          status: "Closed",
          archivedAt: Date.now()
        });

        await deleteDoc(caseRef);

        alert("Case moved to Archive");
        return;
      }

      // NORMAL UPDATE
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

  if (!caseData) return <div style={page}>Loading...</div>;

  return (
    <div style={page}>
      <h2 style={title}>⚖️ Case Dashboard</h2>

      <div style={tabs}>
        {["view", "details", "diary", "hearings", "files"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={tab === t ? activeTab : tabBtn}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={card}>

        {/* VIEW */}
        {tab === "view" && (
          <div style={section}>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={input}
            />

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={input}
            >
              <option value="">Select Status</option>
              <option>Open</option>
              <option>In Progress</option>
              <option>On Hold</option>
              <option>Closed</option>
            </select>

            <button style={btn} onClick={updateCase}>
              Save Changes
            </button>
          </div>
        )}

        {/* DETAILS */}
        {tab === "details" && (
          <div style={section}>
            <textarea
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              style={input}
              rows={6}
            />
            <button style={btn} onClick={updateCase}>Save Details</button>
          </div>
        )}

        {/* DIARY */}
        {tab === "diary" && (
          <div style={section}>
            <textarea
              value={form.diary}
              onChange={(e) => setForm({ ...form, diary: e.target.value })}
              style={input}
              rows={6}
            />
            <button style={btn} onClick={updateCase}>Save Diary</button>
          </div>
        )}

        {/* HEARINGS */}
        {tab === "hearings" && (
          <div style={section}>
            <input
              type="date"
              value={hearingForm.date}
              style={input}
              onChange={(e) =>
                setHearingForm({ ...hearingForm, date: e.target.value })
              }
            />

            <input
              placeholder="Event"
              value={hearingForm.event}
              style={input}
              onChange={(e) =>
                setHearingForm({ ...hearingForm, event: e.target.value })
              }
            />

            <textarea
              placeholder="Notes"
              value={hearingForm.notes}
              style={input}
              onChange={(e) =>
                setHearingForm({ ...hearingForm, notes: e.target.value })
              }
            />

            <button style={btn} onClick={addHearing}>Add Hearing</button>

            {sortedHearings.map(h => (
              <div key={h.id} style={item}>
                <b>{h.event}</b>
                <div>{h.date}</div>
                <div>{h.notes}</div>
              </div>
            ))}
          </div>
        )}

        {/* FILES */}
        {tab === "files" && (
          <div style={section}>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} />

            <button style={btn} onClick={uploadFile}>
              {uploading ? "Uploading..." : "Upload File"}
            </button>

            {files.map(f => (
              <div key={f.id} style={item}>
                <a href={f.url} target="_blank" rel="noreferrer">
                  {f.name}
                </a>
                <button onClick={() => deleteFile(f)}>Delete</button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

/* styles unchanged */
const page = { padding: 25, background: "#f3f4f6", minHeight: "100vh" };
const title = { marginBottom: 15 };
const tabs = { display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" };
const tabBtn = { padding: 10, border: "1px solid #ddd", background: "#fff" };
const activeTab = { ...tabBtn, background: "#111", color: "#fff" };
const card = { background: "#fff", padding: 20, borderRadius: 12 };
const section = { display: "flex", flexDirection: "column", gap: 10 };
const input = { padding: 10, border: "1px solid #ddd", borderRadius: 8 };
const btn = { padding: 10, background: "#111", color: "#fff", border: "none", borderRadius: 8 };
const item = { padding: 10, border: "1px solid #eee", borderRadius: 8, marginTop: 10 };

export default CaseDetails;