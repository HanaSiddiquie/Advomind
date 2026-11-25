// frontend/src/pages/OutstandingPayments.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { where } from "firebase/firestore";
import { colors, font } from "../styles/theme";
import PageContainer from "../components/ui/PageContainer";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Loading from "../components/ui/Loading";
import { useAuthRole } from "../context/AuthRoleContext";
import { fetchScoped } from "../services/scopedQuery";
import { computeItemAmount, formatCurrency } from "../services/billing";

function OutstandingPayments() {
  const court = localStorage.getItem("court");
  const { ownerId: userId, user, isLawyer } = useAuthRole();
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!court || !userId) return;
    (async () => {
      try {
        const opts = { ownerId: userId, isLawyer, myUid: user?.uid, extraWhere: [where("court_type", "==", court)] };
        const [caseList, billingList, paymentList] = await Promise.all([
          fetchScoped("cases", opts),
          fetchScoped("billingItems", opts),
          fetchScoped("payments", opts),
        ]);
        setCases(caseList);
        setItems(billingList);
        setPayments(paymentList);
      } catch (err) {
        console.error("OUTSTANDING ERROR:", err);
        setFailed(true);
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [court, userId, isLawyer]);

  const rows = useMemo(() => {
    const caseMap = {};
    cases.forEach((c) => (caseMap[c.id] = c));

    const byCase = {};
    const slot = (id) => {
      if (!byCase[id]) byCase[id] = { caseId: id, billed: 0, paid: 0 };
      return byCase[id];
    };
    items.forEach((i) => { slot(i.case_id || i.caseId || "none").billed += computeItemAmount(i); });
    payments.forEach((p) => { slot(p.case_id || p.caseId || "none").paid += Number(p.amount) || 0; });

    return Object.values(byCase)
      .map((r) => {
        const c = caseMap[r.caseId];
        return {
          ...r,
          due: r.billed - r.paid,
          title: c ? c.title : "Case not found",
          client: c ? (c.client_name || c.clientName || c.client || "") : "",
          exists: !!c,
        };
      })
      .filter((r) => r.due > 0)
      .sort((a, b) => b.due - a.due);
  }, [cases, items, payments]);

  const total = rows.reduce((sum, r) => sum + r.due, 0);

  if (!loaded) {
    return (
      <PageContainer eyebrow={court?.toUpperCase()} title="Outstanding Payments"><Loading /></PageContainer>
    );
  }

  return (
    <PageContainer
      eyebrow={court?.toUpperCase()}
      title="Outstanding Payments"
      subtitle="Cases where the billed amount is more than what has been paid"
    >
      {failed ? (
        <p style={emptyText}>Couldn't load payments. Please refresh and try again.</p>
      ) : rows.length === 0 ? (
        <p style={emptyText}>Nothing outstanding — all billed amounts have been paid.</p>
      ) : (
        <>
          <div style={totalBox}>
            <div style={totalLabel}>Total outstanding</div>
            <div style={totalValue}>{formatCurrency(total)}</div>
            <div style={totalMeta}>across {rows.length} case{rows.length === 1 ? "" : "s"}</div>
          </div>

          <div style={listGrid}>
            {rows.map((r) => (
              <Card
                key={r.caseId}
                hoverable={r.exists}
                onClick={r.exists ? () => navigate(`/cases/${r.caseId}`) : undefined}
              >
                <Badge tone="danger">{formatCurrency(r.due)} due</Badge>
                <div style={rowTitle}>{r.title}</div>
                {r.client && <div style={rowMeta}>{r.client}</div>}
                <div style={rowMeta}>
                  Billed {formatCurrency(r.billed)} · Paid {formatCurrency(r.paid)}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}

const listGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 };
const totalBox = { marginBottom: 20 };
const totalLabel = { fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: colors.slate };
const totalValue = { fontFamily: font.display, fontSize: "30px", fontWeight: 600, color: colors.danger, margin: "6px 0 2px" };
const totalMeta = { fontSize: "13px", color: colors.slate };
const rowTitle = { fontFamily: font.display, fontSize: "15px", fontWeight: 600, color: colors.ink, margin: "10px 0 4px" };
const rowMeta = { fontSize: "12px", color: colors.slate, marginTop: 2 };
const emptyText = { color: colors.slate, fontSize: "13px" };

export default OutstandingPayments;