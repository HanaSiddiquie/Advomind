// frontend/src/pages/HearingDetails.js
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { colors, font, radius } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useAuthRole } from "../context/AuthRoleContext";
import { CMS_URL } from "../services/cms";

function formatDate(dateStr) {
  if (!dateStr) return "No date set";
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("default", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

function HearingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [hearing, setHearing] = useState(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const { ownerId: userId, canDelete } = useAuthRole();
  const courtType = localStorage.getItem("court");

  const [form, setForm] = useState({
    date: "",
    event: "",
    notes: "",
    reminder: ""
  });

  const fetchCaseAndClient = async (caseId) => {
    if (!caseId || !userId) {
      setCaseTitle("");
      setClientName("");
      return;
    }

    const caseSnap = await getDoc(doc(db, "cases", caseId));
    if (!caseSnap.exists()) {
      setCaseTitle("Unknown case");
      setClientName("");
      return;
    }

    const caseData = caseSnap.data();
    setCaseTitle(caseData.title || "Untitled case");

    if (caseData.client_id) {
      const clientSnap = await getDoc(doc(db, "users", userId, "clients", caseData.client_id));
      setClientName(clientSnap.exists() ? clientSnap.data().name || "" : "");
    } else {
      setClientName("");
    }
  };

  const fetchHearing = async () => {
    if (!userId || !courtType || !id) return;

    const snap = await getDoc(doc(db, "hearings", id));

    if (!snap.exists()) {
      setHearing(null);
      return;
    }

    const data = snap.data();

    if (data.userId !== userId || data.court_type !== courtType) {
      setHearing(null);
      return;
    }

    setHearing({ id: snap.id, ...data });
    fetchCaseAndClient(data.case_id);

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

  const updateHearing = async () => {
    await updateDoc(doc(db, "hearings", id), form);
    fetchHearing();
    alert("Updated successfully");
  };

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
      title={hearing.event || "Hearing"}
      subtitle={formatDate(hearing.date)}
      action={
        <a href={CMS_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <Button variant="secondary">Open in CMS ↗</Button>
        </a>
      }
    >
      <button onClick={() => navigate("/hearings")} className="am-btn" style={backBtn}>
        ← Back to Hearings
      </button>

      <div style={grid}>

        <Card>
          <Badge tone="accent">Hearing</Badge>

          <h3 style={overviewTitle}>{hearing.event}</h3>

          <div style={overviewRow}>
            <span style={overviewLabel}>Date</span>
            <span style={overviewValue}>{formatDate(hearing.date)}</span>
          </div>

          <div style={overviewRow}>
            <span style={overviewLabel}>Case</span>
            <span
              style={{ ...overviewValue, ...(caseTitle && hearing.case_id ? linkValue : {}) }}
              onClick={() => hearing.case_id && navigate(`/cases/${hearing.case_id}`)}
            >
              {caseTitle || "—"}
            </span>
          </div>

          <div style={overviewRow}>
            <span style={overviewLabel}>Client</span>
            <span style={overviewValue}>{clientName || "—"}</span>
          </div>

          {hearing.notes && (
            <div style={{ ...overviewRow, flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <span style={overviewLabel}>Notes</span>
              <span style={{ ...overviewValue, fontWeight: 400 }}>{hearing.notes}</span>
            </div>
          )}
        </Card>

        <Card>
          <h3 style={editTitle}>Edit Hearing</h3>

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

      </div>
    </PageContainer>
  );
}

/* ================= STYLES ================= */

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

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px",
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

const linkValue = {
  color: colors.accent,
  cursor: "pointer",
};

const editTitle = {
  fontFamily: font.display,
  fontSize: "16px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 16px",
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
  borderRadius: radius.sm,
  outline: "none",
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default HearingDetails;