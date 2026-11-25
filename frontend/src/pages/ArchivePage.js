// frontend/src/pages/ArchivePage.js
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors, font } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Loading from "../components/ui/Loading";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";
import { classLabel, classTone, matchesClass } from "../utils/caseClass";

function ArchivePage() {
  const { ownerId: userId, user, isLawyer } = useAuthRole();
  const [cases, setCases] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const navigate = useNavigate();

  // FETCH ARCHIVED CASES
  const fetchArchivedCases = async (uid) => {
    try {
      const data = await fetchScoped("archive", { ownerId: uid, isLawyer, myUid: user?.uid });
      setCases(data);
    } catch (err) {
      console.error("Error fetching archive:", err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (userId) fetchArchivedCases(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isLawyer]);

  const q = search.trim().toLowerCase();
    const shown = cases.filter(c =>
    matchesClass(c, classFilter) &&
    (!q ||
      [c.title, c.status, c.court_type, c.courtType, c.description, classLabel(c.case_class)]
        .some(v => String(v || "").toLowerCase().includes(q)))
  );

  return (
    <PageContainer title="Archived Cases" subtitle="Closed cases across all courts">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 240px" }}>
          <Input
            type="search"
            placeholder="Search archived cases by title, court or status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="am-input"
          aria-label="Filter by case type"
          style={filterSelect}
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="All">Civil &amp; Criminal</option>
          <option value="civil">Civil</option>
          <option value="criminal">Criminal</option>
          <option value="unclassified">Unclassified</option>
        </select>
      </div>

      {!loaded ? (
        <Loading />
      ) : cases.length === 0 ? (
        <p style={emptyText}>No archived cases found</p>
      ) : shown.length === 0 ? (
        <p style={emptyText}>No archived cases match your search.</p>
      ) : (
        <div style={grid}>
          {shown.map(c => (
            <Card key={c.id}>
              <h3 style={caseTitle}>{c.title || "Untitled Case"}</h3>

              <p style={row}><span style={label}>Status</span> {c.status}</p>
              <p style={row}><span style={label}>Court</span> {c.court_type?.toUpperCase() || c.courtType || "N/A"}</p>

                <div style={{ margin: "10px 0 4px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Badge tone={classTone(c.case_class)}>{classLabel(c.case_class)}</Badge>
                <Badge tone="neutral">
                  Archived {c.archivedAt ? new Date(c.archivedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "date unknown"}
                </Badge>
              </div>

              <Button
                variant="dark"
                full
                style={{ marginTop: 12 }}
                onClick={() => navigate(`/cases/${c.originalCaseId}`)}
              >
                View Case
              </Button>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/* ========== STYLES ========== */

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
  gap: 14,
};

const caseTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 10px",
};

const row = {
  fontSize: "13px",
  color: colors.charcoal,
  margin: "4px 0",
};

const label = {
  color: colors.slate,
  fontWeight: 600,
  marginRight: "4px",
};

const filterSelect = {
  boxSizing: "border-box",
  minWidth: 150,
  padding: "11px 13px",
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

export default ArchivePage;