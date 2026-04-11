import { useEffect, useState } from "react";
import API from "../services/api";
import Card from "../components/Card";

function Dashboard() {
  const [clients, setClients] = useState(0);
  const [cases, setCases] = useState(0);
  const [hearings, setHearings] = useState(0);

  useEffect(() => {
    API.get("/clients").then(res => setClients(res.data.data.length));
    API.get("/cases").then(res => setCases(res.data.data.length));
    API.get("/hearings").then(res => setHearings(res.data.data.length));
  }, []);

  return (
    <div style={{ padding: "25px" }}>
      <h2>Dashboard</h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "15px",
        marginTop: "20px"
      }}>
        
        <Card>
          <h3>Clients</h3>
          <h1>{clients}</h1>
        </Card>

        <Card>
          <h3>Cases</h3>
          <h1>{cases}</h1>
        </Card>

        <Card>
          <h3>Hearings</h3>
          <h1>{hearings}</h1>
        </Card>

      </div>
    </div>
  );
}

export default Dashboard;