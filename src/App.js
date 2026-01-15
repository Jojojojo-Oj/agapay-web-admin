import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import "./styles/dashboard.css";
import Applicants from "./pages/Applicant";
import CreatePost from "./pages/News";
import CreateAnnouncement from "./pages/Announcement";
import Incidents from "./pages/Incidents";
import CreateRescuerAccount from "./pages/CreateRescuer";

function App() {
  const [page, setPage] = useState("dashboard");

  return (
    <div className="dashboard-layout">
      <Sidebar setPage={setPage} />

      <div className="main">

        {page === "dashboard" && <Dashboard />}
        {page == "applicant" && <Applicants />}
        {page == "news" && <CreatePost />}
        {page == "announcement" && < CreateAnnouncement />}
        {page == "incidents" && < Incidents />}
        {page == "rescuer" && < CreateRescuerAccount />}
        

      </div>
    </div>
  );
}

export default App;
