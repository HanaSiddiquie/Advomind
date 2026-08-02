// frontend/src/pages/HearingDetails.js
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { colors, font } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuthRole } from "../context/AuthRoleContext";

function HearingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [hearing, setHearing] = useState(null);
  const { ownerId: userId, canDelete } = useAuthRole();
  const courtType = localStorage.getItem("court");

  const [form, setForm] = useState({
    date: "",
    event: "",
    notes: "",
    reminder: ""
  });

  // ================= FETCH HEARING =================
  const fetchHearing = async () => {
    if (!userId || !courtType || !id) return;

    const snap = await getDoc(doc(db, "hearings", id));

    if (!snap.exists()) {
      setHearing(null);
      return;
    }

    const data = snap.data();

    // 🔒 SECURITY CHECK
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
      <PageContainer title="Hearing Details">
        <p style={emptyText}>Hearing not found or not accessible</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      eyebrow={courtType?.toUpperCase()}
      title="Hearing Details"
      subtitle={`${hearing.date} · ${hearing.event}`}
    >
      <Card style={{ maxWidth: 480 }}>
        <Input
          label="Event"
          value={form.event}
          onChange={(e) => setForm({ ...form, event: e.target.value })}
          placeholder="Event"
        />

        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />

        <label style={selectLabel}>Notes</label>
        <textarea
          className="am-input"
          style={textareaStyle}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes"
        />

        <Input
          label="Reminder"
          value={form.reminder}
          onChange={(e) => setForm({ ...form, reminder: e.target.value })}
          placeholder="Reminder"
        />

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Button onClick={updateHearing} style={{ flex: 1 }}>
            Save
          </Button>

          {canDelete && (
            <Button variant="danger" onClick={deleteHearing} style={{ flex: 1 }}>
              Delete
            </Button>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}

/* ================= STYLES ================= */

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

const textareaStyle = {
  boxSizing: "border-box",
  width: "100%",
  padding: "11px 13px",
  marginBottom: "14px",
  minHeight: "80px",
  resize: "vertical",
  fontFamily: font.body,
  fontSize: "14px",
  color: colors.ink,
  background: colors.surface,
  border: `1px solid ${colors.hairline}`,
  borderRadius: "6px",
  outline: "none",
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default HearingDetails;