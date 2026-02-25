import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";

import "./styles/dashboard.css";
import "./styles/news.css";
import "./styles/announcement.css";
import "./styles/incidents.css";

import Applicants from "./pages/Applicant";
import CreatePost from "./pages/News";
import CreateAnnouncement from "./pages/Announcement";
import Incidents from "./pages/Incidents";
import CreateRescuerAccount from "./pages/CreateRescuer";
import ResolvedCases from "./pages/ResolvedCases";

function App() {
  const [page, setPage] = useState("dashboard");

  // ✅ IMPORTANT FIX: Landing page first
  useEffect(() => {
    const path = window.location.pathname;
    const isAuthenticated =
      sessionStorage.getItem("agapay_admin_logged_in") === "true";

    if (path === "/") {
      // Kapag root, pupunta sa landing page mo
      window.location.replace("/landing.html");
      return;
    }

    if (!isAuthenticated) {
      window.location.replace("/login-2.html");
      return;
    }

    if (path === "/dashboard") {
      setPage("dashboard");
    }
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const isAuthenticated =
      sessionStorage.getItem("agapay_admin_logged_in") === "true";

    if (!isAuthenticated || path !== "/dashboard") return;

    window.history.pushState(null, "", window.location.href);

    const handleBack = () => {
      window.history.pushState(null, "", window.location.href);
      window.location.reload();
    };

    window.addEventListener("popstate", handleBack);

    return () => {
      window.removeEventListener("popstate", handleBack);
    };
  }, []);

  return (
    <div className="dashboard-layout">
      <Sidebar setPage={setPage} activePage={page} />

      <div className="main">
        {/* TOPBAR */}
        <div className="topbar">
          <h3 className="topbar-title">
            {page === "dashboard" && "Dashboard"}
            {page === "applicant" && "Applicants"}
            {page === "news" && "News"}
            {page === "announcement" && "Announcements"}
            {page === "incidents" && "Incidents"}
            {page === "resolvedCases" && "Resolved Cases"}
            {page === "rescuer" && "Create Rescuer"}
          </h3>
        </div>

        {/* MAIN PAGE CONTENT */}
        <div className="page-content">
          {page === "dashboard" && <Dashboard />}
          {page === "applicant" && <Applicants />}
          {page === "news" && <CreatePost />}
          {page === "announcement" && <CreateAnnouncement />}
          {page === "incidents" && <Incidents />}
          {page === "resolvedCases" && <ResolvedCases />}
          {page === "rescuer" && <CreateRescuerAccount />}
        </div>
      </div>
    </div>
  );
}

export default App;