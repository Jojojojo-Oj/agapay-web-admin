const Dashboard = () => {
  return (
    <div className="dashboard-content">
      <h2 className="dashboard-title">Overview</h2>

      {/* TOP STATS CARDS */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <h4>Pending Applications</h4>
          <p>12</p>
        </div>

        <div className="stat-card">
          <h4>Approved Today</h4>
          <p>8</p>
        </div>

        <div className="stat-card">
          <h4>Active Incidents</h4>
          <p>3</p>
        </div>

        <div className="stat-card">
          <h4>Avg. Response Time</h4>
          <p>5m 12s</p>
        </div>
      </div>

      {/* TABLES SECTION */}
      <div className="dashboard-grid">
        {/* INCIDENTS TABLE */}
        <div className="panel-card">
          <h3 className="panel-title">Incidents</h3>

          <div className="table-wrapper">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Type</th>
                  <th>Barangay</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>EQ-001</td>
                  <td>Earthquake</td>
                  <td>98</td>
                  <td>
                    <span className="status-badge pending">Pending</span>
                  </td>
                </tr>

                <tr>
                  <td>FLO-002</td>
                  <td>Flood</td>
                  <td>113</td>
                  <td>
                    <span className="status-badge active">Active</span>
                  </td>
                </tr>

                <tr>
                  <td>FLO-003</td>
                  <td>Flood</td>
                  <td>87</td>
                  <td>
                    <span className="status-badge resolved">Resolved</span>
                  </td>
                </tr>

                <tr>
                  <td>TY-003</td>
                  <td>Typhoon</td>
                  <td>112</td>
                  <td>
                    <span className="status-badge active">Active</span>
                  </td>
                </tr>

                <tr>
                  <td>FIR-004</td>
                  <td>Fire</td>
                  <td>65</td>
                  <td>
                    <span className="status-badge pending">Pending</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* APPLICATIONS TABLE */}
        <div className="panel-card">
          <h3 className="panel-title">Applications</h3>

          <div className="table-wrapper">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Applicant</th>
                  <th>Barangay</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>1</td>
                  <td>Juan Dela Cruz</td>
                  <td>113</td>
                  <td>03/16/2025</td>
                  <td>
                    <span className="status-badge approved">Approved</span>
                  </td>
                </tr>

                <tr>
                  <td>2</td>
                  <td>Juan Dela Cruz</td>
                  <td>106</td>
                  <td>03/26/2025</td>
                  <td>
                    <span className="status-badge rejected">Rejected</span>
                  </td>
                </tr>

                <tr>
                  <td>3</td>
                  <td>Juan Dela Cruz</td>
                  <td>88</td>
                  <td>04/02/2025</td>
                  <td>
                    <span className="status-badge pending">Pending</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
