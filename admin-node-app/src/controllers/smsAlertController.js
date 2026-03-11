const SEND_SMS_ALERT_URL = "https://sendsmsalert-q5gpvknzpq-uc.a.run.app";

const sendSmsAlert = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ success: false, error: "Message is required." });
  }

  const adminKey = process.env.ALERT_ADMIN_KEY;
  if (!adminKey) {
    return res.status(500).json({ success: false, error: "Server misconfiguration: missing admin key." });
  }

  try {
    const response = await fetch(SEND_SMS_ALERT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-alert-admin-key": adminKey,
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(502).json({ success: false, error: "Failed to reach SMS service." });
  }
};

module.exports = sendSmsAlert;
