import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function Cases() {
  const [cases, setCases] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const navigate = useNavigate();

  // =========================
  // FETCH CASES
  // =========================
  const fetchCases = () => {
    API.get("/cases")
      .then(res => setCases(res.data.data || []))
      .catch(err => console.log(err));
  };

  useEffect(() => {
    fetchCases();
  }, []);

  // =========================
  // NORMALIZE STATUS (IMPORTANT FIX)
  // =========================
  const normalizeStatus = (status) =>
    (status || "Open").toLowerCase().trim();

  // =========================
  // FILTER CASES
  // =========================
  const filteredCases = cases.filter(c => {
    const title = (c.title || "").toLowerCase();
    const id = (c.id || "").toLowerCase();
    const status = normalizeStatus(c.status);

    const matchesSearch =
      title.includes(search.toLowerCase()) ||
      id.includes(search.toLowerCase());

    const matchesFilter =
      filter === "ALL"
        ? true
        : status === filter.toLowerCase();

    return matchesSearch && matchesFilter;
  });

  // =========================
  // STATS (FIXED)
  // =========================
  const total = cases.length;

  const open = cases.filter(
    c => normalizeStatus(c.status) === "open"
  ).length;

  const closed = cases.filter(
    c => normalizeStatus(c.status) === "closed"
  ).length;

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>
      
      <h2>📁 Cases Dashboard</h2>

      {/* STATS */}
      <div style={statsGrid}>
        <div style={statCard}>
          <h3>{total}</h3>
          <p>Total Cases</p>
        </div>

        <div style={{ ...statCard, borderLeft: "5px solid orange" }}>
          <h3>{open}</h3>
          <p>Open Cases</p>
        </div>

        <div style={{ ...statCard, borderLeft: "5px solid green" }}>
          <h3>{closed}</h3>
          <p>Closed Cases</p>
        </div>
      </div>

      {/* SEARCH + FILTER */}
      <div style={controlBar}>
        <input
          style={searchBox}
          placeholder="🔍 Search cases..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div style={{ display: "flex", gap: "10px" }}>
          {["ALL", "Open", "Closed"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...filterBtn,
                background: filter === f ? "#4f46e5" : "white",
                color: filter === f ? "white" : "black"
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* CARDS */}
      <div style={grid}>
        {filteredCases.length === 0 ? (
          <p style={{ color: "gray" }}>No cases found</p>
        ) : (
          filteredCases.map(c => (
            <div
              key={c.id}
              style={card}
              onClick={() => navigate(`/cases/${c.id}`)}
            >
              <h3>{c.title}</h3>

              <p><b>ID:</b> {c.id}</p>

              <p>
                <b>Status:</b>{" "}
                <span style={{
                  color:
                    normalizeStatus(c.status) === "closed"
                      ? "green"
                      : "orange"
                }}>
                  {c.status || "Open"}
                </span>
              </p>

              <p style={{ color: "gray", fontSize: "12px" }}>
                Click to open →
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// STYLES
const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "15px",
  marginTop: "15px"
};

const statCard = {
  background: "white",
  padding: "15px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  borderLeft: "5px solid #4f46e5"
};

const controlBar = {
  marginTop: "20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap"
};

const searchBox = {
  padding: "10px",
  width: "250px",
  borderRadius: "8px",
  border: "1px solid #ccc"
};

const filterBtn = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  cursor: "pointer"
};

const grid = {
  marginTop: "20px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "15px"
};

const card = {
  background: "white",
  padding: "15px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  cursor: "pointer"
};

export default Cases;