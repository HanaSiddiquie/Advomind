// frontend/src/pages/Diary.js
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { colors, font, radius, shadow } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_COURTS = ["civil", "session", "high"];

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Diary() {
  const { ownerId: userId, user, isLawyer, assignedCourts, canDelete } = useAuthRole();
  const activeCourt = localStorage.getItem("court");

  const [scope, setScope] = useState("current"); // "current" | "all"

  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [hearings, setHearings] = useState([]);
  const [events, setEvents] = useState([]);

  const [newEvent, setNewEvent] = useState({ title: "", notes: "" });

  const courtsInScope = scope === "current"
    ? [activeCourt].filter(Boolean)
    : (isLawyer ? ALL_COURTS : (assignedCourts || []));

  const fetchHearings = async () => {
    if (!userId || courtsInScope.length === 0) return;

    const lists = await Promise.all(
      courtsInScope.map(c =>
        fetchScoped("hearings", {
          ownerId: userId,
          isLawyer,
          myUid: user?.uid,
          extraWhere: [where("court_type", "==", c)]
        })
      )
    );

    setHearings(lists.flat());
  };

  const fetchEvents = async () => {
    if (!userId || courtsInScope.length === 0) return;

    const snaps = await Promise.all(
      courtsInScope.map(c =>
        getDocs(query(
          collection(db, "diaryEvents"),
          where("userId", "==", userId),
          where("court_type", "==", c)
        ))
      )
    );

    setEvents(snaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  };

  useEffect(() => {
    fetchHearings();
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, scope, activeCourt, isLawyer, JSON.stringify(assignedCourts)]);

  const hearingsByDate = useMemo(() => {
    const map = {};
    hearings.forEach(h => {
      if (!h.date) return;
      if (!map[h.date]) map[h.date] = [];
      map[h.date].push(h);
    });
    return map;
  }, [hearings]);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(e => {
      if (!e.date) return;
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPastDate = (dateStr) => new Date(dateStr + "T00:00:00") < today;

  const stats = useMemo(() => {
    const upcoming = hearings.filter(h => h.date && !isPastDate(h.date));
    const past = hearings.filter(h => h.date && isPastDate(h.date));
    return { total: hearings.length, upcoming: upcoming.length, past: past.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearings]);

  const addEvent = async () => {
    if (!newEvent.title.trim()) {
      alert("Give the event a title first");
      return;
    }
    if (scope !== "current") {
      alert("Switch to 'This Court' to add an event.");
      return;
    }

    await addDoc(collection(db, "diaryEvents"), {
      userId,
      court_type: activeCourt,
      date: selectedDate,
      title: newEvent.title,
      notes: newEvent.notes,
      createdBy: user.uid,
      createdAt: Date.now()
    });

    setNewEvent({ title: "", notes: "" });
    fetchEvents();
  };

  const deleteEvent = async (id) => {
    await deleteDoc(doc(db, "diaryEvents", id));
    fetchEvents();
  };

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goToMonth = (delta) => {
    setViewMonth(new Date(year, month + delta, 1));
  };

  const todayKey = toDateKey(new Date());
  const selectedHearings = hearingsByDate[selectedDate] || [];
  const selectedEvents = eventsByDate[selectedDate] || [];

  const allDates = useMemo(() => {
    const set = new Set([...Object.keys(hearingsByDate), ...Object.keys(eventsByDate)]);
    return Array.from(set).sort();
  }, [hearingsByDate, eventsByDate]);

  const jumpToDate = (dateKey) => {
    setSelectedDate(dateKey);
    const [y, m] = dateKey.split("-").map(Number);
    setViewMonth(new Date(y, m - 1, 1));
  };

  if (!userId) return <PageContainer title="Case Diary"><p style={emptyText}>Loading…</p></PageContainer>;

  return (
    <PageContainer
      eyebrow={scope === "current" ? activeCourt?.toUpperCase() : "ALL COURTS"}
      title="Case Diary"
      subtitle="A calendar of hearings and events across your caseload"
      action={
        <div style={toggleRow}>
          <button
            className="am-btn"
            onClick={() => setScope("current")}
            style={scope === "current" ? toggleBtnActive : toggleBtn}
          >
            This Court
          </button>
          <button
            className="am-btn"
            onClick={() => setScope("all")}
            style={scope === "all" ? toggleBtnActive : toggleBtn}
          >
            All Courts
          </button>
        </div>
      }
    >
      <div style={statsGrid}>
        <div style={{ ...cardStat, borderLeftColor: colors.ink }}>
          <div style={statValue}>{stats.total}</div>
          <div style={statLabel}>Total Hearings</div>
        </div>
        <div style={{ ...cardStat, borderLeftColor: colors.success }}>
          <div style={statValue}>{stats.upcoming}</div>
          <div style={statLabel}>Upcoming</div>
        </div>
        <div style={{ ...cardStat, borderLeftColor: colors.danger }}>
          <div style={statValue}>{stats.past}</div>
          <div style={statLabel}>Past / Overdue</div>
        </div>
      </div>

      <div style={layout}>

        <Card>
          <div style={monthHeader}>
            <button className="am-btn" onClick={() => goToMonth(-1)} style={navBtn}>‹</button>
            <div style={monthLabel}>
              {viewMonth.toLocaleString("default", { month: "long", year: "numeric" })}
            </div>
            <button className="am-btn" onClick={() => goToMonth(1)} style={navBtn}>›</button>
          </div>

          <div style={weekRow}>
            {WEEKDAYS.map(w => (
              <div key={w} style={weekdayCell}>{w}</div>
            ))}
          </div>

          <div style={grid}>
            {cells.map((d, i) => {
              if (d === null) return <div key={`blank-${i}`} style={dayCellEmpty} />;

              const dateKey = toDateKey(new Date(year, month, d));
              const hasHearing = !!hearingsByDate[dateKey];
              const hasEvent = !!eventsByDate[dateKey];
              const isSelected = dateKey === selectedDate;
              const isToday = dateKey === todayKey;

              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDate(dateKey)}
                  style={{
                    ...dayCell,
                    ...(isSelected ? dayCellSelected : {}),
                    ...(isToday && !isSelected ? dayCellToday : {})
                  }}
                >
                  <span>{d}</span>
                  <div style={dotRow}>
                    {hasHearing && <span style={{ ...dot, background: colors.accent }} />}
                    {hasEvent && <span style={{ ...dot, background: colors.ink }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 style={panelTitle}>
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("default", {
              weekday: "long", month: "long", day: "numeric", year: "numeric"
            })}
          </h3>

          {selectedHearings.length === 0 && selectedEvents.length === 0 && (
            <p style={emptyText}>Nothing scheduled for this day</p>
          )}

          {selectedHearings.map(h => (
            <div key={h.id} style={entryRow}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Badge tone="accent">Hearing</Badge>
                {scope === "all" && <Badge tone="neutral">{(h.court_type || "").toUpperCase()}</Badge>}
              </div>
              <div style={entryTitle}>{h.event}</div>
              {h.notes && <div style={entryMeta}>{h.notes}</div>}
            </div>
          ))}

          {selectedEvents.map(e => (
            <div key={e.id} style={entryRow}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Badge tone="dark">Event</Badge>
                <div style={{ display: "flex", gap: 6 }}>
                  {scope === "all" && <Badge tone="neutral">{(e.court_type || "").toUpperCase()}</Badge>}
                  {canDelete && (
                    <button className="am-btn" onClick={() => deleteEvent(e.id)} style={deleteLink}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div style={entryTitle}>{e.title}</div>
              {e.notes && <div style={entryMeta}>{e.notes}</div>}
            </div>
          ))}

          {scope === "current" ? (
            <>
              <h4 style={addTitle}>Add Event</h4>

              <Input
                label="Title"
                placeholder="e.g. Client meeting"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />

              <label style={selectLabel}>Notes</label>
              <textarea
                className="am-input"
                placeholder="Optional notes"
                value={newEvent.notes}
                onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                style={textareaStyle}
              />

              <Button onClick={addEvent} full>
                Add to {new Date(selectedDate + "T00:00:00").toLocaleDateString("default", { month: "short", day: "numeric" })}
              </Button>
            </>
          ) : (
            <p style={{ ...emptyText, marginTop: 18 }}>
              Switch to "This Court" to add a new event.
            </p>
          )}
        </Card>

      </div>

      <h3 style={listHeading}>All Scheduled Items</h3>

      {allDates.length === 0 ? (
        <p style={emptyText}>Nothing scheduled yet</p>
      ) : (
        allDates.map(dateKey => (
          <div key={dateKey} style={dayBlock}>
            <button
              onClick={() => jumpToDate(dateKey)}
              className="am-btn"
              style={{
                ...dateChip,
                ...(dateKey === selectedDate ? dateChipActive : {})
              }}
            >
              {new Date(dateKey + "T00:00:00").toLocaleDateString("default", {
                weekday: "short", month: "short", day: "numeric", year: "numeric"
              })}
            </button>

            {(hearingsByDate[dateKey] || []).map(h => (
              <div key={h.id} style={listRow} onClick={() => jumpToDate(dateKey)}>
                <Badge tone="accent">Hearing</Badge>
                {scope === "all" && <Badge tone="neutral" style={{ marginLeft: 6 }}>{(h.court_type || "").toUpperCase()}</Badge>}
                <div style={entryTitle}>{h.event}</div>
                {h.notes && <div style={entryMeta}>{h.notes}</div>}
              </div>
            ))}

            {(eventsByDate[dateKey] || []).map(e => (
              <div key={e.id} style={listRow} onClick={() => jumpToDate(dateKey)}>
                <Badge tone="dark">Event</Badge>
                {scope === "all" && <Badge tone="neutral" style={{ marginLeft: 6 }}>{(e.court_type || "").toUpperCase()}</Badge>}
                <div style={entryTitle}>{e.title}</div>
                {e.notes && <div style={entryMeta}>{e.notes}</div>}
              </div>
            ))}
          </div>
        ))
      )}
    </PageContainer>
  );
}

/* ================= STYLES ================= */

const toggleRow = { display: "flex", gap: 6 };

const toggleBtn = {
  padding: "8px 14px",
  borderRadius: radius.sm,
  border: `1px solid ${colors.hairline}`,
  background: colors.surface,
  color: colors.charcoal,
  fontFamily: font.body,
  fontSize: "13px",
  fontWeight: 600,
};

const toggleBtnActive = {
  ...toggleBtn,
  background: colors.ink,
  color: colors.white,
  border: `1px solid ${colors.ink}`,
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "14px",
  marginBottom: 20,
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

const layout = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1fr",
  gap: 20,
  alignItems: "start",
};

const monthHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
};

const monthLabel = {
  fontFamily: font.display,
  fontSize: "16px",
  fontWeight: 600,
  color: colors.ink,
};

const navBtn = {
  background: colors.paper,
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  width: 32,
  height: 32,
  fontSize: 16,
  color: colors.ink,
};

const weekRow = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  marginBottom: 6,
};

const weekdayCell = {
  textAlign: "center",
  fontSize: "11px",
  fontWeight: 700,
  color: colors.slate,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "4px 0",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 4,
};

const dayCellEmpty = { minHeight: 56 };

const dayCell = {
  minHeight: 56,
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  padding: "6px 8px",
  fontSize: "13px",
  color: colors.charcoal,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const dayCellSelected = {
  background: colors.ink,
  color: colors.white,
  border: `1px solid ${colors.ink}`,
};

const dayCellToday = {
  border: `1px solid ${colors.accent}`,
};

const dotRow = {
  display: "flex",
  gap: 3,
};

const dot = {
  width: 6,
  height: 6,
  borderRadius: "50%",
};

const panelTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 14px",
};

const listHeading = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "28px 0 14px",
};

const dayBlock = {
  marginBottom: 18,
};

const dateChip = {
  background: colors.ink,
  color: colors.white,
  fontFamily: font.body,
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.03em",
  padding: "7px 14px",
  borderRadius: radius.sm,
  marginBottom: 8,
};

const dateChipActive = {
  background: colors.accent,
};

const listRow = {
  padding: "10px 12px",
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  marginTop: 6,
  background: colors.surface,
  cursor: "pointer",
};

const entryRow = {
  padding: "10px 12px",
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  marginBottom: 10,
  background: colors.paper,
};

const entryTitle = {
  fontFamily: font.display,
  fontWeight: 600,
  fontSize: "13px",
  color: colors.ink,
  marginTop: 6,
};

const entryMeta = {
  fontSize: "12px",
  color: colors.slate,
  marginTop: 4,
};

const deleteLink = {
  background: "transparent",
  border: "none",
  color: colors.danger,
  fontSize: "11px",
  fontWeight: 700,
  padding: 0,
};

const addTitle = {
  fontFamily: font.display,
  fontSize: "13px",
  fontWeight: 600,
  color: colors.ink,
  margin: "18px 0 10px",
  borderTop: `1px solid ${colors.hairline}`,
  paddingTop: 16,
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
  minHeight: "70px",
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

export default Diary;