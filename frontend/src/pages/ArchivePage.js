// frontend/src/pages/ArchivePage.js
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors, font } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";

function ArchivePage() {
  const { ownerId: userId, user, isLawyer } = useAuthRole();
  const [cases, setCases] = useState([]);
  const navigate = useNavigate();

  // FETCH ARCHIVED CASES
  const fetchArchivedCases = async (uid) => {
    try {
      const data = await fetchScoped("archive", { ownerId: uid, isLawyer, myUid: user?.uid });
      setCases(data);
    } catch (err) {
      console.error("Error fetching archive:", err);
    }
  };

  useEffect(() => {
    if (userId) fetchArchivedCases(userId);
  }, [userId, isLawyer]);

  return (
    <PageContainer title="Archived Cases" subtitle="Closed cases across all courts">
      {cases.length === 0 ? (
        <p style={emptyText}>No archived cases found</p>
      ) : (
        <div style={grid}>
          {cases.map(c => (
            <Card key={c.id}>
              <h3 style={caseTitle}>{c.title || "Untitled Case"}</h3>

              <p style={row}><span style={label}>Status</span> {c.status}</p>
              <p style={row}><span style={label}>Court</span> {c.court_type?.toUpperCase() || c.courtType || "N/A"}</p>

              <div style={{ margin: "10px 0 4px" }}>
                <Badge tone="neutral">
                  Archived {c.archivedAt ? new Date(c.archivedAt).toLocaleDateString() : "date unknown"}
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

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default ArchivePage;