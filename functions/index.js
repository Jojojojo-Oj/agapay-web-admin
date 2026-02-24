const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const express = require("express");

admin.initializeApp();

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
