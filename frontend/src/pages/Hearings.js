// frontend/src/pages/Hearings.js
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where
} from "firebase/firestore";
import { colors, font, radius } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";

function Hearings() {
  const [hearings, setHearings] = useState([]);
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);

  const { ownerId: userId, user, isLawyer } = useAuthRole();
  const courtType = localStorage.getItem("court");

  const navigate = useNavigate();

  const [form, setForm] = useState({
    case_id: "",
    date: "",
    event: "",
    notes: ""
  });

  // ================= FETCH =================
  const fetchData = async () => {
    try {
      if (!courtType || !userId) return;

      const scopedOpts = { ownerId: userId, isLawyer, myUid: user?.uid, extraWhere: [where("court_type", "==", courtType)] };

      const [caseList, hearingList] = await Promise.all([
        fetchScoped("cases", scopedOpts),
        fetchScoped("hearings", scopedOpts),
      ]);

      setCases(caseList);
      setHearings(hearingList);

      // ✅ clients live under users/{uid}/clients, not a top-level collection
      const clientSnap = await getDocs(
        query(
          collection(db, "users", userId, "clients"),
          where("court_type", "==", courtType)
        )
      );

      setClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courtType, userId, isLawyer]);

  // ================= MAPS =================
  const caseMap = useMemo(() => {
    const map = {};
    cases.forEach(c => (map[c.id] = c));
    return map;
  }, [cases]);

  const clientMap = useMemo(() => {
    const map = {};
    clients.forEach(c => (map[c.id] = c));
    return map;
  }, [clients]);

  // ================= ADD HEARING =================
  const handleSubmit = async () => {
    if (!form.case_id || !form.date || !form.event || !userId) return;

    await addDoc(collection(db, "hearings"), {
      case_id: form.case_id,
      date: form.date,
      event: form.event,
      notes: form.notes,
      court_type: courtType,
      userId,
      createdBy: user.uid,
      assignedTo: caseMap[form.case_id]?.assignedTo || null
    });

    setForm({ case_id: "", date: "", event: "", notes: "" });
    fetchData();
  };

  // ================= HELPERS =================
  const getCaseTitle = (id) => caseMap[id]?.title || "Unknown Case";

  const getClientName = (caseId) => {
    const clientId = caseMap[caseId]?.client_id;
    return clientMap[clientId]?.name || "Unknown Client";
  };

  const sortedHearings = useMemo(() => {
    return [...hearings].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
  }, [hearings]);

  // ================= UI =================
  return (
    <PageContainer
      eyebrow={courtType?.toUpperCase()}
      title="Hearings Timeline"
      subtitle="Schedule and track upcoming hearings"
    >
      {/* FORM */}
      <Card style={{ marginBottom: 25 }}>
        <h3 style={cardTitle}>Add Hearing</h3>

        <label style={selectLabel}>Case</label>
        <select
          className="am-input"
          style={selectStyle}
          value={form.case_id}
          onChange={(e) => setForm({ ...form, case_id: e.target.value })}
        >
          <option value="">Select case</option>
          {cases.map(c => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />

        <Input
          label="Event"
          placeholder="e.g. First hearing"
          value={form.event}
          onChange={(e) => setForm({ ...form, event: e.target.value })}
        />

        <label style={selectLabel}>Notes</label>
        <textarea
          className="am-input"
          style={textareaStyle}
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <Button onClick={handleSubmit} full>
          Add Hearing
        </Button>
      </Card>

      {/* TIMELINE */}
      <div style={timeline}>
        {sortedHearings.length === 0 ? (
          <p style={emptyText}>No hearings scheduled</p>
        ) : (
          sortedHearings.map(h => (
            <div
              key={h.id}
              className="am-card-hover"
              style={card}
              onClick={() => navigate(`/hearings/${h.id}`)}
            >
              <Badge tone="dark">{h.date}</Badge>

              <h3 style={eventTitle}>{h.event}</h3>

              <div style={meta}>Case: {getCaseTitle(h.case_id)}</div>
              <div style={meta}>Client: {getClientName(h.case_id)}</div>

              {h.notes && <div style={notes}>{h.notes}</div>}
            </div>
          ))
        )}
      </div>
    </PageContainer>
  );
}

/* ================= STYLES ================= */

const cardTitle = {
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
};

const timeline = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const card = {
  background: colors.surface,
  padding: "16px 18px",
  borderRadius: radius.md,
  borderLeft: `4px solid ${colors.accent}`,
  border: `1px solid ${colors.hairline}`,
  borderLeftWidth: "4px",
  borderLeftColor: colors.accent,
  cursor: "pointer",
};

const eventTitle = {
  fontFamily: font.display,
  fontSize: "16px",
  fontWeight: 600,
  color: colors.ink,
  margin: "10px 0 6px",
};

const meta = {
  fontSize: "13px",
  color: colors.slate,
  marginTop: "2px",
};

const notes = {
  marginTop: "8px",
  color: colors.charcoal,
  fontSize: "13px",
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default Hearings;