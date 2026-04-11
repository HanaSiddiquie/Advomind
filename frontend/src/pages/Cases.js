import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function Cases() {
  const [cases, setCases] = useState([]);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    id: "",
    client_id: "",
    title: "",
    description: ""
  });

  const fetchCases = () => {
    API.get("/cases")
      .then(res => setCases(res.data.data || []))
      .catch(err => console.log("Fetch error:", err));
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ✅ SAFE ADD (IMPORTANT FIX)
  const addCase = () => {
    if (!form.id || !form.client_id || !form.title || !form.description) {
      alert("Please fill all fields");
      return;
    }

    API.post("/cases", form)
      .then((res) => {
        console.log("Case added:", res.data);
        fetchCases();
        setForm({
          id: "",
          client_id: "",
          title: "",
          description: ""
        });
      })
      .catch(err => {
        console.log("Add case error:", err.response?.data || err.message);
        alert(err.response?.data?.message || "Failed to add case");
      });
  };

  const deleteCase = (id) => {
    API.delete(`/cases/${id}`)
      .then(() => fetchCases())
      .catch(err => console.log(err));
  };

  return (
    <div style={{ padding: "20px", background: "#f5f6fa", minHeight: "100vh" }}>
      <h2>📁 Cases</h2>

      {/* FORM */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "10px",
        marginBottom: "20px"
      }}>
        <input name="id" placeholder="Case ID" value={form.id} onChange={handleChange} />
        <input name="client_id" placeholder="Client ID" value={form.client_id} onChange={handleChange} />
        <input name="title" placeholder="Title" value={form.title} onChange={handleChange} />
        <input name="description" placeholder="Description" value={form.description} onChange={handleChange} />
      </div>

      <button onClick={addCase}>
        ➕ Add Case
      </button>

      {/* LIST */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "15px",
        marginTop: "20px"
      }}>
        {cases.map(c => (
          <div
            key={c.id}
            style={{
              background: "white",
              padding: "15px",
              borderRadius: "12px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
              cursor: "pointer"
            }}
            onClick={() => navigate(`/cases/${c.id}`)}
          >
            <h3>{c.title}</h3>
            <p><b>ID:</b> {c.id}</p>
            <p><b>Client:</b> {c.client_id}</p>
            <p><b>Status:</b> {c.status}</p>

            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteCase(c.id);
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Cases;