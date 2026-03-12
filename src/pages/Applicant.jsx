import React, { useEffect, useState, useRef, useMemo } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/applicant.css";
import "../styles/applicantRescuerPreview.css";
import earthquakeIcon from "../assets/icons/eqeq.png";
import fireIcon from "../assets/icons/firefire.png";
import landslideIcon from "../assets/icons/lsls.png";
import medicalIcon from "../assets/icons/medmed.png";
import policeIcon from "../assets/icons/popo.png";
import tsunamiIcon from "../assets/icons/tsutsu.png";
import typhoonIcon from "../assets/icons/typtyp.png";
import volcanoIcon from "../assets/icons/vulvul.png";


import {
  subscribeToUsers,
  subscribeToRescuerApplicants,
  updateUserStatus,
  filterUsers,
  filterRescuerApplicants,
} from "../services/applicantsService";
import { sendAdminNotification } from "../services/notificationUtility";

export default function Applicants() {
  const [users, setUsers] = useState([]);
  const [rescuerApplicants, setRescuerApplicants] = useState([]);
  const [previewUser, setPreviewUser] = useState(null);
  const [previewRescuer, setPreviewRescuer] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [rescuerPreviewPage, setRescuerPreviewPage] = useState(1);

  // 🔍 Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ✅ Tab filter (UI only)
  const [roleTab, setRoleTab] = useState("user"); // "user" | "rescuer"

  const prevUserIds = useRef(new Set());

  /* ================= FIRESTORE ================= */
  useEffect(() => {
    const unsub = subscribeToUsers((data) => {
      if (prevUserIds.current.size === 0) {
        data.forEach((u) => prevUserIds.current.add(u.id));
      } else {
        data.forEach((u) => {
          if (!prevUserIds.current.has(u.id)) {
            const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
            showToast(fullName);

            // Send admin notification for new applicant
            sendAdminNotification("applicant", u);

            prevUserIds.current.add(u.id);
          }
        });
      }

      setUsers(data);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToRescuerApplicants((data) => {
      setRescuerApplicants(data);
    });

    return () => unsub();
  }, []);

  /* ================= FILTER + SORT LOGIC ================= */
  const filteredApplicants = useMemo(() => {
    const results =
      roleTab === "rescuer"
        ? filterRescuerApplicants(rescuerApplicants, search, statusFilter)
        : filterUsers(users, search, statusFilter);

    // ✅ Sort: Pending first, then alphabetical
    const statusPriority = {
      pending: 1,
      approved: 2,
      rejected: 3,
    };

    return [...results].sort((a, b) => {
      const prioA = statusPriority[a.status] ?? 99;
      const prioB = statusPriority[b.status] ?? 99;

      // 1) Pending / Approved / Rejected order
      if (prioA !== prioB) return prioA - prioB;

      // 2) Alphabetical by FULL NAME (safe kahit walang lastName)
      const nameA =
        roleTab === "rescuer"
          ? `${a.organizationInformation?.organization_name || ""}`
              .trim()
              .toLowerCase()
          : `${a.firstName || ""} ${a.lastName || ""}`
              .trim()
              .toLowerCase();

      const nameB =
        roleTab === "rescuer"
          ? `${b.organizationInformation?.organization_name || ""}`
              .trim()
              .toLowerCase()
          : `${b.firstName || ""} ${b.lastName || ""}`
              .trim()
              .toLowerCase();

      return nameA.localeCompare(nameB);
    });
  }, [users, rescuerApplicants, search, statusFilter, roleTab]);

  /* ================= COUNTS FOR HEADER ================= */
  const counts = useMemo(() => {
    const userApplicants = users.length;
    const rescuerApplicantsCount = rescuerApplicants.length;
    return { userApplicants, rescuerApplicants: rescuerApplicantsCount };
  }, [users, rescuerApplicants]);

  /* ================= ACTIONS ================= */
  const handleStatusChange = async (userId, newStatus) => {
    const applicantLabel = roleTab === "rescuer" ? "rescuer applicant" : "user";

    const result = await Swal.fire({
      title: `${newStatus.toUpperCase()} ${applicantLabel.toUpperCase()}`,
      text: `Are you sure you want to ${newStatus} this ${applicantLabel}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: newStatus === "approved" ? "#16a34a" : "#dc2626",
      confirmButtonText: `Yes, ${newStatus}`,
    });

    if (result.isConfirmed) {
      try {
        await updateUserStatus(userId, newStatus);
        Swal.fire("Success", "Applicant status updated", "success");
      } catch (err) {
        Swal.fire("Error", "Failed to update applicant status", "error");
      }
    }
  };

  const getTeamLeaderName = (rescuerApplicant) => {
    const firstName = rescuerApplicant?.leaderLeadRescuer?.first_name || "";
    const lastName = rescuerApplicant?.leaderLeadRescuer?.last_name || "";
    const combinedName = `${firstName} ${lastName}`.trim();
    return combinedName || rescuerApplicant?.leaderLeadRescuer?.full_name || "—";
  };

  const showToast = (name) => {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title: name || "New User",
      timer: 3000,
      showConfirmButton: false,
    });
  };

  const formatFieldLabel = (key = "") =>
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const normalizeAvailabilityItem = (item = "") =>
    item
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  const renderInfoSection = (title, dataObj) => {
    const entries = Object.entries(dataObj || {});

    return (
      <div className="rescuer-preview-section">
        <p className="rescuer-preview-section-title">{title}</p>
        {entries.length === 0 ? (
  <p>—</p>
) : (
  entries.map(([key, value]) => {

    if (key === "emergency_availability" && value) {

  const icons = {
    earthquake: earthquakeIcon,
    fire: fireIcon,
    landslide: landslideIcon,
    medical: medicalIcon,
    "medical assistance": medicalIcon,
    police: policeIcon,
    "police assistance": policeIcon,
    tsunami: tsunamiIcon,
    typhoon: typhoonIcon,
    volcano: volcanoIcon,
    volcan: volcanoIcon,
  };

  const availabilityLabels = [
    "earthquake",
    "fire",
    "landslide",
    "medical assistance",
    "medical",
    "police assistance",
    "police",
    "tsunami",
    "typhoon",
    "volcano",
    "volcan",
  ];

  // normalize value to array
  const list = Array.isArray(value)
    ? value
    : value.toString().includes(",")
      ? value
          .toString()
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : availabilityLabels.filter((label) =>
          normalizeAvailabilityItem(value).includes(label)
        );

  return (
    <div key={key} className="rescuer-preview-row rescuer-preview-row-emergency">
      <b>{formatFieldLabel(key)}:</b>
      <div className="emergency-tags-row">
        {list.map((item, i) => {
        const clean = normalizeAvailabilityItem(item);
        const displayLabel = formatFieldLabel(clean);

        return (
          <span key={i} className="emergency-tag">
            {icons[clean] && (
              <img
                src={icons[clean]}
                className="emergency-icon"
                alt={displayLabel}
              />
            )}
            {displayLabel}
          </span>
        );
      })}
      </div>
    </div>
  );
}

    return (
      <p key={key}>
        <b>{formatFieldLabel(key)}:</b> {value || "—"}
      </p>
    );

  })
)}
      </div>
    );
  };

  const renderUploadedFiles = (files = []) => {
  if (!files || files.length === 0) return <p>Not uploaded</p>;

  return (
    <div className="rescuer-document-grid">
      {files.map((file, index) => (
        <div
          key={`${file.fileName}-${index}`}
          className="rescuer-document-card"
        >
          <img
            src={file.downloadURL}
            alt={file.fileName || `Document ${index + 1}`}
            className="rescuer-document-image"
            style={{ cursor: "zoom-in" }}
            onClick={() => setPreviewImage(file.downloadURL)}
            onError={(e) => (e.target.style.display = "none")}
          />


        </div>
      ))}
    </div>
  );
};

  /* ================= UI ================= */
  return (
    <div className="app-page">
      {/* HEADER */}
      <div className="app-header">
        <div>
          <h2 className="app-title">Applicants</h2>
          <p className="app-subtitle">
            Review and approve applicants for User and Rescuer accounts.
          </p>
        </div>

        <div className="app-header-stats">
          <div className="app-stat">
            <div className="app-stat-label">User Applicants</div>
            <div className="app-stat-value">{counts.userApplicants}</div>
          </div>
          <div className="app-stat">
            <div className="app-stat-label">Rescuer Applicants</div>
            <div className="app-stat-value">{counts.rescuerApplicants}</div>
          </div>
        </div>
      </div>

      {/* ROLE TABS */}
      <div className="app-tabs">
        <button
          type="button"
          className={`app-tab ${roleTab === "user" ? "active" : ""}`}
          onClick={() => setRoleTab("user")}
        >
          User Applicants
        </button>

        <button
          type="button"
          className={`app-tab ${roleTab === "rescuer" ? "active" : ""}`}
          onClick={() => setRoleTab("rescuer")}
        >
          Rescuer Applicants
        </button>
      </div>

      {/* CONTROLS */}
      <div className="app-card app-controls">
        <div className="app-control-group">
          <label className="app-label">Search</label>
          <input
            type="text"
            placeholder="Search name, address, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="app-input"
          />
        </div>

        <div className="app-control-group">
          <label className="app-label">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="app-select"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="app-card">
        {filteredApplicants.length === 0 ? (
          <div className="app-empty">
            <div className="app-empty-title">No matching applicants</div>
            <div className="app-empty-subtitle">
              Try changing the search keyword or filters.
            </div>
          </div>
        ) : (
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                {roleTab === "rescuer" ? (
                  <tr>
                    <th>Organization Name</th>
                    <th>Team Leader</th>
                    <th>Team Leader Email Address</th>
                    <th>Preview</th>
                    <th>Status</th>
                    <th className="app-col-actions">Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Name</th>
                    <th className="app-col-address">Address</th>
                    <th>Preview</th>
                    <th>Status</th>
                    <th className="app-col-actions">Actions</th>
                  </tr>
                )}
              </thead>

              <tbody>
                {roleTab === "rescuer"
                  ? filteredApplicants.map((u) => (
                      <tr key={u.id}>
                        <td>{u.organizationInformation?.organization_name || "—"}</td>
                        <td>{getTeamLeaderName(u)}</td>
                        <td>{u.leaderLeadRescuer?.email_address || "—"}</td>

                        <td>
                          <button
                            type="button"
                            className="app-btn app-btn-outline"
                            onClick={() => {
                              setPreviewRescuer(u);
                              setRescuerPreviewPage(1);
                            }}
                          >
                            Preview
                          </button>
                        </td>

                        <td>
                          <span className={`app-badge app-badge-${u.status}`}>
                            {u.status}
                          </span>
                        </td>

                        <td className="app-actions">
                          <button
                            type="button"
                            className="app-btn app-btn-success"
                            onClick={() => handleStatusChange(u.id, "approved")}
                            disabled={u.status === "approved"}
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            className="app-btn app-btn-danger"
                            onClick={() => handleStatusChange(u.id, "rejected")}
                            disabled={u.status === "rejected"}
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))
                  : filteredApplicants.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="app-name">
                            <div className="app-name-main">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="app-name-sub">
                              {u.email || "—"} • {u.roles || "—"}
                            </div>
                          </div>
                        </td>

                        <td className="app-address">{u.fullAddress || "—"}</td>

                        <td>
                          <button
                            type="button"
                            className="app-btn app-btn-outline"
                            onClick={() => setPreviewUser(u)}
                          >
                            Preview
                          </button>
                        </td>

                        <td>
                          <span className={`app-badge app-badge-${u.status}`}>
                            {u.status}
                          </span>
                        </td>

                        <td className="app-actions">
                          <button
                            type="button"
                            className="app-btn app-btn-success"
                            onClick={() => handleStatusChange(u.id, "approved")}
                            disabled={u.status === "approved"}
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            className="app-btn app-btn-danger"
                            onClick={() => handleStatusChange(u.id, "rejected")}
                            disabled={u.status === "rejected"}
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
      </div>

      {/* MODAL */}
      {previewUser && (
        <div className="app-overlay" onClick={() => setPreviewUser(null)}>
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            {/* LEFT INFO */}
            <div className="app-modal-left">
              <div className="app-modal-header">
                <div>
                  <div className="app-modal-title">Applicant Details</div>
                  <div className="app-modal-subtitle">
                    {previewUser.roles || "—"} • {previewUser.status || "—"}
                  </div>
                </div>

                <button
                  type="button"
                  className="app-btn app-btn-outline"
                  onClick={() => setPreviewUser(null)}
                >
                  Close
                </button>
              </div>

              <div className="app-modal-body">
                <p>
                  <b>Name:</b> {previewUser.firstName} {previewUser.lastName}
                </p>
                <p>
                  <b>Email:</b> {previewUser.email}
                </p>
                <p>
                  <b>Address:</b> {previewUser.fullAddress}
                </p>
                <p>
                  <b>Phone:</b> {previewUser.phoneNumber}
                </p>
                <p>
                  <b>Birthday:</b> {previewUser.birthday}
                </p>

                <p>
                  <b>Status:</b>{" "}
                  <span className={`app-badge app-badge-${previewUser.status}`}>
                    {previewUser.status}
                  </span>
                </p>
              </div>
            </div>

            {/* RIGHT IMAGES */}
            <div className="app-modal-right">
              <div className="app-modal-header">
                <div>
                  <div className="app-modal-title">Verification Images</div>
                  <div className="app-modal-subtitle">Selfie & Valid ID</div>
                </div>
              </div>

              <div className="app-image-grid">
                {/* SELFIE */}
                <div className="app-image-card">
                  <p className="app-image-label">Selfie</p>
                  <img
                    src={previewUser.selfieUrl}
                    alt="Selfie"
                    className="app-preview-image"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </div>

                {/* ID */}
                <div className="app-image-card">
                  <p className="app-image-label">Valid ID</p>
                  <img
                    src={previewUser.idUrl}
                    alt="Valid ID"
                    className="app-preview-image"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </div>
              </div>

              <div className="app-modal-footer">
              </div>
            </div>
          </div>
        </div>
      )}

      {previewRescuer && (
        <div
          className="app-overlay"
          onClick={() => {
            setPreviewRescuer(null);
            setRescuerPreviewPage(1);
          }}
        >
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            <div className="app-modal-left rescuer-preview-full-width">
              <div className="app-modal-header">
                <div>
                  <div className="app-modal-title">Rescuer Applicant Details</div>
                  <div className="app-modal-subtitle">
                    Page {rescuerPreviewPage} of 3 • {previewRescuer.status || "—"}
                  </div>
                </div>
                {previewImage && (
  <div
    className="image-modal-overlay"
    onClick={() => setPreviewImage(null)}
  >
    <div
      className="image-modal-content"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="image-modal-close"
        onClick={() => setPreviewImage(null)}
      >
        ✕
      </button>

      <img
        src={previewImage}
        alt="Document Preview"
        className="image-modal-image"
      />
    </div>
  </div>
)}

                <button
                  type="button"
                  className="app-btn app-btn-outline"
                  onClick={() => {
                    setPreviewRescuer(null);
                    setRescuerPreviewPage(1);
                  }}
                >
                  Close
                </button>
              </div>

              <div className="app-modal-body">
                {rescuerPreviewPage === 1 &&
                  renderInfoSection(
                    "Organization Information",
                    previewRescuer.organizationInformation
                  )}

                {rescuerPreviewPage === 2 && (
                  <>
                    {renderInfoSection(
                      "Lead Rescuer Information",
                      previewRescuer.leaderLeadRescuer
                    )}
                    {renderInfoSection(
                      "Volunteer Team Composition",
                      previewRescuer.volunteerTeamComposition
                    )}
                    {renderInfoSection(
                      "Equipment and Capability",
                      previewRescuer.equipmentCapability
                    )}
                  </>
                )}

                {rescuerPreviewPage === 3 && (
                  <>
                    <div className="rescuer-preview-section">
                      <p className="rescuer-preview-section-title">
                        Team Leader Government ID Upload
                      </p>
                      {renderUploadedFiles(
                        previewRescuer.uploadedFiles?.government_id_upload || []
                      )}
                    </div>

                    <div className="rescuer-preview-section">
                      <p className="rescuer-preview-section-title">
                        Required Documents Uploaded
                      </p>
                      <div className="rescuer-preview-document-block">
                        <p>
                          <b>Registration Certificate</b>
                        </p>
                        {renderUploadedFiles(
                          previewRescuer.uploadedFiles?.registration_certificate || []
                        )}
                      </div>
                      <div className="rescuer-preview-document-block">
                        <p>
                          <b>List of Members</b>
                        </p>
                        {renderUploadedFiles(
                          previewRescuer.uploadedFiles?.list_of_members || []
                        )}
                      </div>
                      <div className="rescuer-preview-document-block">
                        <p>
                          <b>Training Certificates</b>
                        </p>
                        {renderUploadedFiles(
                          previewRescuer.uploadedFiles?.training_certificates || []
                        )}
                      </div>
                      <div className="rescuer-preview-document-block">
                        <p>
                          <b>MOA with LGU</b>
                        </p>
                        {renderUploadedFiles(
                          previewRescuer.uploadedFiles?.moa_with_lgu || []
                        )}
                      </div>
                      <div className="rescuer-preview-document-block">
                        <p>
                          <b>Equipment Inventory</b>
                        </p>
                        {renderUploadedFiles(
                          previewRescuer.uploadedFiles?.equipment_inventory || []
                        )}
                      </div>
                      <div>
                        <p>
                          <b>Barangay Clearance</b>
                        </p>
                        {renderUploadedFiles(
                          previewRescuer.uploadedFiles?.barangay_clearance || []
                        )}
                      </div>
                    </div>
                  </>
                )}

                <p>
                  <b>Status:</b>{" "}
                  <span className={`app-badge app-badge-${previewRescuer.status}`}>
                    {previewRescuer.status}
                  </span>
                </p>
              </div>

              <div className="app-modal-footer">
                <button
                  type="button"
                  className="app-btn app-btn-outline"
                  onClick={() =>
                    setRescuerPreviewPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={rescuerPreviewPage === 1}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className="app-btn app-btn-outline"
                  onClick={() =>
                    setRescuerPreviewPage((prev) => Math.min(prev + 1, 3))
                  }
                  disabled={rescuerPreviewPage === 3}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
