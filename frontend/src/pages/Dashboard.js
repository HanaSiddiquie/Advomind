// frontend/src/pages/Dashboard.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { colors, font, radius, shadow } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";
import { computeTotals, formatCurrency } from "../services/billing";

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Dashboard() {
  const court = localStorage.getItem("court");
  const { ownerId: userId, user, isLawyer } = useAuthRole();
  const navigate = useNavigate();

  const [clientsCount, setClientsCount] = useState(0);
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [balance, setBalance] = useState({ billed: 0, paid: 0, balance: 0 });
  const [loaded, setLoaded] = useState(false);

  const fetchStats = async () => {
    if (!court || !userId) return;

    try {
      const scopedOpts = { ownerId: userId, isLawyer, myUid: user?.uid, extraWhere: [where("court_type", "==", court)] };

      const [clientsSnap, caseList, hearingList, billingList, paymentList] = await Promise.all([
        getDocs(query(collection(db, "users", userId, "clients"), where("court_type", "==", court))),
        fetchScoped("cases", scopedOpts),
        fetchScoped("hearings", scopedOpts),
        fetchScoped("billingItems", scopedOpts),
        fetchScoped("payments", scopedOpts),
      ]);

      setClientsCount(clientsSnap.size);
      setCases(caseList);
      setHearings(hearingList);
      setBalance(computeTotals(billingList, paymentList));
    } catch (err) {
      console.error("DASHBOARD ERROR:", err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [court, userId, isLawyer]);

  const caseMap = useMemo(() => {
    const map = {};
    cases.forEach(c => (map[c.id] = c));
    return map;
  }, [cases]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);
  const weekAheadKey = toDateKey(new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000));

  const thisWeekHearings = useMemo(() => {
    return hearings
      .filter(h => h.date && h.date >= todayKey && h.date <= weekAheadKey)
      .sort((a, b) => a.date.localeCompare(b.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearings]);

  const onHoldCases = useMemo(() => cases.filter(c => c.status === "On Hold"), [cases]);

  const overdueHearings = useMemo(() => {
    return hearings
      .filter(h => h.date && h.date < todayKey)
      .filter(h => {
        const c = caseMap[h.case_id];
        return c && c.status !== "Closed";
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearings, caseMap]);

  const recentActivity = useMemo(() => {
    const caseEvents = cases.map(c => ({
      type: "case",
      label: `Case created: ${c.title}`,
      timestamp: c.createdAt || 0,
      link: `/cases/${c.id}`
    }));

    const hearingEvents = hearings.map(h => ({
      type: "hearing",
      label: `Hearing added: ${h.event}`,
      timestamp: h.createdAt || (h.date ? new Date(h.date).getTime() : 0),
      link: `/hearings/${h.id}`
    }));

    return [...caseEvents, ...hearingEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8);
  }, [cases, hearings]);

  const cards = [
    { label: "Clients", value: clientsCount },
    { label: "Cases", value: cases.length },
    { label: "Hearings", value: hearings.length },
    { label: "Outstanding Balance", value: formatCurrency(balance.balance), isMoney: true },
  ];

  if (!loaded) {
    return (
      <PageContainer eyebrow={court?.toUpperCase()} title="Dashboard" subtitle="Loading…">
        <p style={emptyText}>Loading…</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      eyebrow={court?.toUpperCase()}
      title="Dashboard"
      subtitle="An overview of your current caseload"
    >
      <div style={grid}>
        {cards.map((c) => (
          <div key={c.label} style={card}>
            <div style={cardLabel}>{c.label}</div>
            <div style={{ ...cardValue, fontSize: c.isMoney ? "26px" : "40px" }}>{c.value}</div>
            <div style={{ ...cardRule, background: c.isMoney && balance.balance > 0 ? colors.danger : colors.accent }} />
          </div>
        ))}
      </div>

      <h3 style={groupTitle}>This Week's Hearings</h3>
      {thisWeekHearings.length === 0 ? (
        <p style={emptyText}>No hearings in the next 7 days</p>
      ) : (
        <div style={listGrid}>
          {thisWeekHearings.map(h => (
            <Card key={h.id} hoverable onClick={() => navigate(`/hearings/${h.id}`)}>
              <Badge tone="accent">{h.date}</Badge>
              <div style={rowTitle}>{h.event}</div>
              <div style={rowMeta}>{caseMap[h.case_id]?.title || "Unknown case"}</div>
            </Card>
          ))}
        </div>
      )}

      <h3 style={groupTitle}>Needs Attention</h3>
      {onHoldCases.length === 0 && overdueHearings.length === 0 ? (
        <p style={emptyText}>Nothing needs attention right now</p>
      ) : (
        <div style={listGrid}>
          {onHoldCases.map(c => (
            <Card key={c.id} hoverable onClick={() => navigate(`/cases/${c.id}`)}>
              <Badge tone="neutral">On Hold</Badge>
              <div style={rowTitle}>{c.title}</div>
              <div style={rowMeta}>Case has been sitting on hold</div>
            </Card>
          ))}
          {overdueHearings.map(h => (
            <Card key={h.id} hoverable onClick={() => navigate(`/hearings/${h.id}`)}>
              <Badge tone="danger">Overdue</Badge>
              <div style={rowTitle}>{h.event}</div>
              <div style={rowMeta}>{h.date} · {caseMap[h.case_id]?.title || "Unknown case"} — status not updated since</div>
            </Card>
          ))}
        </div>
      )}

      <h3 style={groupTitle}>Recent Activity</h3>
      {recentActivity.length === 0 ? (
        <p style={emptyText}>Nothing recent yet</p>
      ) : (
        <div style={activityList}>
          {recentActivity.map((a, i) => (
            <div key={i} className="am-card-hover" style={activityRow} onClick={() => navigate(a.link)}>
              <Badge tone={a.type === "case" ? "dark" : "accent"}>{a.type === "case" ? "Case" : "Hearing"}</Badge>
              <span style={activityLabel}>{a.label}</span>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/* STYLES */

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
};

const card = {
  background: colors.surface,
  padding: "24px",
  borderRadius: radius.md,
  border: `1px solid ${colors.hairline}`,
  boxShadow: shadow.sm,
};

const cardLabel = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.slate,
  marginBottom: "10px",
};

const cardValue = {
  fontFamily: font.display,
  fontWeight: 600,
  color: colors.ink,
};

const cardRule = {
  marginTop: "14px",
  width: "28px",
  height: "3px",
  borderRadius: "2px",
};

const groupTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "28px 0 14px",
};

const listGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const rowTitle = {
  fontFamily: font.display,
  fontSize: "14px",
  fontWeight: 600,
  color: colors.ink,
  margin: "10px 0 4px",
};

const rowMeta = {
  fontSize: "12px",
  color: colors.slate,
};

const activityList = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const activityRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  background: colors.surface,
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  cursor: "pointer",
};

const activityLabel = {
  fontSize: "13px",
  color: colors.charcoal,
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default Dashboard;