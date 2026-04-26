import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

function HearingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [hearing, setHearing] = useState(null);
  const [userId, setUserId] = useState(null);
  const courtType = localStorage.getItem("court");

  const [form, setForm] = useState({
    date: "",
    event: "",
    notes: "",
    reminder: ""
  });

  // ================= AUTH =================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });

    return () => unsub();
  }, []);

  // ================= FETCH HEARING (FIXED) =================
  const fetchHearing = async () => {
    if (!userId || !courtType || !id) return;

    const snap = await getDoc(doc(db, "hearings", id));

    if (!snap.exists()) {
      setHearing(null);
      return;
    }

    const data = snap.data();

    // 🔒 SECURITY CHECK (VERY IMPORTANT)
    if (data.userId !== userId || data.court_type !== courtType) {
      setHearing(null);
      return;
    }

    setHearing({ id: snap.id, ...data });

    setForm({
      date: data.date || "",
      event: data.event || "",
      notes: data.notes || "",
      reminder: data.reminder || ""
    });
  };

  useEffect(() => {
    fetchHearing();
  }, [id, userId]);

  // ================= UPDATE =================
  const updateHearing = async () => {
    await updateDoc(doc(db, "hearings", id), form);
    fetchHearing();
    alert("Updated successfully");
  };

  // ================= DELETE =================
  const deleteHearing = async () => {
    if (!window.confirm("Delete this hearing?")) return;

    await deleteDoc(doc(db, "hearings", id));
    alert("Deleted");
    navigate("/hearings");
  };

  if (!hearing) {
    return (
      <div style={{ padding: 20 }}>
        <h3>❌ Hearing not found or not accessible</h3>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, background: "#f5f6fa", minHeight: "100vh" }}>
      
      <h2>⚖️ Hearing Details</h2>
<p style={{ color: "gray" }}>
  {hearing.date} • {hearing.event}
</p>

      <div style={card}>
        <input
          style={input}
          value={form.event}
          onChange={(e) => setForm({ ...form, event: e.target.value })}
          placeholder="Event"
        />

        <input
          style={input}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />

        <textarea
          style={input}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes"
        />

        <input
          style={input}
          value={form.reminder}
          onChange={(e) => setForm({ ...form, reminder: e.target.value })}
          placeholder="Reminder"
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button style={btn} onClick={updateHearing}>
            Save
          </button>

          <button style={{ ...btn, background: "red" }} onClick={deleteHearing}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const card = {
  background: "#fff",
  padding: 20,
  borderRadius: 12
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #ddd"
};

const btn = {
  padding: 10,
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: 8
};

export default HearingDetails;