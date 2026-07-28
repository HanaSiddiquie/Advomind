// frontend/src/pages/ClientDetails.js
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  doc,
  updateDoc,
  addDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { colors, font, radius } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState(null);
  const court = localStorage.getItem("court");

  const [form, setForm] = useState({
    name: "",
    cnic: "",
    address: "",
    email: "",
    phone: ""
  });

  const [caseForm, setCaseForm] = useState({
    title: "",
    description: ""
  });

  /* ================= AUTH ================= */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });
    return () => unsub();
  }, []);

  /* ================= CLIENT ================= */
  const fetchClient = async (uid) => {
    const snap = await getDoc(doc(db, "users", uid, "clients", id));

    if (snap.exists()) {
      const data = snap.data();
      setClient(data);

      setForm({
        name: data.name || "",
        cnic: data.cnic || "",
        address: data.address || "",
        email: data.email || "",
        phone: ""
      });
    } else {
      setClient(null);
    }
  };

  /* ================= CASES ================= */
  const fetchCases = async (uid) => {
    if (!uid || !court || !id) return;

    const q = query(
      collection(db, "cases"),
      where("client_id", "==", id),
      where("userId", "==", uid),
      where("court_type", "==", court)
    );

    const snap = await getDocs(q);

    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    setCases(data);
  };

  /* ================= HEARINGS ================= */
  const fetchHearings = async (uid) => {
    if (!uid || !court) return;

    const q = query(
      collection(db, "hearings"),
      where("userId", "==", uid),
      where("court_type", "==", court)
    );

    const snap = await getDocs(q);

    setHearings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  /* ================= LOAD ================= */
  useEffect(() => {
    if (!userId || !id || !court) return;

    const load = async () => {
      setLoading(true);

      await Promise.all([
        fetchClient(userId),
        fetchCases(userId),
        fetchHearings(userId)
      ]);

      setLoading(false);
    };

    load();
  }, [id, userId, court]);

  /* ================= UPDATE CLIENT ================= */
  const updateClient = async () => {
    await updateDoc(doc(db, "users", userId, "clients", id), form);
    fetchClient(userId);
  };

  /* ================= ADD CASE ================= */
  const addCase = async () => {
    if (!caseForm.title || !userId) return;

    await addDoc(collection(db, "cases"), {
      client_id: id,
      title: caseForm.title,
      description: caseForm.description,
      status: "Open",
      court_type: court,
      userId
    });

    setCaseForm({ title: "", description: "" });
    fetchCases(userId);
  };

  /* ================= LOADING ================= */
  if (loading) return <PageContainer title="Client Dashboard"><p style={emptyText}>Loading…</p></PageContainer>;
  if (!client) return <PageContainer title="Client Dashboard"><p style={emptyText}>Client not found</p></PageContainer>;

  const clientCaseIds = cases.map(c => c.id);

  const clientHearings = hearings.filter(h =>
    clientCaseIds.includes(h.case_id)
  );

  return (
    <PageContainer eyebrow={court?.toUpperCase()} title={client.name || "Client Dashboard"}>
      <div style={grid}>

        {/* CLIENT INFO */}
        <Card>
          <h3 style={cardTitle}>Client Information</h3>

          <Input label="Full Name" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Full name"
          />

          <Input label="CNIC" value={form.cnic}
            onChange={e => setForm({ ...form, cnic: e.target.value })}
            placeholder="CNIC"
          />

          <Input label="Address" value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Address"
          />

          <Input label="Email" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
          />

          <Button onClick={updateClient} full>
            Save Changes
          </Button>
        </Card>

        {/* ADD CASE */}
        <Card>
          <h3 style={cardTitle}>Add Case</h3>

          <Input label="Case Title"
            value={caseForm.title}
            onChange={e => setCaseForm({ ...caseForm, title: e.target.value })}
            placeholder="Case title"
          />

          <label style={selectLabel}>Description</label>
          <textarea
            className="am-input"
            style={textareaStyle}
            value={caseForm.description}
            onChange={e => setCaseForm({ ...caseForm, description: e.target.value })}
            placeholder="Case description"
          />

          <Button onClick={addCase} full>
            Create Case
          </Button>
        </Card>

      </div>

      {/* CASES */}
      <Card style={{ marginTop: 20 }}>
        <h3 style={cardTitle}>Cases</h3>

        <div style={cardGrid}>
          {cases.length === 0 ? (
            <p style={emptyText}>No cases found for this client</p>
          ) : (
            cases.map(c => (
              <div
                key={c.id}
                className="am-card-hover"
                style={miniCard}
                onClick={() => navigate(`/cases/${c.id}`)}
              >
                <h4 style={miniCardTitle}>{c.title}</h4>
                <Badge tone="accent">{c.status}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* HEARINGS */}
      <Card style={{ marginTop: 20 }}>
        <h3 style={cardTitle}>Hearings</h3>

        {clientHearings.length === 0 ? (
          <p style={emptyText}>No hearings</p>
        ) : (
          <div style={cardGrid}>
            {clientHearings.map(h => (
              <div key={h.id} style={miniCard}>
                <h4 style={miniCardTitle}>{h.event}</h4>
                <p style={miniCardMeta}>{h.date}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

    </PageContainer>
  );
}

/* ================= STYLES ================= */

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px",
};

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

const textareaStyle = {
  boxSizing: "border-box",
  width: "100%",
  padding: "11px 13px",
  marginBottom: "14px",
  minHeight: "80px",
  resize: "vertical",
  fontFamily: font.body,
  fontSize: "14px",
  color: colors.ink,
  background: colors.surface,
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.sm,
  outline: "none",
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "10px",
};

const miniCard = {
  background: colors.paper,
  padding: "14px",
  borderRadius: radius.sm,
  border: `1px solid ${colors.hairline}`,
  cursor: "pointer",
};

const miniCardTitle = {
  fontFamily: font.display,
  fontSize: "14px",
  fontWeight: 600,
  color: colors.ink,
  margin: "0 0 6px",
};

const miniCardMeta = {
  fontSize: "12px",
  color: colors.slate,
  margin: 0,
};

const emptyText = {
  color: colors.slate,
  fontSize: "13px",
};

export default ClientDetails;