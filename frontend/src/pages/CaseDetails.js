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

import { db, storage } from "../firebase";

function CaseDetails() {
  const { id } = useParams();
  const caseId = id;

  const [caseData, setCaseData] = useState(null);
  const [allHearings, setAllHearings] = useState([]);
  const [files, setFiles] = useState([]);

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [tab, setTab] = useState("view");
  const [loading, setLoading] = useState(true);

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

  // =========================
  // FETCH CASE
  // =========================
  const fetchCase = async () => {
    setLoading(true);

    try {
      const snap = await getDoc(doc(db, "cases", caseId));

      if (snap.exists()) {
        const data = snap.data();
        setCaseData(data);

        setForm({
          title: data.title || "",
          description: data.description || "",
          status: data.status || "",
          details: data.details || "",
          diary: data.diary || ""
        });
      } else {
        setCaseData(null);
      }
    } catch (err) {
      console.log(err);
    }

    setLoading(false);
  };

  // =========================
  // FETCH HEARINGS
  // =========================
  const fetchHearings = async () => {
    const q = query(
      collection(db, "hearings"),
      where("case_id", "==", caseId)
    );

    const snap = await getDocs(q);

    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    setAllHearings(data);
  };

  // =========================
  // FETCH FILES
  // =========================
  const fetchFiles = async () => {
    const q = query(
      collection(db, "files"),
      where("case_id", "==", caseId)
    );

    const snap = await getDocs(q);

    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    setFiles(data);
  };

  useEffect(() => {
    fetchCase();
    fetchHearings();
    fetchFiles();
  }, [caseId]);

  // =========================
  // UPDATE CASE
  // =========================
  const updateCase = async () => {
    await updateDoc(doc(db, "cases", caseId), form);
    fetchCase();
  };

  // =========================
  // ADD HEARING
  // =========================
  const addHearing = async () => {
    if (!hearingForm.date || !hearingForm.event) return;

    await addDoc(collection(db, "hearings"), {
      case_id: caseId,
      date: hearingForm.date,
      event: hearingForm.event,
      notes: hearingForm.notes
    });

    setHearingForm({ date: "", event: "", notes: "" });
    fetchHearings();
  };

  // =========================
  // FILE UPLOAD (FIREBASE STORAGE FIX)
  // =========================
  const uploadFile = async () => {
    if (!file) return;

    setUploading(true);

    try {
      const fileRef = ref(storage, `cases/${caseId}/${file.name}`);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      await addDoc(collection(db, "files"), {
        case_id: caseId,
        name: file.name,
        url: url,
        createdAt: new Date()
      });

      setFile(null);
      fetchFiles();
    } catch (err) {
      console.log(err);
      alert("Upload failed");
    }

    setUploading(false);
  };

  // =========================
  // DELETE FILE
  // =========================
  const deleteFile = async (fileItem) => {
    try {
      const fileRef = ref(storage, `cases/${caseId}/${fileItem.name}`);

      await deleteObject(fileRef);
      await deleteDoc(doc(db, "files", fileItem.id));

      fetchFiles();
    } catch (err) {
      console.log(err);
    }
  };

  const caseHearings = [...allHearings].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  if (loading) return <p style={{ padding: 20 }}>Loading case...</p>;
  if (!caseData) return <p style={{ padding: 20 }}>Case not found</p>;

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>

      <h2>📁 Case Dashboard</h2>

      {/* TABS */}
      <div style={tabBar}>
        {["view", "details", "diary", "files", "hearings"].map(t => (
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
          <div>
            <h3>Edit Case</h3>

            <input style={input}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Title"
            />

            <input style={input}
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
              placeholder="Status"
            />

            <textarea style={textarea}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Description"
            />

            <button style={btn} onClick={updateCase}>💾 Save</button>
          </div>
        )}

        {/* DETAILS */}
        {tab === "details" && (
          <div>
            <h3>📝 Case Details</h3>
            <textarea style={notesArea}
              value={form.details}
              onChange={e => setForm({ ...form, details: e.target.value })}
            />
            <button style={btn} onClick={updateCase}>💾 Save</button>
          </div>
        )}

        {/* DIARY */}
        {tab === "diary" && (
          <div>
            <h3>📓 Case Diary</h3>
            <textarea style={notesArea}
              value={form.diary}
              onChange={e => setForm({ ...form, diary: e.target.value })}
            />
            <button style={btn} onClick={updateCase}>💾 Save</button>
          </div>
        )}

        {/* FILES (NOW WORKING) */}
        {tab === "files" && (
          <div>
            <h3>📎 Case Files</h3>

            <input type="file" onChange={(e) => setFile(e.target.files[0])} />

            <button
              style={btn}
              onClick={uploadFile}
              disabled={!file || uploading}
            >
              {uploading ? "Uploading..." : "Upload File"}
            </button>

            <div style={{ marginTop: 20 }}>
              {files.map(f => (
                <div key={f.id} style={timelineCard}>
                  <p><b>{f.name}</b></p>
                  <a href={f.url} target="_blank" rel="noreferrer">Download</a>

                  <button
                    onClick={() => deleteFile(f)}
                    style={{ marginLeft: 10, color: "red" }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HEARINGS */}
        {tab === "hearings" && (
          <div>
            <h3>⚖️ Add Hearing</h3>

            <input style={input}
              type="date"
              value={hearingForm.date}
              onChange={e => setHearingForm({ ...hearingForm, date: e.target.value })}
            />

            <input style={input}
              placeholder="Event"
              value={hearingForm.event}
              onChange={e => setHearingForm({ ...hearingForm, event: e.target.value })}
            />

            <input style={input}
              placeholder="Notes"
              value={hearingForm.notes}
              onChange={e => setHearingForm({ ...hearingForm, notes: e.target.value })}
            />

            <button style={btn} onClick={addHearing}>➕ Add Hearing</button>

            <h3>Timeline</h3>

            {caseHearings.map(h => (
              <div key={h.id} style={timelineCard}>
                <b>{h.event}</b>
                <p>{h.date}</p>
                <p>{h.notes}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

/* styles unchanged */
const tabBar = { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" };
const tabBtn = { padding: "10px", background: "#fff", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer" };
const activeTab = { ...tabBtn, background: "#4f46e5", color: "white" };
const card = { background: "white", padding: "20px", borderRadius: "12px" };
const input = { width: "100%", padding: "10px", marginBottom: "10px" };
const textarea = { width: "100%", height: "120px", marginBottom: "10px" };
const notesArea = { width: "100%", height: "250px", padding: "15px", marginBottom: "10px" };
const btn = { padding: "10px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px" };
const timelineCard = { padding: "10px", border: "1px solid #ddd", marginBottom: "10px" };

export default CaseDetails;