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
import "../styles/news.css";
import { sendNewsPublishedNotification } from "../services/notificationUtility";

export default function CreatePost() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  /* ================= SEND NEWS TO USERS ONLY ================= */
  const sendNotificationToUsersOnly = async (newsTitle, newsContent, imageUrl) => {
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
      if (tokens.length === 0) return;

      await Promise.allSettled(
        tokens.map((token) =>
          axios.post(
            "https://us-central1-agapay-capstone.cloudfunctions.net/sendSingleMessage",
            {
              title: newsTitle,
              body: newsContent,
              image: imageUrl,
              token,
              data: { type: "news" },
            }
          )
        )
      );
    } catch (e) {
      console.error("News notification error:", e);
    }
  };

  /* ================= HISTORY ================= */
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const q = query(collection(db, "news"), orderBy("date", "desc"), limit(50));
      const snap = await getDocs(q);
      setHistoryItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setShowHistory(true);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  /* ================= DETAIL ================= */
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  /* ================= DELETE ================= */
  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: "Delete news?",
      text: "This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });
    if (!res.isConfirmed) return;

    await deleteDoc(doc(db, "news", id));
    setHistoryItems((prev) => prev.filter((i) => i.id !== id));
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content || !image) return;

    setLoading(true);
    try {
      const imageRef = ref(storage, `news_images/${Date.now()}_${image.name}`);
      await uploadBytes(imageRef, image);
      const imageUrl = await getDownloadURL(imageRef);

      await addDoc(collection(db, "news"), {
        title,
        content,
        imagePath: imageUrl,
        date: serverTimestamp(),
      });

      if (sendNotification) {
        await sendNotificationToUsersOnly(title, content, imageUrl);
      }

      sendNewsPublishedNotification();
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
    <div className="news-container">
      <div className="news-card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2 className="news-heading">📰 Create News Post</h2>
          <button
            className="news-button"
            onClick={fetchHistory}
            disabled={historyLoading}
          >
            {historyLoading ? "Loading..." : "History"}
          </button>
        </div>

        {showSuccess && (
          <div className="news-success-message">
            ✅ News posted and sent to users
          </div>
        )}

        <form className="news-form" onSubmit={handleSubmit}>
          <input
            className="news-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />

          <textarea
            className="news-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Content"
          />

          <input
            className="news-file-input"
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
          />

          <label className="news-checkbox-group">
            <input
              type="checkbox"
              checked={sendNotification}
              onChange={(e) => setSendNotification(e.target.checked)}
            />
            Send push notification (Users only)
          </label>

          <button className="news-button" type="submit" disabled={loading}>
            {loading ? "Uploading..." : "Post News"}
          </button>
        </form>
      </div>

      {/* ================= HISTORY MODAL ================= */}
      {showHistory && (
        <div
          className="news-history-overlay"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="news-history-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="news-history-header">
              <strong>News History</strong>
              <button
                className="news-history-close"
                onClick={() => setShowHistory(false)}
              >
                Close
              </button>
            </div>

            {historyItems.map((it) => (
              <div key={it.id} className="news-history-item">
                <img
                  src={it.imagePath}
                  alt=""
                  className="news-history-thumb"
                />

                <div className="news-history-meta">
                  <div className="news-history-title">{it.title}</div>
                  <div className="news-history-date">
                    {it.date?.toDate?.().toLocaleString()}
                  </div>
                </div>

                <div className="news-history-actions">
                  <button
                    className="news-history-view"
                    onClick={() => {
                      setSelectedItem(it);
                      setShowDetail(true);
                    }}
                  >
                    View
                  </button>

                  <button
                    className="news-history-delete"
                    onClick={() => handleDelete(it.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= DETAIL MODAL ================= */}
      {showDetail && selectedItem && (
        <div
          className="news-detail-overlay"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="news-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{selectedItem.title}</h3>
            <img
              src={selectedItem.imagePath}
              alt=""
              className="news-detail-image"
            />
            <p>{selectedItem.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}
