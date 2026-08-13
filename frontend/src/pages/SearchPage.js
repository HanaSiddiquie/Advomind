// frontend/src/pages/SearchPage.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { colors, font } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Badge from "../components/ui/Badge";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";

function includesTerm(value, term) {
  return (value || "").toString().toLowerCase().includes(term);
}

function SearchPage() {
  const { ownerId: userId, user, isLawyer } = useAuthRole();
  const court = localStorage.getItem("court");
  const navigate = useNavigate();

  const [term, setTerm] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!userId || !court) return;

      const scopedOpts = { ownerId: userId, isLawyer, myUid: user?.uid, extraWhere: [where("court_type", "==", court)] };

      const [clientSnap, caseList, hearingList, fileList] = await Promise.all([
        getDocs(query(collection(db, "users", userId, "clients"), where("court_type", "==", court))),
        fetchScoped("cases", scopedOpts),
        fetchScoped("hearings", scopedOpts),
        fetchScoped("files", scopedOpts),
      ]);

      setClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCases(caseList);
      setHearings(hearingList);
      setFiles(fileList);
      setLoaded(true);
    };

    load();
  }, [userId, court, isLawyer]);

  const caseMap = useMemo(() => {
    const map = {};
    cases.forEach(c => (map[c.id] = c));
    return map;
  }, [cases]);

  const q = term.trim().toLowerCase();

  const matchedClients = useMemo(() => {
    if (!q) return [];
    return clients.filter(c =>
      includesTerm(c.name, q) || includesTerm(c.cnic, q) || includesTerm(c.phone, q)
    );
  }, [clients, q]);

  const matchedCases = useMemo(() => {
    if (!q) return [];
    return cases.filter(c =>
      includesTerm(c.title, q) || includesTerm(c.description, q)
    );
  }, [cases, q]);

  const matchedHearings = useMemo(() => {
    if (!q) return [];
    return hearings.filter(h =>
      includesTerm(h.event, q) || includesTerm(h.notes, q)
    );
  }, [hearings, q]);

  const matchedFiles = useMemo(() => {
    if (!q) return [];
    return files.filter(f => includesTerm(f.name, q));
  }, [files, q]);

  const totalResults = matchedClients.length + matchedCases.length + matchedHearings.length + matchedFiles.length;

  return (
    <PageContainer
      eyebrow={court?.toUpperCase()}
      title="Search"
      subtitle="Search across clients, cases, hearings, and files in this court"
    >
      <Input
        placeholder="Start typing a name, case title, CNIC, hearing, or file..."
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        style={{ marginBottom: 22 }}
      />

      {!loaded && <p style={emptyText}>Loading...</p>}

      {loaded && !q && (
        <p style={emptyText}>Type at least one character to search.</p>
      )}

      {loaded && q && totalResults === 0 && (
        <p style={emptyText}>No results for "{term}"</p>
      )}

      {matchedClients.length > 0 && (
        <div>
          <h3 style={groupTitle}>Clients ({matchedClients.length})</h3>
          <div style={grid}>
            {matchedClients.map(c => (
              <Card key={c.id} hoverable onClick={() => navigate(`/clients/${c.id}`)}>
                <Badge tone="accent">Client</Badge>
                <div style={resultTitle}>{c.name}</div>
                <div style={resultMeta}>CNIC: {c.cnic}</div>
                {c.phone ? <div style={resultMeta}>{c.phone}</div> : null}
              </Card>
            ))}
          </div>
        </div>
      )}

      {matchedCases.length > 0 && (
        <div>
          <h3 style={groupTitle}>Cases ({matchedCases.length})</h3>
          <div style={grid}>
            {matchedCases.map(c => (
              <Card key={c.id} hoverable onClick={() => navigate(`/cases/${c.id}`)}>
                <Badge tone="dark">Case</Badge>
                <div style={resultTitle}>{c.title}</div>
                {c.description ? <div style={resultMeta}>{c.description.slice(0, 80)}</div> : null}
              </Card>
            ))}
          </div>
        </div>
      )}

      {matchedHearings.length > 0 && (
        <div>
          <h3 style={groupTitle}>Hearings ({matchedHearings.length})</h3>
          <div style={grid}>
            {matchedHearings.map(h => (
              <Card key={h.id} hoverable onClick={() => navigate(`/hearings/${h.id}`)}>
                <Badge tone="success">Hearing</Badge>
                <div style={resultTitle}>{h.event}</div>
                <div style={resultMeta}>
                  {h.date} - {caseMap[h.case_id] ? caseMap[h.case_id].title : "Unknown case"}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {matchedFiles.length > 0 && (
        <div>
          <h3 style={groupTitle}>Files ({matchedFiles.length})</h3>
          <div style={grid}>
            {matchedFiles.map(f => (
              <Card key={f.id} hoverable onClick={() => navigate(`/cases/${f.case_id}`)}>
                <Badge tone="neutral">File</Badge>
                <div style={resultTitle}>{f.name}</div>
                <div style={resultMeta}>
                  In: {caseMap[f.case_id] ? caseMap[f.case_id].title : "Unknown case"}
                </div>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={fileLink}
                >
                  Open file
                </a>
              </Card>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

const groupTitle = {
  fontFamily: font.display,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.ink,
  margin: "20px 0 12px",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const resultTitle = {
  fontFamily: font.display,
  fontWeight: 600,
  fontSize: "14px",
  color: colors.ink,
  margin: "8px 0 4px",
};

const resultMeta = {
  fontSize: "12px",
  color: colors.slate,
  marginTop: 2,
};

const fileLink = {
  display: "inline-block",
  marginTop: 8,
  fontSize: "12px",
  fontWeight: 600,
  color: colors.accent,
  textDecoration: "none",
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default SearchPage;



