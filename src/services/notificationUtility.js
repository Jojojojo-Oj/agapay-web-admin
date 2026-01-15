// ================= NOTIFICATION UTILITY =================
// Handles all notification types: browser notifications, toasts, sounds

/**
 * Play a notification sound
 * @param {string} soundType - Type of sound: 'success', 'info', 'warning'
 */
export const playNotificationSound = (soundType = "success") => {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different frequencies and durations for different sound types
    const soundConfigs = {
      success: { frequency: 800, duration: 0.2 }, // High pitch, short
      info: { frequency: 600, duration: 0.15 },
      warning: { frequency: 400, duration: 0.3 }, // Low pitch, longer
      news: { frequency: 700, duration: 0.25 },
      announcement: { frequency: 750, duration: 0.25 },
    };

    const config = soundConfigs[soundType] || soundConfigs.success;

    oscillator.frequency.value = config.frequency;
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + config.duration);
  } catch (error) {
    console.warn("Could not play notification sound:", error);
  }
};

/**
 * Send browser notification (requires permission)
 * @param {string} title - Notification title
 * @param {Object} options - Notification options
 */
export const sendBrowserNotification = (title, options = {}) => {
  if (!("Notification" in window)) {
    console.warn("Browser does not support notifications");
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/favicon.ico",
      ...options,
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, {
          icon: "/favicon.ico",
          ...options,
        });
      }
    });
  }
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.warn("Browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

/**
 * Send admin notification for new incident/applicant
 * @param {string} type - Type of notification: 'incident', 'applicant'
 * @param {Object} data - Data for the notification
 */
export const sendAdminNotification = async (type, data) => {
  const notificationConfigs = {
    incident: {
      title: `🚨 New Incident Report`,
      body: `${data.senderName || "Unknown"} reported a ${data.disasterType}`,
      tag: `incident-${data.id}`,
      requireInteraction: true,
    },
    applicant: {
      title: `👤 New Applicant`,
      body: `${data.firstName || ""} ${data.lastName || ""} submitted an application`,
      tag: `applicant-${data.id}`,
      requireInteraction: true,
    },
  };

  const config = notificationConfigs[type];
  if (!config) return;

  // Play sound
  playNotificationSound(type === "incident" ? "warning" : "info");

  // Send browser notification
  sendBrowserNotification(config.title, {
    body: config.body,
    tag: config.tag,
    badge: "/favicon.ico",
    requireInteraction: config.requireInteraction,
  });
};

/**
 * Send admin notification when news is published
 */
export const sendNewsPublishedNotification = () => {
  playNotificationSound("news");
  sendBrowserNotification("📰 News Published", {
    body: "Your news has been successfully published and sent to users",
    tag: "news-published",
  });
};

/**
 * Send admin notification when announcement is published
 */
export const sendAnnouncementPublishedNotification = () => {
  playNotificationSound("announcement");
  sendBrowserNotification("📢 Announcement Published", {
    body: "Your announcement has been successfully published and sent to users",
    tag: "announcement-published",
  });
};
