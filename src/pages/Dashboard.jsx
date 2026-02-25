import React, { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { subscribeToIncidents } from "../services/incidentsService";
import { subscribeToUsers } from "../services/applicantsService";
import { onValue, ref } from "firebase/database";
import { rtdb } from "../services/firebase";
import { parseCoordinates } from "../services/geocode";
import fireMarker from "../assets/markers/fireMarker.png";
import earthquakeMarker from "../assets/markers/earthquakeMarker.png";
import typhoonMarker from "../assets/markers/typhoonMarker.png";
import medicalMarker from "../assets/markers/medicalMarker.png";
import rescuerMarker from "../assets/markers/rescuerMarker.png";

const DEFAULT_CENTER = { lat: 14.649, lng: 120.970 }; // Caloocan City South
const MAP_HEIGHT = 550; // px
const MARKER_WIDTH = 45; // px
const MARKER_HEIGHT = 50; // px
const RESCUER_MARKER_WIDTH = 50; // px
const RESCUER_MARKER_HEIGHT = 56; // px

const Dashboard = () => {
  const [incidents, setIncidents] = useState([]);
  const [users, setUsers] = useState([]);
  const [rescuers, setRescuers] = useState([]);

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  useEffect(() => {
    const unsub = subscribeToIncidents(setIncidents);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToUsers(setUsers);
    return () => unsub();
  }, []);

  useEffect(() => {
    const rescuerRef = ref(rtdb, "rescuer_locations");
    const unsub = onValue(rescuerRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .filter((item) =>
          Number.isFinite(item.lat) && Number.isFinite(item.lng)
        );
      setRescuers(list);
    });

    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const approvedApplicants = users.filter(
      (u) => (u.status || "").toLowerCase() === "approved"
    ).length;
    const pendingApplicants = users.filter(
      (u) => (u.status || "").toLowerCase() === "pending"
    ).length;

    const pendingIncidents = incidents.filter(
      (i) => (i.status || "").toLowerCase() === "pending"
    ).length;
    const activeIncidents = incidents.filter(
      (i) => (i.status || "").toLowerCase() === "active"
    ).length;

    return {
      approvedApplicants,
      pendingApplicants,
      pendingIncidents,
      activeIncidents,
    };
  }, [users, incidents]);

  const markers = useMemo(() => {
    if (!isLoaded) return [];

    const iconForType = (type) => {
      const t = (type || "").toLowerCase();
      if (t.includes("fire")) return fireMarker;
      if (t.includes("earthquake")) return earthquakeMarker;
      if (t.includes("typhoon")) return typhoonMarker;
      if (t.includes("flood") || t.includes("medical")) return medicalMarker;
      return null;
    };

    const fallbackColorForType = (type) => {
      const t = (type || "").toLowerCase();
      if (t.includes("fire")) return "#ef4444";
      if (t.includes("flood")) return "#22c55e";
      if (t.includes("typhoon")) return "#2563eb";
      if (t.includes("earthquake")) return "#a16207";
      return "#0ea5e9";
    };

    return incidents
      .filter((incident) => (incident.status || "").toLowerCase() === "active")
      .map((incident) => {
        const coords = parseCoordinates(incident.location);
        if (!coords) return null;

        const iconUrl = iconForType(incident.disasterType);
        const icon = iconUrl
          ? {
              url: iconUrl,
              scaledSize: new window.google.maps.Size(MARKER_WIDTH, MARKER_HEIGHT),
              anchor: new window.google.maps.Point(MARKER_WIDTH / 2, MARKER_HEIGHT),
            }
          : {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: fallbackColorForType(incident.disasterType),
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: "#ffffff",
            };

        return {
          id: incident.id,
          position: coords,
          title: `${incident.disasterType || "Incident"} • ${incident.senderName || "Unknown"}`,
          icon,
        };
      })
      .filter(Boolean);
  }, [incidents, isLoaded]);

  const rescuerMarkers = useMemo(() => {
    if (!isLoaded) return [];

    return rescuers.map((rescuer) => ({
      id: rescuer.id,
      position: { lat: rescuer.lat, lng: rescuer.lng },
      title: "Rescuer",
      icon: {
        url: rescuerMarker,
        scaledSize: new window.google.maps.Size(
          RESCUER_MARKER_WIDTH,
          RESCUER_MARKER_HEIGHT
        ),
        anchor: new window.google.maps.Point(
          RESCUER_MARKER_WIDTH / 2,
          RESCUER_MARKER_HEIGHT
        ),
      },
    }));
  }, [rescuers, isLoaded]);
  return (
    <div className="dashboard-content">
      <h2 className="dashboard-title">Overview</h2>

      {/* TOP STATS CARDS */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <h4>Applicants</h4>
          <p>{stats.approvedApplicants}</p>
        </div>

        <div className="stat-card">
          <h4>Pending Applications</h4>
          <p>{stats.pendingApplicants}</p>
        </div>

        <div className="stat-card">
          <h4>Pending Incidents</h4>
          <p>{stats.pendingIncidents}</p>
        </div>

        <div className="stat-card">
          <h4>Active Incidents</h4>
          <p>{stats.activeIncidents}</p>
        </div>
      </div>

      {/* MAP SECTION */}
      <div className="panel-card">
        <h3 className="panel-title">Live Map</h3>
        <div className="table-wrapper" style={{ height: `${MAP_HEIGHT}px` }}>
          {!apiKey ? (
            <div style={{ padding: "24px" }}>
              Add your Google Maps API key to .env as
              <strong> REACT_APP_GOOGLE_MAPS_API_KEY</strong>.
            </div>
          ) : !isLoaded ? (
            <div style={{ padding: "24px" }}>Loading map...</div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={DEFAULT_CENTER}
              zoom={12}
              options={{
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
              }}
            >
              {markers.map((m) => (
                <Marker
                  key={m.id}
                  position={m.position}
                  title={m.title}
                  icon={m.icon}
                />
              ))}
              {rescuerMarkers.map((m) => (
                <Marker
                  key={`rescuer-${m.id}`}
                  position={m.position}
                  title={m.title}
                  icon={m.icon}
                />
              ))}
            </GoogleMap>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
