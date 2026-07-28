// frontend/src/pages/HearingsDashboard.js
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { colors, font, radius, shadow } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";

function HearingsDashboard() {
  const [hearings, setHearings] = useState([]);
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const navigate = useNavigate();

  // =========================
  // FETCH DATA
  // =========================
  const fetchData = async () => {
    try {
      const [hRes, cRes, clRes] = await Promise.all([
        API.get("/hearings"),
        API.get("/cases"),
        API.get("/clients")
      ]);

      setHearings(hRes.data.data || []);
      setCases(cRes.data.data || []);
      setClients(clRes.data.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // =========================
  // HELPERS
  // =========================
  const getCase = (case_id) =>
    cases.find(c => String(c.id) === String(case_id));

  const getClientName = (case_id) => {
    const c = getCase(case_id);
    if (!c) return "Unknown Client";

    const client = clients.find(cl => String(cl.id) === String(c.client_id));
    return client ? client.name : "Unknown Client";
  };

  const getCaseTitle = (case_id) => {
    const c = getCase(case_id);
    return c ? c.title : "Unknown Case";
  };

  const today = new Date();

  const isPast = (date) => new Date(date) < today;

  const isToday = (date) => {
    const d = new Date(date);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };

  const upcoming = hearings.filter(h => !isPast(h.date));
  const past = hearings.filter(h => isPast(h.date));
  const todayHearings = hearings.filter(h => isToday(h.date));

  const renderHearing = (h, tone) => (
    <div
      key={h.id}
      className="am-card-hover"
      style={{ ...card, borderLeftColor: tone }}
      onClick={() => navigate(`/hearings/${h.id}`)}
    >
      <h3 style={eventTitle}>{h.event}</h3>
      <p style={metaRow}><span style={metaLabel}>Case</span> {getCaseTitle(h.case_id)}</p>
      <p style={metaRow}><span style={metaLabel}>Client</span> {getClientName(h.case_id)}</p>
      <p style={metaRow}><span style={metaLabel}>Date</span> {h.date}</p>
    </div>
  );

  return (
    <PageContainer title="Hearings Dashboard" subtitle="Cross-court overview of all scheduled hearings">

      {/* STATS */}
      <div style={statsGrid}>
        <div style={{ ...cardStat, borderLeftColor: colors.ink }}>
          <div style={statValue}>{hearings.length}</div>
          <div style={statLabel}>Total Hearings</div>
        </div>

        <div style={{ ...cardStat, borderLeftColor: colors.success }}>
          <div style={statValue}>{upcoming.length}</div>
          <div style={statLabel}>Upcoming</div>
        </div>

        <div style={{ ...cardStat, borderLeftColor: colors.danger }}>
          <div style={statValue}>{past.length}</div>
          <div style={statLabel}>Past / Overdue</div>
        </div>
      </div>

      {/* TODAY */}
      <h3 style={groupTitle}>Today</h3>
      {todayHearings.length === 0 ? (
        <p style={emptyText}>No hearings today</p>
      ) : (
        todayHearings.map(h => renderHearing(h, colors.accent))
      )}

      {/* UPCOMING */}
      <h3 style={groupTitle}>Upcoming Hearings</h3>
      {upcoming.length === 0 ? (
        <p style={emptyText}>No upcoming hearings</p>
      ) : (
        upcoming.map(h => renderHearing(h, colors.success))
      )}

      {/* PAST */}
      <h3 style={groupTitle}>Past / Overdue Hearings</h3>
      {past.length === 0 ? (
        <p style={emptyText}>No past hearings</p>
      ) : (
        past.map(h => renderHearing(h, colors.danger))
      )}
    </PageContainer>
  );
}

/* STYLES */

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "14px",
};

const cardStat = {
  background: colors.surface,
  padding: "18px 20px",
  borderRadius: radius.md,
  boxShadow: shadow.sm,
  border: `1px solid ${colors.hairline}`,
  borderLeft: "4px solid",
};

const statValue = {
  fontFamily: font.display,
  fontSize: "28px",
  fontWeight: 600,
  color: colors.ink,
};

const statLabel = {
  fontSize: "12px",
  color: colors.slate,
  marginTop: "4px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: 600,
};

const groupTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "28px 0 12px",
};

const card = {
  background: colors.surface,
  padding: "14px 16px",
  borderRadius: radius.md,
  marginTop: "10px",
  border: `1px solid ${colors.hairline}`,
  borderLeft: "4px solid",
  cursor: "pointer",
};

const eventTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 8px",
};

const metaRow = {
  fontSize: "13px",
  color: colors.charcoal,
  margin: "2px 0",
};

const metaLabel = {
  color: colors.slate,
  fontWeight: 600,
  marginRight: "4px",
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default HearingsDashboard;