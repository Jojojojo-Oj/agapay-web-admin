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
    <div className="news-page">
      {/* HEADER */}
      <div className="news-header">
        <div>
          <h2 className="news-header-title">Publish News</h2>
        </div>

        <button
          className="news-btn news-btn-outline"
          onClick={fetchHistory}
          disabled={historyLoading}
        >
          {historyLoading ? "Loading..." : "View History"}
        </button>
      </div>

      {/* SUCCESS */}
      {showSuccess && (
        <div className="news-alert-success">
          ✅ News posted successfully and sent to users.
        </div>
      )}

      {/* BODY GRID */}
      <div className="news-grid">
        {/* FORM CARD */}
        <div className="news-card">
          <div className="news-card-titlebar">
            <h3 className="news-card-title">Create a News Post</h3>
            <span className="news-chip">Admin</span>
          </div>

          <form className="news-form" onSubmit={handleSubmit}>
            <div className="news-field">
              <label className="news-label">Title</label>
              <input
                className="news-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a clear headline..."
              />
            </div>

            <div className="news-field">
              <label className="news-label">Content</label>
              <textarea
                className="news-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the news content here..."
              />
            </div>

            <div className="news-field">
              <label className="news-label">Upload Image</label>

              <div className="news-upload">
                <input
                  className="news-file-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files[0])}
                />
                <div className="news-upload-hint">
                  {image ? `Selected: ${image.name}` : "PNG/JPG supported"}
                </div>
              </div>
            </div>

            <div className="news-checkbox-card">
              <div className="news-checkbox-left">
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                />
                <div>
                  <div className="news-checkbox-title">
                    Send push notification
                  </div>
                  <div className="news-checkbox-subtitle">
                    Notify Users only (FCM tokens)
                  </div>
                </div>
              </div>

              <span className="news-chip-muted">Optional</span>
            </div>

            <button
              className="news-btn news-btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? "Uploading..." : "Post News"}
            </button>
          </form>
        </div>

        {/* PREVIEW CARD — CHIP REMOVED */}
        <div className="news-card preview-card">
          <div className="news-card-titlebar">
            <h3 className="news-card-title">Live Preview</h3>
          </div>

          <div className="news-preview">
            <div className="news-preview-image">
              {image ? (
                <img
                  src={URL.createObjectURL(image)}
                  alt="preview"
                  className="news-preview-img"
                />
              ) : (
                <div className="news-preview-placeholder">
                  Upload an image to preview
                </div>
              )}
            </div>

            <div className="news-preview-body">
              <div className="news-preview-title">
                {title || "News title will appear here..."}
              </div>
              <div className="news-preview-content">
                {content || "News content preview will appear here..."}
              </div>
            </div>
          </div>

          <div className="news-preview-footer">
            <span className="news-preview-note">
              Tip: Keep titles short and informative.
            </span>
          </div>
        </div>
      </div>

      {/* ================= HISTORY MODAL ================= */}
      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">News History</div>
                <div className="modal-subtitle">Latest 50 published news</div>
              </div>

              <button
                className="news-btn news-btn-danger"
                onClick={() => setShowHistory(false)}
              >
                Close
              </button>
            </div>

            <div className="modal-body">
              {historyItems.length === 0 && (
                <div className="empty-state">No news found.</div>
              )}

              {historyItems.map((it) => (
                <div key={it.id} className="history-row">
                  <img
                    src={it.imagePath}
                    alt=""
                    className="history-thumb"
                  />

                  <div className="history-meta">
                    <div className="history-title">{it.title}</div>
                    <div className="history-date">
                      {it.date?.toDate?.().toLocaleString()}
                    </div>
                  </div>

                  <div className="history-actions">
                    <button
                      className="news-btn news-btn-outline"
                      onClick={() => {
                        setSelectedItem(it);
                        setShowDetail(true);
                      }}
                    >
                      View
                    </button>

                    <button
                      className="news-btn news-btn-danger"
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
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div
            className="modal-card modal-card-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="modal-title">News Details</div>
                <div className="modal-subtitle">
                  {selectedItem.date?.toDate?.().toLocaleString()}
                </div>
              </div>

              <button
                className="news-btn news-btn-outline"
                onClick={() => setShowDetail(false)}
              >
                Close
              </button>
            </div>

            <div className="detail-body">
              <div className="detail-title">{selectedItem.title}</div>
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
