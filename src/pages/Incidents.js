import React, { useEffect, useState, useRef, useMemo } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/incidents.css";

import {
  subscribeToIncidents,
  updateIncidentStatus,
  getDisasterTypes,
  filterIncidents,
} from "../services/incidentsService";
import { getAddressForLocation, parseCoordinates } from "../services/geocode";

export default function Incidents() {
  const [reports, setReports] = useState([]);
  const [previewReport, setPreviewReport] = useState(null);
  const [search, setSearch] = useState("");
  const [disasterTypeFilter, setDisasterTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notificationBanner, setNotificationBanner] = useState(null);
  const [addressMap, setAddressMap] = useState({});

  const prevReportIds = useRef(new Set());

  /* ================= REAL-TIME INCIDENT SUBSCRIPTION ================= */
  useEffect(() => {
    const unsub = subscribeToIncidents((data) => {
      if (prevReportIds.current.size === 0) {
        data.forEach((r) => prevReportIds.current.add(r.id));
      } else {
        data.forEach((r) => {
          if (!prevReportIds.current.has(r.id)) {
            showToast(
              `${r.senderName || "Unknown"} reported a ${r.disasterType}`
            );
            prevReportIds.current.add(r.id);
          }
        });
      }
      setReports(data);
    });

    return () => unsub();
  }, []);

  // Resolve human-readable addresses for any reports with coordinates
  useEffect(() => {
    if (!reports || reports.length === 0) return;

    const missing = reports.filter(
      (r) => !addressMap[r.id] && parseCoordinates(r.location)
    );
    if (missing.length === 0) return;

    let cancelled = false;

    (async () => {
      // Simple concurrency control
      const concurrency = 3;
      let index = 0;
      const next = async () => {
        if (cancelled || index >= missing.length) return;
        const current = missing[index++];
        try {
          const addr = await getAddressForLocation(current.location);
          if (!cancelled) {
            setAddressMap((prev) => ({ ...prev, [current.id]: addr }));
          }
        } catch (_) {
          // ignore
        } finally {
          if (!cancelled && index < missing.length) await next();
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, next));
    })();

    return () => {
      cancelled = true;
    };
  }, [reports, addressMap]);

  /* ================= FILTERS ================= */
  const disasterTypes = useMemo(
    () => getDisasterTypes(reports),
    [reports]
  );

  const filteredReports = useMemo(() => {
    return filterIncidents(
      reports,
      search,
      disasterTypeFilter,
      statusFilter
    );
  }, [reports, search, disasterTypeFilter, statusFilter]);

  /* ================= UI TOAST ================= */
  const showToast = (message) => {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title: message,
      text: "New SOS report received.",
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
    });
  };

  /* ================= STATUS UPDATE ================= */
  const handleStatusChange = async (reportId, newStatus) => {
    const actionColor = newStatus === "active" ? "#16a34a" : "#dc2626";

    const result = await Swal.fire({
      title:
        newStatus === "active"
          ? "Publish Incident"
          : "Reject Incident",
      text: `Are you sure you want to ${newStatus} this report?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: actionColor,
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Confirm",
    });

    if (!result.isConfirmed) return;

    try {
      await updateIncidentStatus(reportId, newStatus);

      if (newStatus === "active") {
        const incident = reports.find((r) => r.id === reportId);
        const prettyLocation = addressMap[reportId] || incident?.location || "Unknown";

        setNotificationBanner({
          type: "success",
          title: "Incident Published",
          message: "Responders have been notified successfully.",
          details: {
            sender: incident?.senderName || "Unknown",
            type: incident?.disasterType || "Unknown",
            location: prettyLocation,
          },
        });

        setTimeout(() => setNotificationBanner(null), 5000);
      }

      Swal.fire({
        icon: "success",
        title: "Success",
        text: `Incident marked as ${newStatus}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Failed",
        text: "Unable to update incident status.",
      });
    }
  };

  return (
    <div className="incidents-page">
      <h2 className="incidents-title">Incidents</h2>

      {/* ================= NOTIFICATION BANNER ================= */}
      {notificationBanner && (
        <div className="incidents-notification-banner incidents-banner-success">
          <div className="incidents-banner-content">
            <div className="incidents-banner-title">
              {notificationBanner.title}
            </div>
            <div className="incidents-banner-message">
              {notificationBanner.message}
            </div>
            <div className="incidents-banner-details">
              <p><strong>Sender:</strong> {notificationBanner.details.sender}</p>
              <p><strong>Type:</strong> {notificationBanner.details.type}</p>
              <p><strong>Location:</strong> {notificationBanner.details.location}</p>
            </div>
          </div>
          <button
            className="incidents-banner-close"
            onClick={() => setNotificationBanner(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= CONTROLS ================= */}
      <div className="incidents-controls">
        <input
          className="incidents-search-input"
          type="text"
          placeholder="Search incidents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="incidents-select"
          value={disasterTypeFilter}
          onChange={(e) => setDisasterTypeFilter(e.target.value)}
        >
          <option value="all">All Disaster Types</option>
          {disasterTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          className="incidents-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Published</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* ================= TABLE ================= */}
      {filteredReports.length === 0 ? (
        <div className="incidents-empty">No incidents found</div>
      ) : (
        <div className="incidents-table-wrapper">
          <table className="incidents-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Sender</th>
                <th>Type</th>
                <th>Location</th>
                <th>Status</th>
                <th>Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.senderName || "—"}</td>
                  <td>{r.disasterType || "—"}</td>
                  <td className="location-cell">{addressMap[r.id] || r.location || "—"}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>
                      {r.status}
                    </span>
                  </td>

                  {/* 🔍 PREVIEW COLUMN */}
                  <td>
                    <button
                      className="btn-preview"
                      onClick={() => setPreviewReport(r)}
                    >
                      View
                    </button>
                  </td>

                  {/* 🚦 ACTIONS COLUMN */}
                  <td>
                    <button
                      className="btn-publish"
                      onClick={() => handleStatusChange(r.id, "active")}
                    >
                      Publish
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => handleStatusChange(r.id, "rejected")}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= PREVIEW MODAL ================= */}
      {previewReport && (
        <div
          className="incidents-modal-overlay"
          onClick={() => setPreviewReport(null)}
        >
          <div
            className="incidents-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="incidents-modal-left">
              <h2>Incident Details</h2>
              <p><strong>Sender:</strong> {previewReport.senderName}</p>
              <p><strong>Type:</strong> {previewReport.disasterType}</p>
              <p><strong>Location:</strong> {addressMap[previewReport.id] || previewReport.location}</p>
              <p><strong>Status:</strong> {previewReport.status}</p>
              <p><strong>Description:</strong></p>
              <p>{previewReport.details || "No description provided."}</p>
            </div>

            <div className="incidents-modal-right">
              <h2>Incident Image</h2>
              {previewReport.imagePath ? (
                <img
                  src={previewReport.imagePath}
                  alt="Incident"
                />
              ) : (
                <p>No image available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
