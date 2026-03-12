import { useEffect, useRef, useState } from "react";
import { subscribeToIncidents } from "../services/incidentsService";

const ALARM_SOUND = "/alarm.mp3";

export default function GlobalIncidentNotifications() {
  const [notifications, setNotifications] = useState([]);
  const prevReportIds = useRef(new Set());
  const audioRef = useRef(null);

  const playAlarm = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const audio = new Audio(ALARM_SOUND);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch (err) {
      console.warn("Alarm failed:", err);
    }
  };

  useEffect(() => {
    const unsub = subscribeToIncidents((data) => {
      if (prevReportIds.current.size === 0) {
        data.forEach((r) => prevReportIds.current.add(r.id));
        return;
      }

      data.forEach((r) => {
        if (!prevReportIds.current.has(r.id)) {
          const notif = {
            id: r.id,
            senderName: r.senderName || "Unknown",
            disasterType: r.disasterType,
            timestamp: new Date(),
          };

          setNotifications((prev) => [notif, ...prev]);

          // 🔊 PLAY ALARM
          playAlarm();

          prevReportIds.current.add(r.id);
        }
      });
    });

    return () => unsub();
  }, []);

  return (
    <div className="inc-notification-stack">
      {notifications.map((notif) => (
        <div key={notif.id} className="inc-notification-item">
          <div className="inc-notif-header">
            <h4 className="inc-notif-title">🚨 New Incident Report</h4>

            <button
              className="inc-notif-close"
              onClick={() =>
                setNotifications((prev) =>
                  prev.filter((n) => n.id !== notif.id)
                )
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
  );
}