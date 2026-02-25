// ================= INCIDENTS SERVICE =================
// This service handles all business logic for incidents/SOS reports
// Following clean architecture principles

import { db, storage } from "./firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import axios from "axios";

/**
 * Fetch real-time SOS reports from Firestore
 * @param {Function} callback - Called with sorted and formatted reports
 * @returns {Function} Unsubscribe function
 */
export const subscribeToIncidents = (callback) => {
  const unsub = onSnapshot(collection(db, "sos_reports"), (snapshot) => {
    const data = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .sort((a, b) => {
        // Sort by timestamp in ascending order (oldest first)
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });

    callback(data);
  });

  return unsub;
};

/**
 * Subscribe to new incidents only (for admin notifications)
 * @param {Set} previousIds - Set of previously seen incident IDs
 * @param {Function} onNewIncident - Called when new incident detected
 * @returns {Function} Unsubscribe function
 */
export const subscribeToNewIncidents = (previousIds, onNewIncident) => {
  const unsub = onSnapshot(collection(db, "sos_reports"), (snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      const id = docSnap.id;
      const data = { id, ...docSnap.data() };

      if (!previousIds.has(id)) {
        previousIds.add(id);
        onNewIncident(data);
      }
    });
  });

  return unsub;
};

/**
 * Update incident status in Firestore
 * @param {string} reportId - The incident ID
 * @param {string} newStatus - New status (active, rejected, pending)
 * @returns {Promise<void>}
 */
export const updateIncidentStatus = async (reportId, newStatus) => {
  try {
    const reportRef = doc(db, "sos_reports", reportId);
    await updateDoc(reportRef, { status: newStatus });

    // If publishing (making active), notify rescuers via FCM tokens
    if (newStatus === "active") {
      try {
        const tokenSet = new Set();

        // Collect tokens from Users where roles == 'rescuer'
        const q = query(
          collection(db, "Users"),
          where("roles", "==", "rescuer")
        );
        const usersSnap = await getDocs(q);
        usersSnap.forEach((d) => {
          const data = d.data() || {};
          if (data.fcmToken) tokenSet.add(data.fcmToken);
          if (data.token) tokenSet.add(data.token);
        });

        // Also check global fcmTokens collection if present
        try {
          const tokensSnap = await getDocs(collection(db, "fcmTokens"));
          tokensSnap.forEach((d) => {
            const data = d.data() || {};
            if (data.token) tokenSet.add(data.token);
            if (data.fcmToken) tokenSet.add(data.fcmToken);
          });
        } catch (e) {
          // optional collection may not exist
        }

        const fcmTokens = Array.from(tokenSet).filter(Boolean);
        if (fcmTokens.length > 0) {
          const notificationPromises = fcmTokens.map((token) =>
            axios
              .post(
                "https://us-central1-agapay-capstone.cloudfunctions.net/sendSingleMessage",
                {
                  title: `🚨 New SOS Report Published`,
                  body: `A new incident has been published. Please check the app.`,
                  token,
                }
              )
              .catch((err) =>
                console.error("Failed to send to token:", token, err)
              )
          );

          await Promise.allSettled(notificationPromises);
          console.log(
            `Notifications attempted for ${fcmTokens.length} rescuer token(s)`
          );
        }
      } catch (notifyErr) {
        console.error("Failed to notify rescuers:", notifyErr);
      }
    }

    return { success: true };
  } catch (error) {
    throw new Error("Failed to update incident status: " + error.message);
  }
};

/**
 * Get unique disaster types from incidents
 * @param {Array} incidents - List of incidents
 * @returns {Array} Array of unique disaster types
 */
export const getDisasterTypes = (incidents) => {
  const types = new Set(
    incidents
      .map((r) => r.disasterType)
      .filter((type) => type && type.trim() !== "")
  );
  return Array.from(types).sort();
};

/**
 * Filter incidents based on search text, disaster type, and status
 * ✅ UPDATED: search now includes incident.id so you can search by ID
 *
 * @param {Array} incidents - List of incidents
 * @param {string} search - Search text
 * @param {string} disasterTypeFilter - Disaster type filter
 * @param {string} statusFilter - Status filter
 * @returns {Array} Filtered incidents
 */
export const filterIncidents = (
  incidents,
  search = "",
  disasterTypeFilter = "all",
  statusFilter = "all"
) => {
  return incidents.filter((incident) => {
    const searchText = `
      ${incident.id || ""}
      ${incident.senderName || ""}
      ${incident.disasterType || ""}
      ${incident.details || ""}
      ${incident.location || ""}
    `
      .toLowerCase()
      .trim();

    const matchesSearch = searchText.includes(search.toLowerCase().trim());

    const matchesDisasterType =
      disasterTypeFilter === "all" ||
      incident.disasterType === disasterTypeFilter;

    const matchesStatus =
      statusFilter === "all" || incident.status === statusFilter;

    return matchesSearch && matchesDisasterType && matchesStatus;
  });
};

/**
 * Subscribe to a group chat's messages in real-time
 * @param {string} chatId - Group chat document ID
 * @param {Function} callback - Called with sorted and normalized messages
 * @param {Function} onError - Optional error callback
 * @returns {Function} Unsubscribe function
 */
