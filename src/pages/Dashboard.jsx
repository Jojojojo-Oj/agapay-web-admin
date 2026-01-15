const Dashboard = () => {
  return (
    <div className="content">
      <h2>Overview</h2>

      <div className="stats">
        <div className="card">
          <h4>Total Users</h4>
          <p>1,245</p>
        </div>

        <div className="card">
          <h4>Active Alerts</h4>
          <p>12</p>
        </div>

        <div className="card">
          <h4>Posts Created</h4>
          <p>87</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
