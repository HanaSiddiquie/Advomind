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
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import Loading from "../components/ui/Loading";
import { toast } from "../components/Notifications";
import { todayKey, tomorrowKey, formatDate } from "../utils/dates";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";
import { CMS_URL } from "../services/cms";
import EmptyState from "../components/ui/EmptyState";
import VoiceWrap from "../components/ui/VoiceWrap";

function Hearings() {
  const [hearings, setHearings] = useState([]);
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [when, setWhen] = useState("all");

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

      // clients live under users/{uid}/clients, not a top-level collection
      const clientSnap = await getDocs(
        query(
          collection(db, "users", userId, "clients"),
          where("court_type", "==", courtType)
        )
      );

      setClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err) {
      console.log(err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!form.case_id || !form.date || !form.event.trim()) {
      alert("Please select a case, a date, and an event");
      return;
    }
    if (!userId) return;

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
    setShowAddModal(false);
    fetchData();
    toast("Hearing scheduled", "success");
  };

  // ================= HELPERS =================
  const getCaseTitle = (id) => caseMap[id]?.title || "Unknown Case";

  const getClientName = (caseId) => {
    const clientId = caseMap[caseId]?.client_id;
    return clientMap[clientId]?.name || "Unknown Client";
  };

  const groups = useMemo(() => {
    const today = todayKey();
    const tomorrow = tomorrowKey();
    const q = search.trim().toLowerCase();
    const dateOf = (h) => String(h.date || "").slice(0, 10);

    const list = hearings.filter(h => {
      if (when === "upcoming" && dateOf(h) < today) return false;
      if (when === "past" && dateOf(h) >= today) return false;
      if (!q) return true;
      const c = caseMap[h.case_id];
      return [h.event, h.notes, h.date, c?.title, clientMap[c?.client_id]?.name]
        .some(v => String(v || "").toLowerCase().includes(q));
    });

    const asc = (a, b) => dateOf(a).localeCompare(dateOf(b));
    return [
      { key: "today", title: "Today", tone: "accent", items: list.filter(h => dateOf(h) === today) },
      { key: "tomorrow", title: "Tomorrow", tone: "warn", items: list.filter(h => dateOf(h) === tomorrow) },
      { key: "upcoming", title: "Upcoming", tone: "dark", items: list.filter(h => dateOf(h) > tomorrow).sort(asc) },
      { key: "past", title: "Past", tone: "neutral", past: true, items: list.filter(h => dateOf(h) < today).sort((a, b) => asc(b, a)) },
    ].filter(g => g.items.length > 0);
  }, [hearings, search, when, caseMap, clientMap]);

  // ================= UI =================
  return (
    <PageContainer
      eyebrow={courtType?.toUpperCase()}
      title="Hearings Timeline"
      subtitle="Schedule and track upcoming hearings"
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={() => setShowAddModal(true)}>+ Add Hearing</Button>
          <a href={CMS_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <Button variant="secondary">Open CMS ↗</Button>
          </a>
        </div>
      }
    >
      {/* ADD HEARING MODAL */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Hearing"
      >
        {cases.length === 0 && (
          <p style={modalHint}>
            You don't have any cases on this court yet — create a case first, then come back
            to schedule its hearings.
          </p>
        )}

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
                    voice
          placeholder="e.g. First hearing"
          value={form.event}
          onChange={(e) => setForm({ ...form, event: e.target.value })}
        />

        <label style={selectLabel}>Notes</label>
                <VoiceWrap>
          <textarea
            className="am-input"
            style={textareaStyle}
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </VoiceWrap>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Button onClick={handleSubmit} style={{ flex: 1 }}>Add Hearing</Button>
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
            placeholder="Search by event, case, client or date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="am-input"
          aria-label="Filter by date"
          style={{ ...selectStyle, width: "auto", minWidth: 160 }}
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        >
          <option value="all">All hearings</option>
          <option value="upcoming">Today &amp; upcoming</option>
          <option value="past">Past only</option>
        </select>
      </div>

      {/* TIMELINE */}
      {!loaded ? (
        <Loading />
      ) : hearings.length === 0 ? (
                <EmptyState
          icon="🗓️"
          title="No hearings scheduled"
          text="Schedule a hearing and it will show up here, grouped by Today, Tomorrow and Upcoming."
          action="+ Add Hearing"
          onAction={() => setShowAddModal(true)}
        />
      ) : groups.length === 0 ? (
        <p style={emptyText}>No hearings match your search or filter.</p>
      ) : (
        groups.map(g => (
          <div key={g.key} style={{ marginBottom: 22 }}>
            <h3 style={groupTitle}>
              {g.title} <span style={groupCount}>{g.items.length}</span>
            </h3>
            <div style={timeline}>
              {g.items.map(h => (
                <div
                  key={h.id}
                  role="link"
                  tabIndex={0}
                  className="am-card-hover"
                  style={{ ...card, ...(g.past ? { opacity: 0.65, borderLeftColor: colors.slate } : {}) }}
                  onClick={() => navigate(`/hearings/${h.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate(`/hearings/${h.id}`); }}
                >
                  <Badge tone={g.tone}>
                    {g.key === "today" || g.key === "tomorrow"
                      ? `${g.title} · ${formatDate(h.date)}`
                      : formatDate(h.date)}
                  </Badge>

                  <h3 style={eventTitle}>{h.event}</h3>

                  <div style={meta}>Case: {getCaseTitle(h.case_id)}</div>
                  <div style={meta}>Client: {getClientName(h.case_id)}</div>

                  {h.notes && <div style={notes}>{h.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
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

const groupTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "8px 0 12px",
};

const groupCount = {
  fontFamily: font.body,
  fontSize: "12px",
  fontWeight: 600,
  color: colors.slate,
  marginLeft: 4,
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