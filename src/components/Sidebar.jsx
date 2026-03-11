import { useState } from "react";
import logo from "../assets/agapay_logo.png";

const Sidebar = ({ setPage }) => {
  const [activeItem, setActiveItem] = useState("dashboard");

  const handleClick = (page) => {
    setActiveItem(page);
    setPage(page);
  };

  return (
    <div className="sidebar">
      {/* HEADER */}
      <div className="sidebar-header">
        <img src={logo} alt="AGAPAY Logo" className="sidebar-logo" />
        <h2 className="sidebar-title">AGAPAY</h2>
      </div>

      {/* MENU */}
      <ul className="sidebar-menu">
        <li
          className={activeItem === "dashboard" ? "active" : ""}
          onClick={() => handleClick("dashboard")}
        >
          Dashboard
        </li>

        <li
          className={activeItem === "applicant" ? "active" : ""}
          onClick={() => handleClick("applicant")}
        >
          Applicant
        </li>

        <li
          className={activeItem === "news" ? "active" : ""}
          onClick={() => handleClick("news")}
        >
          Publish News
        </li>

        <li
          className={activeItem === "announcement" ? "active" : ""}
          onClick={() => handleClick("announcement")}
        >
          Publish Announcement
        </li>

        <li
          className={activeItem === "alert" ? "active" : ""}
          onClick={() => handleClick("alert")}
        >
          Alert
        </li>


        <li
          className={activeItem === "incidents" ? "active" : ""}
          onClick={() => handleClick("incidents")}
        >
          Incidents
        </li>

        <li
          className={activeItem === "resolvedCases" ? "active" : ""}
          onClick={() => handleClick("resolvedCases")}
        >
          Resolved Cases
        </li>

        


        {/* LOGOUT */}
        <li 
          className="sidebar-logout"
          onClick={() => {
            const confirmLogout = window.confirm("Are you sure you want to logout?");
            if (confirmLogout) {
              sessionStorage.removeItem("agapay_admin_logged_in");
              window.location.replace("/landing.html");
            }
          }}
        >
          Logout
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
