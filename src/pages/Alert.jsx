import React, { useState } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/alert.css";

const SEND_SMS_ALERT_URL = "/api/send-sms-alert";

export default function AlertPage() {

  const [alertType, setAlertType] = useState("Typhoon");
  const [level, setLevel] = useState("Yellow");
  const [area, setArea] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const templates = [
    {
      type: "Typhoon",
      level: "Red",
      message: "Strong winds and heavy rain expected. Stay indoors and prepare emergency kits."
    },
    {
      type: "Fire",
      level: "Red",
      message: "Fire reported in the area. Evacuate immediately and avoid the location."
    },
    {
      type: "Earthquake",
      level: "Orange",
      message: "Earthquake detected. Move to open areas and avoid buildings."
    },
    {
      type: "Landslide",
      level: "Orange",
      message: "Heavy rain may trigger landslides. Residents near slopes should evacuate."
    },
    {
      type: "Volcano",
      level: "Red",
      message: "Volcanic activity increasing. Follow evacuation orders from authorities."
    },
    {
      type: "Tsunami",
      level: "Red",
      message: "Tsunami warning issued. Move immediately to higher ground."
    }
  ];

  const applyTemplate = (template) => {
    setAlertType(template.type);
    setLevel(template.level);
    setMessage(template.message);
  };

  const previewMessage = `${level.toUpperCase()} ${alertType.toUpperCase()} ALERT: ${area}. ${message}`;

  const handleSendAlert = async () => {

    if (!area.trim() || !message.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Incomplete alert details",
        text: "Please complete the alert details before sending.",
        confirmButtonColor: "#1d4ed8",
      });
      return;
    }

    const confirmResult = await Swal.fire({
      title: "Send SMS alert?",
      html: `This will send the alert to all subscribed users.<br/><br/><strong>${previewMessage}</strong>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, send alert",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    setSending(true);
    try {
      const response = await fetch(SEND_SMS_ALERT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: previewMessage,
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("Cannot reach the backend server. Make sure admin-node-app is running on port 3001.");
      }
      if (!response.ok || !result.success) {
        const bad = Array.isArray(result.badStatuses)
          ? result.badStatuses
              .map(
                (s) =>
                  `${s.recipient || "unknown"}: ${s.status}${s.detail ? ` (${s.detail})` : ""}`
              )
              .join("\n")
          : "";
        throw new Error(
          `${result.error || result.message || "Failed to send SMS alert."}${bad ? `\n${bad}` : ""}`
        );
      }

      await Swal.fire({
        icon: "success",
        title: "SMS alert sent",
        confirmButtonColor: "#16a34a",
      });

      setArea("");
      setMessage("");
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "SMS send failed",
        text: error.message || "Failed to send SMS alert.",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="alert-page">

      {/* LEFT SIDE FORM */}
      <div className="alert-card">

        <h2 className="alert-title"> Disaster Alert System</h2>
        <p className="alert-subtitle">
          Send emergency alerts to subscribed users.
        </p>

        <label className="alert-label">Disaster Type</label>
        <select
          className="alert-select"
          value={alertType}
          onChange={(e) => setAlertType(e.target.value)}
        >
          <option>Typhoon</option>
          <option>Fire</option>
          <option>Earthquake</option>
          <option>Landslide</option>
          <option>Volcano</option>
          <option>Tsunami</option>
        </select>

        <label className="alert-label">Alert Level</label>
        <select
          className="alert-select"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option>Yellow</option>
          <option>Orange</option>
          <option>Red</option>
        </select>

        <label className="alert-label">Affected Area</label>
        <input
          className="alert-input"
          placeholder="e.g. Quezon City"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />

        <label className="alert-label">Emergency Message</label>
        <input
          className="alert-input"
          placeholder="Enter emergency instructions..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        {/* SMS PREVIEW */}
        <div className="sms-preview">
          <h4>SMS Preview</h4>
          <p>{previewMessage || "SMS preview will appear here."}</p>
        </div>

        <button className="alert-button" onClick={handleSendAlert} disabled={sending}>
          {sending ? "Sending..." : "Send SMS Alert"}
        </button>

      </div>


      {/* RIGHT SIDE TEMPLATES */}
      <div className="template-card">

        <h3> Quick Templates</h3>
 
        {templates.map((template, index) => (
          <div
            key={index}
            className="template-item"
            onClick={() => applyTemplate(template)}
          >
            <strong>{template.type}</strong>
            <p>{template.message}</p>
          </div>
        ))}

      </div>

    </div>
  );
}