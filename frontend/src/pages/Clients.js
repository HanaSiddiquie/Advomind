import { useEffect, useState } from "react";
import API from "../services/api";
import Card from "../components/Card";
import PageWrapper from "../components/PageWrapper";

function Clients() {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    id: "",
    name: "",
    cnic: "",
    address: "",
    email: "",
    phone: ""
  });

  const fetchClients = () => {
    API.get("/clients")
      .then(res => setClients(res.data.data || []))
      .catch(err => console.log(err));
  };

  // ✅ FIXED useEffect
  useEffect(() => {
    fetchClients();
  }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = () => {
    if (editing) {
      API.put(`/clients/${form.id}`, form).then(() => {
        fetchClients();
        resetForm();
      });
    } else {
      API.post("/clients", form).then(() => {
        fetchClients();
        resetForm();
      });
    }
  };

  const resetForm = () => {
    setForm({
      id: "",
      name: "",
      cnic: "",
      address: "",
      email: "",
      phone: ""
    });
    setEditing(false);
  };

  const deleteClient = (id) => {
    API.delete(`/clients/${id}`).then(fetchClients);
  };

  const editClient = (client) => {
    setForm(client);
    setEditing(true);
  };

  return (
    <PageWrapper title="Clients">
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          <input name="id" value={form.id} disabled={editing} onChange={handleChange} placeholder="ID" />
          <input name="name" value={form.name} onChange={handleChange} placeholder="Name" />
          <input name="cnic" value={form.cnic} onChange={handleChange} placeholder="CNIC" />
          <input name="address" value={form.address} onChange={handleChange} placeholder="Address" />
          <input name="email" value={form.email} onChange={handleChange} placeholder="Email" />
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone" />
        </div>

        <button style={{ marginTop: "10px" }} onClick={handleSubmit}>
          {editing ? "Update Client" : "Add Client"}
        </button>
      </Card>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "15px",
        marginTop: "20px"
      }}>
        {clients.map(c => (
          <Card key={c.id}>
            <h4>{c.name}</h4>
            <p>ID: {c.id}</p>
            <p>Email: {c.email}</p>

            <button onClick={() => editClient(c)}>Edit</button>
            <button onClick={() => deleteClient(c.id)}>Delete</button>
          </Card>
        ))}
      </div>
    </PageWrapper>
  );
}

export default Clients;