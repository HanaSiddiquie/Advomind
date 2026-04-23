import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

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

  return (
    <div style={container}>

      <h2>⚖️ Hearings Dashboard</h2>

      {/* STATS */}
      <div style={statsGrid}>
        <div style={cardStat}>
          <h3>{hearings.length}</h3>
          <p>Total Hearings</p>
        </div>

        <div style={{ ...cardStat, borderLeft: "5px solid green" }}>
          <h3>{upcoming.length}</h3>
          <p>Upcoming</p>
        </div>

        <div style={{ ...cardStat, borderLeft: "5px solid red" }}>
          <h3>{past.length}</h3>
          <p>Past / Overdue</p>
        </div>
      </div>

      {/* TODAY */}
      <h3 style={{ marginTop: "20px" }}>📅 Today</h3>

      {hearings.filter(h => isToday(h.date)).length === 0 ? (
        <p style={{ color: "gray" }}>No hearings today</p>
      ) : (
        hearings
          .filter(h => isToday(h.date))
          .map(h => (
            <div
              key={h.id}
              style={{ ...card, borderLeft: "5px solid orange" }}
              onClick={() => navigate(`/hearings/${h.id}`)}
            >
              <h3>{h.event}</h3>
              <p><b>Case:</b> {getCaseTitle(h.case_id)}</p>
              <p><b>Client:</b> {getClientName(h.case_id)}</p>
              <p><b>Date:</b> {h.date}</p>
            </div>
          ))
      )}

      {/* UPCOMING */}
      <h3 style={{ marginTop: "25px" }}>🟢 Upcoming Hearings</h3>

      {upcoming.length === 0 ? (
        <p style={{ color: "gray" }}>No upcoming hearings</p>
      ) : (
        upcoming.map(h => (
          <div
            key={h.id}
            style={card}
            onClick={() => navigate(`/hearings/${h.id}`)}
          >
            <h3>{h.event}</h3>
            <p><b>Case:</b> {getCaseTitle(h.case_id)}</p>
            <p><b>Client:</b> {getClientName(h.case_id)}</p>
            <p><b>Date:</b> {h.date}</p>
          </div>
        ))
      )}

      {/* PAST */}
      <h3 style={{ marginTop: "25px" }}>🔴 Past / Overdue Hearings</h3>

      {past.length === 0 ? (
        <p style={{ color: "gray" }}>No past hearings</p>
      ) : (
        past.map(h => (
          <div
            key={h.id}
            style={{ ...card, opacity: 0.85, borderLeft: "5px solid red" }}
            onClick={() => navigate(`/hearings/${h.id}`)}
          >
            <h3>{h.event}</h3>
            <p><b>Case:</b> {getCaseTitle(h.case_id)}</p>
            <p><b>Client:</b> {getClientName(h.case_id)}</p>
            <p><b>Date:</b> {h.date}</p>
          </div>
        ))
      )}
    </div>
  );
}

/* STYLES */
const container = {
  padding: "20px",
  background: "#f5f6fa",
  minHeight: "100vh"
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "15px"
};

const cardStat = {
  background: "white",
  padding: "15px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  borderLeft: "5px solid #4f46e5"
};

const card = {
  background: "white",
  padding: "15px",
  borderRadius: "12px",
  marginTop: "10px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  cursor: "pointer"
};

export default HearingsDashboard;