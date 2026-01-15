const Sidebar = ({ setPage }) => {
  return (
    <div className="sidebar">
      <h2>AGAPAY</h2>

      <ul>
        <li onClick={() => setPage("dashboard")}>Dashboard</li>
        <li onClick={() => setPage("applicant")}>Applicant</li>
        <li onClick={() => setPage("news")}>Publish News</li>
        <li onClick={() => setPage("announcement")}>Publish Announcement</li>
        <li onClick={() => setPage("incidents")}>Incidents</li>
        <li onClick={() => setPage("rescuer")}>Create Rescuer</li>
        <li>Users</li>
        <li>Logout</li>
      </ul>
    </div>
  );
};

export default Sidebar; 
