import React, { useEffect, useState, useRef, useMemo } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/applicant.css";
import {
  subscribeToUsers,
  updateUserStatus,
  filterUsers,
} from "../services/applicantsService";
import { sendAdminNotification } from "../services/notificationUtility";

export default function Applicants() {
  const [users, setUsers] = useState([]);
  const [previewUser, setPreviewUser] = useState(null);

  // 🔍 Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  /* ================= FILTER LOGIC ================= */
  const filteredUsers = useMemo(() => {
    return filterUsers(users, search, statusFilter);
  }, [users, search, statusFilter]);

  /* ================= ACTIONS ================= */
  const handleStatusChange = async (userId, newStatus) => {
    const result = await Swal.fire({
      title: `${newStatus.toUpperCase()} USER`,
      text: `Are you sure you want to ${newStatus} this user?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: newStatus === "approved" ? "#16a34a" : "#dc2626",
      confirmButtonText: `Yes, ${newStatus}`,
    });

    if (result.isConfirmed) {
      try {
        await updateUserStatus(userId, newStatus);
        Swal.fire("Success", "User status updated", "success");
      } catch (err) {
        Swal.fire("Error", "Failed to update user status", "error");
      }
    }
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

  /* ================= UI ================= */
  return (
    <div className="applicant-page">
      <h2 className="applicant-title">Applicants</h2>

      {/* 🔍 SEARCH & FILTER */}
      <div className="applicant-controls">
        <input
          type="text"
          placeholder="Search name, address, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="applicant-search-input"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="applicant-select"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* TABLE */}
      {filteredUsers.length === 0 ? (
        <div className="applicant-empty">No matching applicants</div>
      ) : (
        <div className="applicant-table-wrapper">
          <table className="applicant-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.firstName} {u.lastName}</strong>
                  </td>
                  <td>{u.fullAddress || "—"}</td>
                  <td>
                    <button className="btn-preview" onClick={() => setPreviewUser(u)}>
                      Preview
                    </button>
                  </td>
                  <td>
                    <span className={`badge badge-${u.status}`}>{u.status}</span>
                  </td>
                  <td>
                    <button
                      className="btn-approve"
                      onClick={() => handleStatusChange(u.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => handleStatusChange(u.id, "rejected")}
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

      {/* MODAL */}
      {previewUser && (
        <div className="applicant-overlay" onClick={() => setPreviewUser(null)}>
          <div className="applicant-modal" onClick={(e) => e.stopPropagation()}>
            
            {/* LEFT INFO */}
            <div className="applicant-modal-left">
              <h3>User Details</h3>

              <p><b>Name:</b> {previewUser.firstName} {previewUser.lastName}</p>
              <p><b>Email:</b> {previewUser.email}</p>
              <p><b>Address:</b> {previewUser.fullAddress}</p>
              <p><b>Phone:</b> {previewUser.phoneNumber}</p>
              <p><b>Birthday:</b> {previewUser.birthday}</p>
              <p>
                <b>Status:</b>{" "}
                <span className={`badge badge-${previewUser.status}`}>
                  {previewUser.status}
                </span>
              </p>
            </div>

            {/* RIGHT IMAGES */}
            <div className="applicant-modal-right">
              <h3>Verification Images</h3>

              <div className="applicant-image-grid">
                {/* SELFIE */}
                <div>
                  <p className="applicant-image-label">Selfie</p>
                  <img
                    src={previewUser.selfieUrl}
                    alt="Selfie"
                    className="applicant-preview-image"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </div>

                {/* ID */}
                <div>
                  <p className="applicant-image-label">Valid ID</p>
                  <img
                    src={previewUser.idUrl}
                    alt="Valid ID"
                    className="applicant-preview-image"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
