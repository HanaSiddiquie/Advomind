// frontend/src/pages/CourtDayPrep.js
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { colors, font } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";
import { CMS_URL } from "../services/cms";

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CourtDayPrep() {
  const { ownerId: userId, user, isLawyer } = useAuthRole();
  const court = localStorage.getItem("court");
  const navigate = useNavigate();

  const [hearings, setHearings] = useState([]);
  const [events, setEvents] = useState([]);
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const today = todayKey();

  const fetchData = async () => {
    if (!userId || !court) return;

    try {
      const scopedOpts = { ownerId: userId, isLawyer, myUid: user?.uid, extraWhere: [where("court_type", "==", court)] };

      const [hearingList, caseList, eventSnap, clientSnap] = await Promise.all([
        fetchScoped("hearings", scopedOpts),
        fetchScoped("cases", scopedOpts),
        getDocs(query(collection(db, "diaryEvents"), where("userId", "==", userId), where("court_type", "==", court))),
        getDocs(query(collection(db, "users", userId, "clients"), where("court_type", "==", court))),
      ]);

      setHearings(hearingList.filter(h => h.date === today));
      setEvents(eventSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.date === today));
      setCases(caseList);
      setClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Court Day Prep fetch error:", err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, court, isLawyer]);

  const getCase = (caseId) => cases.find(c => c.id === caseId);
  const getCaseTitle = (caseId) => getCase(caseId)?.title || "Unknown Case";
  const getClientName = (caseId) => {
    const c = getCase(caseId);
    if (!c) return "Unknown Client";
    const client = clients.find(cl => cl.id === c.client_id);
    return client ? client.name : "Unknown Client";
  };

  const todayFormatted = new Date().toLocaleDateString("default", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  if (!loaded) {
    return (
      <PageContainer title="Court Day Prep" subtitle="Loading...">
        <p style={emptyText}>Loading...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      eyebrow={court?.toUpperCase()}
      title="Court Day Prep"
      subtitle={todayFormatted}
      action={
        <a href={CMS_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <Button variant="dark">Open CMS</Button>
        </a>
      }
    >
      <p style={intro}>
        Everything scheduled in Advomind for today, on this court - a quick reference to
        cross-check against the official CMS cause list before heading in.
      </p>

      <h3 style={groupTitle}>Hearings Today ({hearings.length})</h3>

      {hearings.length === 0 ? (
        <p style={emptyText}>No hearings scheduled today</p>
      ) : (
        <div style={grid}>
          {hearings.map(h => (
            <Card key={h.id} hoverable onClick={() => navigate(`/hearings/${h.id}`)}>
              <Badge tone="accent">Hearing</Badge>
              <h4 style={cardTitle}>{h.event}</h4>
              <p style={cardMeta}>Case: {getCaseTitle(h.case_id)}</p>
              <p style={cardMeta}>Client: {getClientName(h.case_id)}</p>
              {h.notes && <p style={cardMeta}>{h.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <h3 style={groupTitle}>Other Events Today ({events.length})</h3>

      {events.length === 0 ? (
        <p style={emptyText}>No other events today</p>
      ) : (
        <div style={grid}>
          {events.map(e => (
            <Card key={e.id}>
              <Badge tone="dark">Event</Badge>
              <h4 style={cardTitle}>{e.title}</h4>
              {e.notes && <p style={cardMeta}>{e.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

const intro = {
  fontSize: "13px",
  color: colors.slate,
  marginBottom: 24,
  maxWidth: 560,
  lineHeight: 1.5,
};

const groupTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "24px 0 12px",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const cardTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "10px 0 6px",
};

const cardMeta = {
  fontSize: "13px",
  color: colors.charcoal,
  margin: "2px 0",
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default CourtDayPrep;