export const subscribeToIncidentChats = (chatId, callback, onError) => {
  if (!chatId) {
    callback([]);
    return () => {};
  }

  const messagesRef = collection(db, "group_chats", chatId, "messages");

  return onSnapshot(
    messagesRef,
    (snapshot) => {
      const data = snapshot.docs
        .map((docSnap) => {
          const message = docSnap.data() || {};
          const rawDate = message.sentAt || message.createdAt || null;
          const createdAt = rawDate?.toDate
            ? rawDate.toDate()
            : rawDate
            ? new Date(rawDate)
            : null;

          return {
            id: docSnap.id,
            text: message.message || message.text || "",
            senderName: message.senderName || message.sender || "Unknown",
            senderId: message.senderId || message.userId || "",
            mediaUrl: message.mediaUrl || "",
            type: message.type || "text",
            createdAt,
          };
        })
        .sort((a, b) => {
          const timeA = a.createdAt ? a.createdAt.getTime() : 0;
          const timeB = b.createdAt ? b.createdAt.getTime() : 0;
          return timeA - timeB;
        });

      callback(data);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
};

/**
 * Get the latest resolution log for an incident
 * @param {string} reportId - Incident report ID
 * @returns {Promise<Object|null>} Latest resolution log data or null
 */
export const getLatestIncidentResolutionLog = async (reportId) => {
  if (!reportId) return null;

  try {
    const logsRef = collection(db, "sos_reports", reportId, "resolution_logs");
    const logsSnap = await getDocs(logsRef);

    if (logsSnap.empty) return null;

    const logs = logsSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    const getTimeValue = (value) => {
      if (!value) return 0;
      if (value?.toDate) return value.toDate().getTime();
      if (value instanceof Date) return value.getTime();

      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    logs.sort((a, b) => {
      const timeA = Math.max(
        getTimeValue(a.resolvedAt),
        getTimeValue(a.resolvedAtIso),
        getTimeValue(a.createdAt)
      );
      const timeB = Math.max(
        getTimeValue(b.resolvedAt),
        getTimeValue(b.resolvedAtIso),
        getTimeValue(b.createdAt)
      );
      return timeB - timeA;
    });

    return logs[0] || null;
  } catch (_) {
    return null;
  }
};

/**
 * Resolve a user's selfie URL from Users collection using sender ID
 * @param {string} senderId - Sender/user UID
 * @returns {Promise<string>} Selfie URL or empty string
 */
export const getUserSelfieUrl = async (senderId) => {
  if (!senderId) return "";

  try {
    const directDoc = await getDoc(doc(db, "Users", senderId));
    if (directDoc.exists()) {
      const data = directDoc.data() || {};
      return data.selfieUrl || "";
    }

    const byUidQuery = query(
      collection(db, "Users"),
      where("uid", "==", senderId)
    );
    const byUidSnap = await getDocs(byUidQuery);

    if (!byUidSnap.empty) {
      const data = byUidSnap.docs[0].data() || {};
      return data.selfieUrl || "";
    }

    return "";
  } catch (error) {
    return "";
  }
};

/**
 * Resolve a user's display name from Users collection
 * @param {string} userId - User document ID or uid
 * @returns {Promise<string>} Display name
 */
export const getUserDisplayName = async (userId) => {
  if (!userId) return "Unknown";

  try {
    const directDoc = await getDoc(doc(db, "Users", userId));
    if (directDoc.exists()) {
      const data = directDoc.data() || {};
      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      return fullName || data.name || data.displayName || data.email || "Unknown";
    }

    const byUidQuery = query(collection(db, "Users"), where("uid", "==", userId));
    const byUidSnap = await getDocs(byUidQuery);
    if (!byUidSnap.empty) {
      const data = byUidSnap.docs[0].data() || {};
      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      return fullName || data.name || data.displayName || data.email || "Unknown";
    }

    return "Unknown";
  } catch (_) {
    return "Unknown";
  }
};

/**
 * Resolve multiple users' display names
 * @param {string[]} userIds
 * @returns {Promise<string[]>}
 */
export const getUserDisplayNames = async (userIds = []) => {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const names = await Promise.all(uniqueIds.map((id) => getUserDisplayName(id)));
  return names.filter(Boolean);
};

/**
 * Send a text message to an incident group chat
 * @param {Object} params
 * @param {string} params.chatId
 * @param {string} params.senderId
 * @param {string} params.senderName
 * @param {string} params.text
 */
export const sendIncidentTextMessage = async ({
  chatId,
  senderId,
  senderName,
  text,
}) => {
  const messageText = (text || "").trim();
  if (!chatId || !senderId || !messageText) return;

  const messagesRef = collection(db, "group_chats", chatId, "messages");
  await addDoc(messagesRef, {
    message: messageText,
    senderId,
    senderName: senderName || "Admin",
    sentAt: serverTimestamp(),
    type: "text",
    mediaUrl: null,
    audioDurationSec: null,
  });
};

/**
 * Send an image message to an incident group chat
 * @param {Object} params
 * @param {string} params.chatId
 * @param {string} params.senderId
 * @param {string} params.senderName
 * @param {File} params.file
 */
export const sendIncidentImageMessage = async ({
  chatId,
  senderId,
  senderName,
  file,
}) => {
  if (!chatId || !senderId || !file) return;

  const safeName = (file.name || "image.jpg").replace(/\s+/g, "-");
  const filePath = `group_chats/${chatId}/images/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, filePath);

  await uploadBytes(fileRef, file);
  const mediaUrl = await getDownloadURL(fileRef);

  const messagesRef = collection(db, "group_chats", chatId, "messages");
  await addDoc(messagesRef, {
    message: "",
    senderId,
    senderName: senderName || "Admin",
    sentAt: serverTimestamp(),
    type: "image",
    mediaUrl,
    audioDurationSec: null,
  });
};
