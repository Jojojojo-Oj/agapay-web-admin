// ================= INCIDENTS SERVICE =================
// This service handles all business logic for incidents/SOS reports
// Following clean architecture principles

import { db } from "./firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import axios from "axios";
import { sendAdminNotification } from "./notificationUtility";

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
