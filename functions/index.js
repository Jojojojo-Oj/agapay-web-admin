const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const express = require("express");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const crypto = require("crypto");

admin.initializeApp();

const adminAlertKey = defineSecret("ALERT_ADMIN_KEY");
const SEMAPHORE_API_KEY = "fc2ad01a41c7dc00c6f982e08a98e50c";

const app = express();

// ✅ Parse JSON
app.use(express.json());

// ✅ Enable CORS
app.use(cors({ origin: true }));

app.post("/", async (req, res) => {
  try {
    const { title, body, token, image } = req.body;

    if (!title || !body || !token) {
      return res.status(400).json({
        error: "title, body, and token are required",
      });
    }

    const message = {
      token,
      notification: {
        title: String(title),
        body: String(body),
      },
      android: {
        priority: "high",
        notification: {
          channelId: "high_importance_channel",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: { sound: "default" },
        },
      },
    };

    if (image && typeof image === "string") {
      message.notification.imageUrl = image;
      message.android.notification.imageUrl = image;
      message.apns.fcm_options = { image };
      message.webpush = {
        notification: { title, body, image },
      };
    }

    await admin.messaging().send(message);

    return res.status(200).json({
      success: true,
      message: "Notification sent",
    });
  } catch (error) {
    console.error("❌ sendSingleMessage error:", error);

    if (
      error.code === "messaging/registration-token-not-registered" ||
      error.code === "messaging/invalid-registration-token"
    ) {
      return res.status(200).json({
        success: false,
        reason: error.code,
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// ✅ V1 EXPORT (NO REGION)
exports.sendSingleMessage = functions.https.onRequest(app);

const normalizePhoneNumber = (value) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");

  if (digits.startsWith("63") && digits.length === 12) return digits;
  if (digits.startsWith("09") && digits.length === 11) {
    return `63${digits.slice(1)}`;
  }
  if (digits.startsWith("9") && digits.length === 10) {
    return `63${digits}`;
  }

  return null;
};

const maskPhone = (value) => {
  const text = String(value || "");
  if (text.length < 6) return text;
  return `${text.slice(0, 4)}****${text.slice(-3)}`;
};

exports.sendSmsAlert = onRequest(
  {
    region: "us-central1",
    cors: true,
    secrets: [adminAlertKey],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      return res.status(405).json({error: "Method Not Allowed"});
    }

    try {
      const {message, sendername} = req.body || {};
      const incomingAdminKey = String(req.get("x-alert-admin-key") || "").trim();

      const expectedAdminKey = String(adminAlertKey.value() || "").trim();
      const providedBuffer = Buffer.from(incomingAdminKey, "utf8");
      const expectedBuffer = Buffer.from(expectedAdminKey, "utf8");

      const isAuthorized =
        expectedBuffer.length > 0 &&
        providedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(providedBuffer, expectedBuffer);

      if (!isAuthorized) {
        return res.status(403).json({error: "Forbidden"});
      }

      if (!message || !String(message).trim()) {
        return res.status(400).json({error: "message is required"});
      }

      const apiKey = SEMAPHORE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({error: "Missing SEMAPHORE_API_KEY"});
      }

      const usersSnap = await admin.firestore().collection("Users").get();
      const numberSet = new Set();

      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.roles !== "user") return;

        const normalized = normalizePhoneNumber(data.phoneNumber);
        if (normalized) numberSet.add(normalized);
      });

      const allNumbers = Array.from(numberSet);
      if (!allNumbers.length) {
        return res.status(404).json({
          success: false,
          message: "No valid user phone numbers found.",
          recipients: 0,
        });
      }

      const chunks = [];
      for (let i = 0; i < allNumbers.length; i += 1000) {
        chunks.push(allNumbers.slice(i, i + 1000));
      }

      const results = await Promise.all(
        chunks.map(async (group) => {
          const payload = new URLSearchParams({
            apikey: apiKey,
            number: group.join(","),
            message: String(message),
          });

          if (sendername && String(sendername).trim()) {
            payload.append("sendername", String(sendername).trim());
          }

          const response = await fetch("https://api.semaphore.co/api/v4/messages", {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: payload.toString(),
          });

          const text = await response.text();
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            parsed = text;
          }

          return {
            ok: response.ok,
            status: response.status,
            count: group.length,
            body: parsed,
          };
        })
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        return res.status(502).json({
          success: false,
          recipients: allNumbers.length,
          failedRequests: failed.length,
          details: failed,
        });
      }

      const semaphoreItems = results.flatMap((r) =>
        Array.isArray(r.body) ? r.body : [r.body]
      );

      const badStatusItems = semaphoreItems.filter((item) => {
        const status = String(item?.status || "").toLowerCase();
        if (!status) return true;
        return ![
          "pending",
          "sent",
          "success",
          "queued",
        ].includes(status);
      });

      if (badStatusItems.length) {
        return res.status(502).json({
          success: false,
          error: "Semaphore accepted request but returned non-delivery status.",
          recipients: allNumbers.length,
          badStatuses: badStatusItems.map((item) => ({
            recipient: maskPhone(item?.recipient),
            status: item?.status || "unknown",
            message_id: item?.message_id || null,
            detail:
              item?.error ||
              item?.message ||
              item?.remarks ||
              JSON.stringify(item).slice(0, 400),
          })),
          rawCount: semaphoreItems.length,
        });
      }

      const sampleRecipients = allNumbers.slice(0, 5).map(maskPhone);

      return res.status(200).json({
        success: true,
        recipients: allNumbers.length,
        requests: results.length,
        sampleRecipients,
        statuses: semaphoreItems.slice(0, 5).map((item) => ({
          recipient: maskPhone(item?.recipient),
          status: item?.status || "unknown",
          message_id: item?.message_id || null,
        })),
      });
    } catch (error) {
      console.error("sendSmsAlert error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        details: error.message,
      });
    }
  }
);
