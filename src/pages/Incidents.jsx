import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/incidents.css";
import "../styles/groupchats.css";

import {
  subscribeToIncidents,
  updateIncidentStatus,
  getDisasterTypes,
  filterIncidents,
  subscribeToIncidentChats,
  getUserSelfieUrl,
  getUserDisplayNames,
  sendIncidentTextMessage,
  sendIncidentImageMessage,
} from "../services/incidentsService";
import { getAddressForLocation, parseCoordinates } from "../services/geocode";
import { auth } from "../services/firebase";

// ===== ALARM CONFIGURATION =====
const ALARM_CONFIG = {
  soundFile: "/alarm.mp3", // 👈 CHANGE THIS to your custom sound file
};
// ===============================

export default function Incidents() {
  const [reports, setReports] = useState([]);
  const [previewReport, setPreviewReport] = useState(null);
  const [search, setSearch] = useState("");
  const [disasterTypeFilter, setDisasterTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notificationBanner, setNotificationBanner] = useState(null);
  const [addressMap, setAddressMap] = useState({});
  const [notifications, setNotifications] = useState([]); // Queue of notifications
  const [isChatsOpen, setIsChatsOpen] = useState(false);
  const [selectedChatReport, setSelectedChatReport] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatAvatarMap, setChatAvatarMap] = useState({});
  const [chatInput, setChatInput] = useState("");
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isDragOverChat, setIsDragOverChat] = useState(false);
  const [previewRescuerNames, setPreviewRescuerNames] = useState([]);
  const [isPreviewRescuersLoading, setIsPreviewRescuersLoading] = useState(false);

  const prevReportIds = useRef(new Set());
  const alarmIntervalRef = useRef(null); // To control alarm playback
  const alarmTimeoutRef = useRef(null); // To stop alarm after duration
  const currentAudioRef = useRef(null); // To track and stop current audio
  const photoInputRef = useRef(null);
  const chatBodyRef = useRef(null);

  /* ================= PLAY CUSTOM ALARM SOUND ================= */
  const playFallbackBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn("Could not play fallback beep:", error);
    }
  }, []);

  const playAlarmSound = useCallback(() => {
    try {
      // Stop previous audio if playing
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      }

      // Try to play custom audio file first
      const audio = new Audio(ALARM_CONFIG.soundFile);
      currentAudioRef.current = audio;
      audio.play().catch(() => {
        // Fallback to beep sound if custom sound fails
        playFallbackBeep();
      });
    } catch (error) {
      console.warn("Could not play alarm sound:", error);
      playFallbackBeep();
    }
  }, [playFallbackBeep]);

  const startAlarmOnce = useCallback(() => {
    playAlarmSound();
    // Stop alarm after 5 seconds
    alarmTimeoutRef.current = setTimeout(() => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    }, 5000);
  }, [playAlarmSound]);

  /* ================= REAL-TIME INCIDENT SUBSCRIPTION ================= */
  useEffect(() => {
    const unsub = subscribeToIncidents((data) => {
      if (prevReportIds.current.size === 0) {
        data.forEach((r) => prevReportIds.current.add(r.id));
      } else {
        data.forEach((r) => {
          if (!prevReportIds.current.has(r.id)) {
            // Add to notification queue
            const newNotif = {
              id: r.id,
              senderName: r.senderName || "Unknown",
              disasterType: r.disasterType,
              timestamp: new Date(),
            };
            setNotifications((prev) => [newNotif, ...prev]);
            startAlarmOnce();
            prevReportIds.current.add(r.id);
          }
        });
      }
      setReports(data);
    });

    return () => unsub();
  }, [startAlarmOnce]);

  // Resolve human-readable addresses for any reports with coordinates
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

  /* ================= FILTERS ================= */
  const disasterTypes = useMemo(() => getDisasterTypes(reports), [reports]);

  const filteredReports = useMemo(() => {
    // ✅ Existing filtering logic
    const results = filterIncidents(reports, search, disasterTypeFilter, statusFilter);
    const visibleResults = results.filter(
      (incident) => incident.status === "pending" || incident.status === "active"
    );

    // ✅ UI SORTING ONLY (Pending first)
    const statusPriority = {
      pending: 1,
      active: 2,     // Published
      rejected: 3,
    };

    return [...visibleResults].sort((a, b) => {
      const prioA = statusPriority[a.status] ?? 99;
      const prioB = statusPriority[b.status] ?? 99;

      // 1) Status priority
      if (prioA !== prioB) return prioA - prioB;

      // 2) Sort by Sender Name (alphabetical)
      const senderA = (a.senderName || "").toLowerCase().trim();
      const senderB = (b.senderName || "").toLowerCase().trim();

      if (senderA !== senderB) return senderA.localeCompare(senderB);

      // 3) Sort by ID (alphabetical fallback)
      const idA = (a.id || "").toLowerCase();
      const idB = (b.id || "").toLowerCase();

      return idA.localeCompare(idB);
    });
  }, [reports, search, disasterTypeFilter, statusFilter]);

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

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  };
  

  /* ================= STATUS UPDATE ================= */
  const handleStatusChange = async (reportId, newStatus) => {
    stopAlarm(); // Stop alarm when taking action
    
    const actionColor = newStatus === "active" ? "#16a34a" : "#dc2626";
    
    const result = await Swal.fire({
      title: newStatus === "active" ? "Post Incident" : "Reject Incident",
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
        const prettyLocation =
          addressMap[reportId] || incident?.location || "Unknown";

        setNotificationBanner({
          type: "success",
          title: "Incident Posted",
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

  const openChatsDrawer = (report) => {
    setSelectedChatReport(report);
    setChatMessages([]);
    setChatError("");
    setChatInput("");
    setSelectedPhotoFile(null);
    setIsChatsOpen(true);
  };

  const closeChatsDrawer = () => {
    setIsChatsOpen(false);
    setSelectedChatReport(null);
    setChatMessages([]);
    setChatError("");
    setChatInput("");
    setSelectedPhotoFile(null);
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

  const isAdminMessage = (message) => {
    const currentUid = auth.currentUser?.uid;
    return Boolean(currentUid && message?.senderId === currentUid);
  };

  const getActiveChatId = useCallback(() => {
    if (!selectedChatReport) return "";
    return (
      selectedChatReport.groupChatId ||
      selectedChatReport.chatId ||
      selectedChatReport.id ||
      ""
    );
  }, [selectedChatReport]);

  const handlePhotoPick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith("image/")) {
      setChatError("Please select an image file.");
      event.target.value = "";
      return;
    }

    setSelectedPhotoFile(file);
    setChatError("");
    event.target.value = "";
  };

  const handlePasteImage = (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type?.startsWith("image/"));

    if (!imageItem) return;

    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

    setSelectedPhotoFile(file);
    setChatError("");
  };

  const handleChatDragOver = (event) => {
    event.preventDefault();
    setIsDragOverChat(true);
  };

  const handleChatDragLeave = (event) => {
    event.preventDefault();
    setIsDragOverChat(false);
  };

  const handleChatDrop = (event) => {
    event.preventDefault();
    setIsDragOverChat(false);

    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    let imageFile = droppedFiles.find((file) => file.type?.startsWith("image/"));

    if (!imageFile) {
      const items = Array.from(event.dataTransfer?.items || []);
      const imageItem = items.find((item) => item.type?.startsWith("image/"));
      imageFile = imageItem?.getAsFile() || null;
    }

    if (!imageFile) return;

    setSelectedPhotoFile(imageFile);
    setChatError("");
  };

  const handleSendChat = async () => {
    const chatId = getActiveChatId();
    const senderId = auth.currentUser?.uid;
    const senderName = "Admin";
    const hasText = chatInput.trim().length > 0;

    if (!chatId || !senderId) {
      setChatError("Unable to send message right now.");
      return;
    }

    if (!hasText && !selectedPhotoFile) return;

    setIsSendingMessage(true);
    setChatError("");

    try {
      if (selectedPhotoFile) {
        await sendIncidentImageMessage({
          chatId,
          senderId,
          senderName,
          file: selectedPhotoFile,
        });
      }

      if (hasText) {
        await sendIncidentTextMessage({
          chatId,
          senderId,
          senderName,
          text: chatInput,
        });
      }

      setChatInput("");
      setSelectedPhotoFile(null);
    } catch (error) {
      setChatError("Failed to send message. Please try again.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleComposeKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isSendingMessage) handleSendChat();
    }
  };

  return (
    <div className="inc-page">
      {/* HEADER */}
      <div className="inc-header">
        <div>
          <h2 className="inc-title">Incidents</h2>
          <p className="inc-subtitle">
            Monitor SOS reports, review details, and post incidents for responders.
          </p>
        </div>

        <div className="inc-header-chip">Real-time</div>
      </div>

      {/* ================= NOTIFICATION BANNER ================= */}
      {notificationBanner && (
        <div className="inc-banner inc-banner-success">
          <div className="inc-banner-content">
            <div className="inc-banner-title">{notificationBanner.title}</div>
            <div className="inc-banner-message">{notificationBanner.message}</div>

            <div className="inc-banner-details">
              <p>
                <strong>Sender:</strong> {notificationBanner.details.sender}
              </p>
              <p>
                <strong>Type:</strong> {notificationBanner.details.type}
              </p>
              <p>
                <strong>Location:</strong> {notificationBanner.details.location}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="inc-banner-close"
            onClick={() => setNotificationBanner(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= NOTIFICATION STACK ================= */}
      <div className="inc-notification-stack">
        {notifications.map((notif) => (
          <div key={notif.id} className="inc-notification-item">
            <div className="inc-notif-header">
              <h4 className="inc-notif-title">🚨 New Incident Report</h4>
              <button
                className="inc-notif-close"
                onClick={() =>
                  setNotifications((prev) => prev.filter((n) => n.id !== notif.id))
                }
              >
                ✕
              </button>
            </div>
            <div className="inc-notif-body">
              <p><strong>From:</strong> {notif.senderName}</p>
              <p><strong>Type:</strong> {notif.disasterType}</p>
              <p className="inc-notif-time">
                {notif.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CONTROLS CARD */}
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
          <select
            className="inc-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Published</option>
          </select>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="inc-card">
        {filteredReports.length === 0 ? (
          <div className="inc-empty">
            <div className="inc-empty-title">No incidents found</div>
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
                  <th>Actions</th>
                  <th>View Chats</th>
                </tr>
              </thead>

              <tbody>
                {filteredReports.map((r) => (
                  <tr key={r.id}>
                    <td className="inc-id">{formatIncidentDisplayId(r)}</td>
                    <td>{r.senderName || "—"}</td>
                    <td>{r.disasterType || "—"}</td>
                    <td className="location-cell">
                      {addressMap[r.id] || r.location || "—"}
                    </td>

                    <td>
                      <span className={`inc-badge inc-badge-${r.status}`}>
                        {r.status}
                      </span>
                    </td>

                    {/* PREVIEW */}
                    <td>
                      <button
                        type="button"
                        className="inc-btn inc-btn-outline"
                        onClick={() => setPreviewReport(r)}
                      >
                        View
                      </button>
                    </td>

                    

                    {/* ACTIONS */}
                    <td className="inc-actions">
                      <button
                        type="button"
                        className="inc-btn inc-btn-success"
                        onClick={() => handleStatusChange(r.id, "active")}
                      >
                        Post
                      </button>

                      <button
                        type="button"
                        className="inc-btn inc-btn-danger"
                        onClick={() => handleStatusChange(r.id, "rejected")}
                      >
                        Reject
                      </button>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="inc-btn inc-btn-primary"
                        onClick={() => openChatsDrawer(r)}
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

      {/* ================= CHATS DRAWER ================= */}
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

          <div
            ref={chatBodyRef}
            className={`group-chat-body ${isDragOverChat ? "is-drag-over" : ""}`}
            onDragOver={handleChatDragOver}
            onDragLeave={handleChatDragLeave}
            onDrop={handleChatDrop}
          >
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

          {selectedPhotoFile && (
            <div className="group-chat-selected-photo">
              <span className="group-chat-selected-photo-name">
                {selectedPhotoFile.name || "Selected photo"}
              </span>
              <button
                type="button"
                className="group-chat-selected-photo-clear"
                onClick={() => setSelectedPhotoFile(null)}
              >
                Remove
              </button>
            </div>
          )}

          <div className="group-chat-compose">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoPick}
              className="group-chat-file-input"
            />

            <input
              type="text"
              className="group-chat-compose-input"
              placeholder="Type a message"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onPaste={handlePasteImage}
              onKeyDown={handleComposeKeyDown}
              disabled={isSendingMessage}
            />

            <button
              type="button"
              className="group-chat-compose-photo"
              title="Add photo"
              onClick={() => photoInputRef.current?.click()}
              disabled={isSendingMessage}
            >
              Photo
            </button>

            <button
              type="button"
              className="group-chat-compose-send"
              title="Send message"
              onClick={handleSendChat}
              disabled={isSendingMessage}
            >
              {isSendingMessage ? "Sending..." : "Send"}
            </button>
          </div>
        </aside>
      </div>

      {/* ================= PREVIEW MODAL (UNIQUE CLASSES) ================= */}
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
              {/* LEFT DETAILS */}
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

              {/* RIGHT IMAGE */}
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
    </div>
  );
}
