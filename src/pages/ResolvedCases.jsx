import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/incidents.css";
import "../styles/groupchats.css";
import {
  subscribeToIncidents,
  getDisasterTypes,
  filterIncidents,
  subscribeToIncidentChats,
  getUserSelfieUrl,
  getLatestIncidentResolutionLog,
  getUserDisplayName,
  getUserDisplayNames,
} from "../services/incidentsService";
import { getAddressForLocation, parseCoordinates } from "../services/geocode";
import { auth } from "../services/firebase";

export default function ResolvedCases() {
  const [reports, setReports] = useState([]);
  const [previewReport, setPreviewReport] = useState(null);
  const [search, setSearch] = useState("");
  const [disasterTypeFilter, setDisasterTypeFilter] = useState("all");
  const [addressMap, setAddressMap] = useState({});
  const [isChatsOpen, setIsChatsOpen] = useState(false);
  const [selectedChatReport, setSelectedChatReport] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatAvatarMap, setChatAvatarMap] = useState({});
  const [previewRescuerNames, setPreviewRescuerNames] = useState([]);
  const [isPreviewRescuersLoading, setIsPreviewRescuersLoading] = useState(false);
  const [remarksReport, setRemarksReport] = useState(null);
  const [remarksLog, setRemarksLog] = useState(null);
  const [isRemarksLoading, setIsRemarksLoading] = useState(false);
  const [remarksError, setRemarksError] = useState("");
  const [remarksAcceptedByName, setRemarksAcceptedByName] = useState("");
  const chatBodyRef = useRef(null);
  const remarksRequestRef = useRef(0);

  useEffect(() => {
    const unsub = subscribeToIncidents((data) => {
      setReports(data);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!reports || reports.length === 0) return;

    const missing = reports.filter(
      (r) => !addressMap[r.id] && parseCoordinates(r.location)
    );
    if (missing.length === 0) return;

    let cancelled = false;

    (async () => {
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

      await Promise.all(
        Array.from({ length: Math.min(concurrency, missing.length) }, next)
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [reports, addressMap]);

  const disasterTypes = useMemo(() => getDisasterTypes(reports), [reports]);

  const filteredReports = useMemo(() => {
    const resolved = filterIncidents(reports, search, disasterTypeFilter, "resolved");

    return [...resolved].sort((a, b) => {
      const senderA = (a.senderName || "").toLowerCase().trim();
      const senderB = (b.senderName || "").toLowerCase().trim();

      if (senderA !== senderB) return senderA.localeCompare(senderB);
      return (a.id || "").localeCompare(b.id || "");
    });
  }, [reports, search, disasterTypeFilter]);

  const getIncidentTypePrefix = (disasterType) => {
    const normalizedType = (disasterType || "").toLowerCase().trim();

    if (normalizedType.includes("fire")) return "FIRE";
    if (normalizedType.includes("earthquake")) return "EQ";
    if (normalizedType.includes("medical")) return "MD";
    if (normalizedType.includes("typhoon")) return "TYP";

    return "INC";
  };

  const formatIncidentDisplayId = (incident) => {
    const prefix = getIncidentTypePrefix(incident?.disasterType);
    const rawId = (incident?.id || "").trim();
    const shortId = rawId.slice(0, 4).toUpperCase() || "----";

    return `${prefix}-${shortId}`;
  };

  useEffect(() => {
    if (!isChatsOpen || !selectedChatReport) return;

    const chatId =
      selectedChatReport.groupChatId ||
      selectedChatReport.chatId ||
      selectedChatReport.id;

    setIsChatLoading(true);
    setChatError("");

    const unsub = subscribeToIncidentChats(
      chatId,
      (messages) => {
        setChatMessages(messages);
        setIsChatLoading(false);
      },
      () => {
        setChatError("Unable to load chats right now.");
        setIsChatLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [isChatsOpen, selectedChatReport]);

  useEffect(() => {
    if (!isChatsOpen || chatMessages.length === 0) return;

    const senderIdsToLoad = Array.from(
      new Set(chatMessages.map((message) => message.senderId).filter(Boolean))
    ).filter((senderId) => chatAvatarMap[senderId] === undefined);

    if (senderIdsToLoad.length === 0) return;

    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        senderIdsToLoad.map(async (senderId) => {
          const selfieUrl = await getUserSelfieUrl(senderId);
          return { senderId, selfieUrl };
        })
      );

      if (cancelled) return;

      setChatAvatarMap((prev) => {
        const next = { ...prev };
        results.forEach(({ senderId, selfieUrl }) => {
          next[senderId] = selfieUrl || null;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [isChatsOpen, chatMessages, chatAvatarMap]);

  useEffect(() => {
    if (!isChatsOpen || !chatBodyRef.current) return;

    chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatMessages, isChatsOpen]);

  useEffect(() => {
    if (!previewReport) {
      setPreviewRescuerNames([]);
      setIsPreviewRescuersLoading(false);
      return;
    }

    const rescuerIds = Array.isArray(previewReport.rescuers)
      ? previewReport.rescuers.filter(Boolean)
      : [];

    if (rescuerIds.length === 0) {
      setPreviewRescuerNames([]);
      setIsPreviewRescuersLoading(false);
      return;
    }

    let cancelled = false;
    setIsPreviewRescuersLoading(true);

    (async () => {
      const names = await getUserDisplayNames(rescuerIds);
      if (cancelled) return;

      setPreviewRescuerNames(names);
      setIsPreviewRescuersLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [previewReport]);

  const openChatsDrawer = (report) => {
    setSelectedChatReport(report);
    setChatMessages([]);
    setChatError("");
    setIsChatsOpen(true);
  };

  const closeChatsDrawer = () => {
    setIsChatsOpen(false);
    setSelectedChatReport(null);
    setChatMessages([]);
    setChatError("");
    setIsChatLoading(false);
  };

  const getSenderInitials = (name) => {
    const clean = (name || "U").trim();
    if (!clean) return "U";

    const parts = clean.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  };

  const getDisplaySenderName = (message) => {
    const currentUid = auth.currentUser?.uid;
    if (currentUid && message?.senderId === currentUid) return "Admin";
    return message?.senderName || "Unknown";
  };

  const isAdminMessage = (message) => {
    const currentUid = auth.currentUser?.uid;
    return Boolean(currentUid && message?.senderId === currentUid);
  };

  const formatDateTime = (value) => {
    if (!value) return "—";

    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString();
  };

  const closeRemarksModal = () => {
    setRemarksReport(null);
    setRemarksLog(null);
    setRemarksError("");
    setRemarksAcceptedByName("");
    setIsRemarksLoading(false);
  };

  const openRemarksModal = async (report) => {
    setRemarksReport(report);
    setRemarksLog(null);
    setRemarksError("");
    setRemarksAcceptedByName("");
    setIsRemarksLoading(true);

    const requestId = ++remarksRequestRef.current;

    try {
      const [resolutionLog, acceptedByName] = await Promise.all([
        getLatestIncidentResolutionLog(report.id),
        report.acceptedBy ? getUserDisplayName(report.acceptedBy) : Promise.resolve(""),
      ]);

      if (requestId !== remarksRequestRef.current) return;

      setRemarksLog(resolutionLog);
      setRemarksAcceptedByName(acceptedByName || "");
      setIsRemarksLoading(false);
    } catch (_) {
      if (requestId !== remarksRequestRef.current) return;

      setRemarksError("Unable to load resolved information right now.");
      setIsRemarksLoading(false);
    }
  };

  return (
    <div className="inc-page">
      <div className="inc-header">
        <div>
          <h2 className="inc-title">Resolved Cases</h2>
          <p className="inc-subtitle">
            View resolved incidents in the same table layout.
          </p>
        </div>

        <div className="inc-header-chip">Resolved</div>
      </div>

      <div className="inc-card inc-controls">
        <div className="inc-control-group">
          <label className="inc-label">Search</label>
          <input
            className="inc-input"
            type="text"
            placeholder="Search by sender, type, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="inc-control-group">
          <label className="inc-label">Disaster Type</label>
          <select
            className="inc-select"
            value={disasterTypeFilter}
            onChange={(e) => setDisasterTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            {disasterTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="inc-control-group">
          <label className="inc-label">Status</label>
          <input className="inc-input" type="text" value="Resolved" disabled />
        </div>
      </div>

      <div className="inc-card">
        {filteredReports.length === 0 ? (
          <div className="inc-empty">
            <div className="inc-empty-title">No resolved cases found</div>
            <div className="inc-empty-subtitle">
              Try searching another keyword or change filters.
            </div>
          </div>
        ) : (
          <div className="inc-table-wrap">
            <table className="inc-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Sender</th>
                  <th>Type</th>
                  <th className="location-header">Location</th>
                  <th>Status</th>
                  <th>Preview</th>
                  <th>Remarks</th>
                  <th>View Chats</th>
                </tr>
              </thead>

              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td className="inc-id">{formatIncidentDisplayId(report)}</td>
                    <td>{report.senderName || "—"}</td>
                    <td>{report.disasterType || "—"}</td>
                    <td className="location-cell">
                      {addressMap[report.id] || report.location || "—"}
                    </td>
                    <td>
                      <span className={`inc-badge inc-badge-${report.status}`}>
                        {report.status}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="inc-btn inc-btn-outline"
                        onClick={() => setPreviewReport(report)}
                      >
                        View
                      </button>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="inc-btn inc-btn-success"
                        onClick={() => openRemarksModal(report)}
                      >
                        Remarks
                      </button>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="inc-btn inc-btn-primary"
                        onClick={() => openChatsDrawer(report)}
                      >
                        View Chats
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        className={`group-chat-overlay ${isChatsOpen ? "is-open" : ""}`}
        onClick={closeChatsDrawer}
      >
        <aside
          className={`group-chat-drawer ${isChatsOpen ? "is-open" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="group-chat-header">
            <div className="group-chat-header-info">
              <div className="group-chat-title">View Chats</div>
              <div className="group-chat-subtitle">
                {selectedChatReport?.senderName || "Unknown"} •{" "}
                {selectedChatReport?.disasterType || "Unknown"}
              </div>
            </div>
            <button
              type="button"
              className="group-chat-close"
              onClick={closeChatsDrawer}
            >
              Close
            </button>
          </div>

          <div ref={chatBodyRef} className="group-chat-body">
            {isChatLoading ? (
              <div className="group-chat-empty">Loading chats...</div>
            ) : chatError ? (
              <div className="group-chat-empty">{chatError}</div>
            ) : chatMessages.length === 0 ? (
              <div className="group-chat-empty">No chats found.</div>
            ) : (
              chatMessages.map((message) => {
                const adminMessage = isAdminMessage(message);
                const avatarUrl =
                  message.senderId && chatAvatarMap[message.senderId]
                    ? chatAvatarMap[message.senderId]
                    : "";

                return (
                  <div
                    key={message.id}
                    className={`group-chat-message ${
                      adminMessage ? "is-admin" : ""
                    }`}
                  >
                    <div className="group-chat-avatar">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={getDisplaySenderName(message)}
                          className="group-chat-avatar-img"
                        />
                      ) : (
                        getSenderInitials(getDisplaySenderName(message))
                      )}
                    </div>

                    <div className="group-chat-content">
                      <div className="group-chat-meta">
                        <span className="group-chat-sender">
                          {getDisplaySenderName(message)}
                        </span>
                        <span className="group-chat-time">
                          {message.createdAt
                            ? message.createdAt.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>

                      <div
                        className={`group-chat-bubble ${
                          adminMessage ? "is-admin" : ""
                        }`}
                      >
                        {message.mediaUrl ? (
                          <img
                            src={message.mediaUrl}
                            alt="Shared"
                            className="group-chat-image"
                          />
                        ) : null}

                        {message.text ? (
                          <div className="group-chat-text">{message.text}</div>
                        ) : !message.mediaUrl ? (
                          "(No message text)"
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {previewReport && (
        <div className="inc-modal-overlay" onClick={() => setPreviewReport(null)}>
          <div
            className="inc-modal-card inc-modal-card-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inc-modal-header">
              <div>
                <div className="inc-modal-title">Incident Details</div>
                <div className="inc-modal-subtitle">
                  {previewReport.senderName || "Unknown"} •{" "}
                  {previewReport.disasterType || "Unknown"}
                </div>
              </div>

              <button
                type="button"
                className="inc-btn inc-btn-outline"
                onClick={() => setPreviewReport(null)}
              >
                Close
              </button>
            </div>

            <div className="inc-preview-body">
              <div className="inc-preview-left">
                <div className="inc-preview-row">
                  <span className="inc-preview-label">Sender</span>
                  <span className="inc-preview-value">
                    {previewReport.senderName || "—"}
                  </span>
                </div>

                <div className="inc-preview-row">
                  <span className="inc-preview-label">Type</span>
                  <span className="inc-preview-value">
                    {previewReport.disasterType || "—"}
                  </span>
                </div>

                <div className="inc-preview-row">
                  <span className="inc-preview-label">Location</span>
                  <span className="inc-preview-value">
                    {addressMap[previewReport.id] ||
                      previewReport.location ||
                      "—"}
                  </span>
                </div>

                <div className="inc-preview-row">
                  <span className="inc-preview-label">Status</span>
                  <span className={`inc-badge inc-badge-${previewReport.status}`}>
                    {previewReport.status}
                  </span>
                </div>

                <div className="inc-preview-row">
                  <span className="inc-preview-label">Rescuer(s)</span>
                  <span className="inc-preview-value">
                    {isPreviewRescuersLoading
                      ? "Loading..."
                      : previewRescuerNames.length > 0
                      ? previewRescuerNames.join(", ")
                      : "Unassigned"}
                  </span>
                </div>

                <div className="inc-preview-divider" />

                <div className="inc-preview-desc-title">Description</div>
                <div className="inc-preview-desc">
                  {previewReport.details || "No description provided."}
                </div>
              </div>

              <div className="inc-preview-right">
                <div className="inc-preview-image-title">Incident Image</div>

                {previewReport.imagePath ? (
                  <img src={previewReport.imagePath} alt="Incident" />
                ) : (
                  <div className="inc-no-image">No image available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {remarksReport && (
        <div className="inc-modal-overlay" onClick={closeRemarksModal}>
          <div className="inc-modal-card inc-modal-card-lg" onClick={(e) => e.stopPropagation()}>
            <div className="inc-modal-header">
              <div>
                <div className="inc-modal-title">Resolved Information</div>
                <div className="inc-modal-subtitle">
                  {remarksReport.senderName || "Unknown"} • {remarksReport.disasterType || "Unknown"}
                </div>
              </div>

              <button type="button" className="inc-btn inc-btn-outline" onClick={closeRemarksModal}>
                Close
              </button>
            </div>

            <div className="inc-preview-body">
              <div className="inc-preview-left">
                <div className="inc-preview-row">
                  <span className="inc-preview-label">Incident ID</span>
                  <span className="inc-preview-value">{formatIncidentDisplayId(remarksReport)}</span>
                </div>

                <div className="inc-preview-row">
                  <span className="inc-preview-label">Accepted At</span>
                  <span className="inc-preview-value">{formatDateTime(remarksReport.acceptedAt)}</span>
                </div>

                <div className="inc-preview-row">
                  <span className="inc-preview-label">Accepted By</span>
                  <span className="inc-preview-value">
                    {remarksAcceptedByName || remarksReport.acceptedBy || "—"}
                  </span>
                </div>

                <div className="inc-preview-row">
                  <span className="inc-preview-label">Resolved At</span>
                  <span className="inc-preview-value">
                    {isRemarksLoading
                      ? "Loading..."
                      : formatDateTime(remarksLog?.resolvedAt || remarksLog?.resolvedAtIso)}
                  </span>
                </div>

                <div className="inc-preview-divider" />

                <div className="inc-preview-desc-title">Remarks</div>
                <div className="inc-preview-desc">
                  {isRemarksLoading
                    ? "Loading resolved remarks..."
                    : remarksError
                    ? remarksError
                    : remarksLog?.additionalDetails || "No remarks provided."}
                </div>
              </div>

              <div className="inc-preview-right">
                <div className="inc-preview-image-title">Proof Image</div>
                {isRemarksLoading ? (
                  <div className="inc-no-image">Loading proof image...</div>
                ) : remarksLog?.proofImageUrl ? (
                  <img src={remarksLog.proofImageUrl} alt="Resolution proof" />
                ) : (
                  <div className="inc-no-image">No proof image available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
