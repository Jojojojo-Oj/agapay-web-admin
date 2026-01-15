import React, { useState } from "react";
import { db, storage } from "../services/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import axios from "axios";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/announcement.css";

export default function CreateAnnouncement() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  /* ================= SEND TO USERS ONLY ================= */
  const sendNotificationToUsersOnly = async (annTitle, annContent, imageUrl) => {
    try {
      const tokenSet = new Set();
      const usersSnapshot = await getDocs(collection(db, "Users"));

      usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.roles === "user" && data.fcmToken) {
          tokenSet.add(data.fcmToken);
        }
      });

      const tokens = Array.from(tokenSet);
      if (!tokens.length) return;

      await Promise.allSettled(
        tokens.map((token) =>
          axios.post(
            "https://us-central1-agapay-capstone.cloudfunctions.net/sendSingleMessage",
            {
              title: annTitle,
              body: annContent,
              image: imageUrl,
              token,
              data: { type: "announcement" },
            }
          )
        )
      );
    } catch (e) {
      console.error("Announcement notification error:", e);
    }
  };

  /* ================= HISTORY ================= */
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const q = query(
        collection(db, "announcements"),
        orderBy("date", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      setHistoryItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setShowHistory(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: "Delete announcement?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });
    if (!res.isConfirmed) return;

    await deleteDoc(doc(db, "announcements", id));
    setHistoryItems((prev) => prev.filter((i) => i.id !== id));
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content || !image) return;

    setLoading(true);
    try {
      const imageRef = ref(
        storage,
        `announcement_images/${Date.now()}_${image.name}`
      );
      await uploadBytes(imageRef, image);
      const imageUrl = await getDownloadURL(imageRef);

      await addDoc(collection(db, "announcements"), {
        title,
        content,
        imagePath: imageUrl,
        date: serverTimestamp(),
      });

      if (sendNotification) {
        await sendNotificationToUsersOnly(title, content, imageUrl);
      }

      setTitle("");
      setContent("");
      setImage(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="announcement-container">
      <div className="announcement-card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2 className="announcement-heading">📢 Create Announcement</h2>
          <button
            className="announcement-button"
            onClick={fetchHistory}
            disabled={historyLoading}
          >
            {historyLoading ? "Loading..." : "History"}
          </button>
        </div>

        {showSuccess && (
          <div className="announcement-success-message">
            ✅ Announcement sent to USERS only
          </div>
        )}

        <form className="announcement-form" onSubmit={handleSubmit}>
          <input
            className="announcement-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />

          <textarea
            className="announcement-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Content"
          />

          <input
            className="announcement-file-input"
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
          />

          <label className="announcement-checkbox-group">
            <input
              type="checkbox"
              checked={sendNotification}
              onChange={(e) => setSendNotification(e.target.checked)}
            />
            <span className="announcement-checkbox-label">
              Send push notification (Users only)
            </span>
          </label>

          <button className="announcement-button" type="submit" disabled={loading}>
            {loading ? "Posting..." : "Post Announcement"}
          </button>
        </form>
      </div>

      {/* ================= HISTORY MODAL ================= */}
      {showHistory && (
        <div className="history-overlay" onClick={() => setShowHistory(false)}>
          <div className="history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="history-header">
              <strong>Announcement History</strong>
              <button className="history-close" onClick={() => setShowHistory(false)}>
                Close
              </button>
            </div>

            <div className="history-list">
              {historyItems.map((it) => (
                <div key={it.id} className="history-item">
                  <img src={it.imagePath} alt="" className="history-thumb" />
                  <div className="history-meta">
                    <div className="history-title">{it.title}</div>
                    <div className="history-date">
                      {it.date?.toDate?.().toLocaleString()}
                    </div>
                  </div>
                  <div className="history-actions">
                    <button
                      className="history-view"
                      onClick={() => {
                        setSelectedItem(it);
                        setShowDetail(true);
                      }}
                    >
                      View
                    </button>
                    <button
                      className="history-delete"
                      onClick={() => handleDelete(it.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= DETAIL MODAL ================= */}
      {showDetail && selectedItem && (
        <div className="detail-overlay" onClick={() => setShowDetail(false)}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <strong>{selectedItem.title}</strong>
              <button className="history-close" onClick={() => setShowDetail(false)}>
                Close
              </button>
            </div>
            <div className="detail-body">
              <img
                src={selectedItem.imagePath}
                alt=""
                className="detail-image"
              />
              <p className="detail-content">{selectedItem.content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
