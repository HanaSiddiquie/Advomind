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

  const fetchCase = async () => {
    setLoading(true);
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
    }
    setLoading(false);
  };

  const fetchHearings = async () => {
    const q = query(collection(db, "hearings"), where("case_id", "==", caseId));
    const snap = await getDocs(q);
    setAllHearings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchFiles = async () => {
    const q = query(collection(db, "files"), where("case_id", "==", caseId));
    const snap = await getDocs(q);
    setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchCase();
    fetchHearings();
    fetchFiles();
  }, [caseId]);

  const updateCase = async () => {
    await updateDoc(doc(db, "cases", caseId), form);
    fetchCase();
  };

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

  const uploadFile = async () => {
    if (!file) return;

    setUploading(true);

    const fileRef = ref(storage, `cases/${caseId}/${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    await addDoc(collection(db, "files"), {
      case_id: caseId,
      name: file.name,
      url
    });

    setFile(null);
    setUploading(false);
    fetchFiles();
  };

  const deleteFile = async (f) => {
    const fileRef = ref(storage, `cases/${caseId}/${f.name}`);
    await deleteObject(fileRef);
    await deleteDoc(doc(db, "files", f.id));
    fetchFiles();
  };

  const caseHearings = [...allHearings].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  if (loading) return <div style={page}>Loading...</div>;
  if (!caseData) return <div style={page}>Case not found</div>;

  return (
    <div style={page}>

      <h2 style={title}>Case Dashboard</h2>

      {/* TABS */}
      <div style={tabs}>
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

      {/* CARD */}
      <div style={card}>

        {/* VIEW */}
        {tab === "view" && (
          <div style={section}>
            <h3 style={heading}>Edit Case</h3>

            <input style={input}
              placeholder="Title"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />

            <input style={input}
              placeholder="Status"
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            />

            <textarea style={textarea}
              placeholder="Description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />

            <button style={btn} onClick={updateCase}>Save Changes</button>
          </div>
        )}

        {/* DETAILS */}
        {tab === "details" && (
          <div style={section}>
            <h3 style={heading}>Case Details</h3>
            <textarea style={bigTextarea}
              value={form.details}
              onChange={e => setForm({ ...form, details: e.target.value })}
            />
            <button style={btn} onClick={updateCase}>Save</button>
          </div>
        )}

        {/* DIARY */}
        {tab === "diary" && (
          <div style={section}>
            <h3 style={heading}>Case Diary</h3>
            <textarea style={bigTextarea}
              value={form.diary}
              onChange={e => setForm({ ...form, diary: e.target.value })}
            />
            <button style={btn} onClick={updateCase}>Save</button>
          </div>
        )}

        {/* FILES */}
        {tab === "files" && (
          <div style={section}>
            <h3 style={heading}>Files</h3>

            <input type="file" onChange={e => setFile(e.target.files[0])} />

            <button style={btn} onClick={uploadFile}>
              {uploading ? "Uploading..." : "Upload File"}
            </button>

            <div style={list}>
              {files.map(f => (
                <div key={f.id} style={item}>
                  <span>{f.name}</span>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <a href={f.url} target="_blank" style={link}>
                      Open
                    </a>
                    <button onClick={() => deleteFile(f)} style={danger}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HEARINGS */}
        {tab === "hearings" && (
          <div style={section}>
            <h3 style={heading}>Add Hearing</h3>

            <input style={input} type="date"
              value={hearingForm.date}
              onChange={e => setHearingForm({ ...hearingForm, date: e.target.value })}
            />

            <input style={input} placeholder="Event"
              value={hearingForm.event}
              onChange={e => setHearingForm({ ...hearingForm, event: e.target.value })}
            />

            <input style={input} placeholder="Notes"
              value={hearingForm.notes}
              onChange={e => setHearingForm({ ...hearingForm, notes: e.target.value })}
            />

            <button style={btn} onClick={addHearing}>Add Hearing</button>

            <h3 style={heading}>Timeline</h3>

            <div style={list}>
              {caseHearings.map(h => (
                <div key={h.id} style={item}>
                  <div>
                    <b>{h.event}</b>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      {h.date}
                    </div>
                    <div>{h.notes}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ================= THEME (GREY / BLACK / WHITE CLEAN UI) ================= */

const page = {
  padding: "20px",
  minHeight: "100vh",
  background: "#f5f6fa",
  color: "#111"
};

const title = {
  marginBottom: "15px",
  fontWeight: "600"
};

const tabs = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "20px"
};

const tabBtn = {
  padding: "10px 14px",
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: "8px",
  cursor: "pointer",
  color: "#333"
};

const activeTab = {
  ...tabBtn,
  background: "#111",
  color: "#fff",
  border: "1px solid #111"
};

const card = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb"
};

const section = {
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const heading = {
  fontWeight: "600",
  color: "#111"
};

const input = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  outline: "none"
};

const textarea = {
  ...input,
  height: "120px",
  resize: "none"
};

const bigTextarea = {
  ...input,
  height: "200px",
  resize: "none"
};

const btn = {
  padding: "10px",
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const list = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginTop: "10px"
};

const item = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px",
  background: "#fafafa",
  border: "1px solid #eee",
  borderRadius: "10px"
};

const danger = {
  background: "#111",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer"
};

const link = {
  color: "#111",
  textDecoration: "underline"
};

export default CaseDetails;