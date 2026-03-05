// ================= APPLICANTS SERVICE =================
// This service handles all business logic for applicants/users
// Following clean architecture principles

import { db } from "./firebase";
import { collection, onSnapshot, updateDoc, doc, query, where } from "firebase/firestore";

const getTimeValue = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return new Date(value).getTime() || 0;
};

/**
 * Fetch real-time users from Firestore with ascending order
 * @param {Function} callback - Called with sorted and formatted users
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUsers = (callback) => {
  // Only subscribe to documents where roles === 'user'
  const q = query(collection(db, "Users"), where("roles", "==", "user"));
  const unsub = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        status: docSnap.data().status || "pending",
      }))
      .sort((a, b) => {
        // Sort by timestamp in ascending order (oldest first)
        const timeA = getTimeValue(a.createdAt);
        const timeB = getTimeValue(b.createdAt);
        return timeA - timeB;
      });

    callback(data);
  });

  return unsub;
};

export const subscribeToRescuerApplicants = (callback) => {
  const rescuerRef = query(collection(db, "Users"), where("roles", "==", "rescuer"));

  const unsub = onSnapshot(rescuerRef, (snapshot) => {
    const data = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        status: docSnap.data().status || "pending",
      }))
      .sort((a, b) => {
        const timeA = getTimeValue(a.createdAt);
        const timeB = getTimeValue(b.createdAt);
        return timeA - timeB;
      });

    callback(data);
  });

  return unsub;
};

/**
 * Subscribe to new users only (for admin notifications)
 * @param {Set} previousIds - Set of previously seen user IDs
 * @param {Function} onNewUser - Called when new user detected
 * @returns {Function} Unsubscribe function
 */
export const subscribeToNewUsers = (previousIds, onNewUser) => {
  const unsub = onSnapshot(collection(db, "Users"), (snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      const id = docSnap.id;
      const data = { id, ...docSnap.data(), status: docSnap.data().status || "pending" };

      if (!previousIds.has(id)) {
        previousIds.add(id);
        onNewUser(data);
      }
    });
  });

  return unsub;
};

/**
 * Update user status in Firestore
 * @param {string} userId - The user ID
 * @param {string} newStatus - New status (approved, rejected, pending)
 * @returns {Promise<void>}
 */
export const updateUserStatus = async (userId, newStatus) => {
  try {
    const userRef = doc(db, "Users", userId);
    await updateDoc(userRef, { status: newStatus });
    return { success: true };
  } catch (error) {
    throw new Error("Failed to update user status: " + error.message);
  }
};

/**
 * Filter users based on search text and status
 * @param {Array} users - List of users
 * @param {string} search - Search text
 * @param {string} statusFilter - Status filter
 * @returns {Array} Filtered users
 */
export const filterUsers = (
  users,
  search = "",
  statusFilter = "all"
) => {
  return users.filter((u) => {
    const fullText = `
      ${u.firstName || ""}
      ${u.lastName || ""}
      ${u.email || ""}
      ${u.fullAddress || ""}
      ${u.phoneNumber || ""}
    `.toLowerCase();

    const matchesSearch = fullText.includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || u.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
};

export const filterRescuerApplicants = (
  applicants,
  search = "",
  statusFilter = "all"
) => {
  return applicants.filter((applicant) => {
    const leaderFirstName = applicant.leaderLeadRescuer?.first_name || "";
    const leaderLastName = applicant.leaderLeadRescuer?.last_name || "";
    const leaderFullName = `${leaderFirstName} ${leaderLastName}`.trim();
    const fallbackFullName = `${applicant.firstName || ""} ${applicant.lastName || ""}`.trim();

    const fullText = `
      ${applicant.organizationInformation?.organization_name || ""}
      ${leaderFullName}
      ${applicant.leaderLeadRescuer?.full_name || ""}
      ${applicant.leaderLeadRescuer?.email_address || ""}
      ${fallbackFullName}
      ${applicant.email || ""}
    `.toLowerCase();

    const matchesSearch = fullText.includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || applicant.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
};
