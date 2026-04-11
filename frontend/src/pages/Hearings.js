import { useEffect, useState } from "react";
import API from "../services/api";
import Card from "../components/Card";
import PageWrapper from "../components/PageWrapper";

function Hearings() {
  const [hearings, setHearings] = useState([]);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    id: "",
    case_id: "",
    date: "",
    event: "",
    notes: "",
    reminder: ""
  });

  const fetchHearings = () => {
    API.get("/hearings")
      .then(res => setHearings(res.data.data || []))
      .catch(err => console.log(err));
  };

  // ✅ FIXED useEffect
  useEffect(() => {
    fetchHearings();
  }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = () => {
    if (editing) {
      API.put(`/hearings/${form.id}`, form).then(() => {
        fetchHearings();
        resetForm();
      });
    } else {
      API.post("/hearings", form).then(() => {
        fetchHearings();
        resetForm();
      });
    }
  };

  const resetForm = () => {
    setForm({
      id: "",
      case_id: "",
      date: "",
      event: "",
      notes: "",
      reminder: ""
    });
    setEditing(false);
  };

  const deleteHearing = (id) => {
    API.delete(`/hearings/${id}`).then(fetchHearings);
  };

  const editHearing = (h) => {
    setForm(h);
    setEditing(true);
  };

  return (
    <PageWrapper title="Hearings">
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          <input name="id" value={form.id} disabled={editing} onChange={handleChange} placeholder="Hearing ID" />
          <input name="case_id" value={form.case_id} onChange={handleChange} placeholder="Case ID" />
          <input type="date" name="date" value={form.date} onChange={handleChange} />
          <input name="event" value={form.event} onChange={handleChange} placeholder="Event" />
          <input name="notes" value={form.notes} onChange={handleChange} placeholder="Notes" />
          <input name="reminder" value={form.reminder} onChange={handleChange} placeholder="Reminder" />
        </div>

        <button style={{ marginTop: "10px" }} onClick={handleSubmit}>
          {editing ? "Update Hearing" : "Add Hearing"}
        </button>
      </Card>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "15px",
        marginTop: "20px"
      }}>
        {hearings.map(h => (
          <Card key={h.id}>
            <h4>{h.event}</h4>
            <p>ID: {h.id}</p>
            <p>Case: {h.case_id}</p>
            <p>Date: {h.date}</p>

            <button onClick={() => editHearing(h)}>Edit</button>
            <button onClick={() => deleteHearing(h.id)}>Delete</button>
          </Card>
        ))}
      </div>
    </PageWrapper>
  );
}

export default Hearings;