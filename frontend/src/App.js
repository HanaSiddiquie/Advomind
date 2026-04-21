import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Cases from "./pages/Cases";
import HearingsDashboard from "./pages/HearingsDashboard";
import Hearings from "./pages/Hearings";
import CaseDetails from "./pages/CaseDetails";
import ClientDetails from "./pages/ClientDetails";
import HearingDetails from "./pages/HearingDetails";

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetails />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<CaseDetails />} />
        <Route path="/hearings-dashboard" element={<HearingsDashboard />} />
        <Route path="/hearings" element={<Hearings />} />
        <Route path="/hearings/:id" element={<HearingDetails />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;