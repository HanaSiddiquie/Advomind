import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function ArchivePage() {
  const [userId, setUserId] = useState(null);
  const [cases, setCases] = useState([]);
  const navigate = useNavigate();

  // AUTH
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid || null);
    });
    return () => unsub();
  }, []);

  // FETCH ARCHIVED CASES
  const fetchArchivedCases = async (uid) => {
    try {
      const q = query(
        collection(db, "archive"),
        where("userId", "==", uid)
      );

      const snap = await getDocs(q);

      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setCases(data);
    } catch (err) {
      console.error("Error fetching archive:", err);
    }
  };

  useEffect(() => {
    if (userId) fetchArchivedCases(userId);
  }, [userId]);

  return (
    <div style={page}>
      <h2 style={title}>📁 Archived Cases</h2>

      {cases.length === 0 ? (
        <div style={empty}>No archived cases found</div>
      ) : (
        <div style={grid}>
          {cases.map(c => (
            <div key={c.id} style={card}>
              
              <h3>{c.title || "Untitled Case"}</h3>

              <p>
                <b>Status:</b> {c.status}
              </p>

              <p>
                <b>Court:</b> {c.courtType || "N/A"}
              </p>

              <p style={{ fontSize: 12, opacity: 0.7 }}>
                Archived:{" "}
                {c.archivedAt
                  ? new Date(c.archivedAt).toLocaleString()
                  : "Unknown"}
              </p>

              <button
                style={btn}
                onClick={() => navigate(`/case/${c.originalCaseId}`)}
              >
                View Case
              </button>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== STYLES ========== */

const page = {
  padding: 25,
  background: "#f3f4f6",
  minHeight: "100vh"
};

const title = {
  marginBottom: 20
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
  gap: 15
};

const card = {
  background: "#fff",
  padding: 15,
  borderRadius: 10,
  boxShadow: "0 3px 10px rgba(0,0,0,0.08)"
};

const btn = {
  marginTop: 10,
  padding: 8,
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer"
};

const empty = {
  padding: 20,
  background: "#fff",
  borderRadius: 10
};

export default ArchivePage;