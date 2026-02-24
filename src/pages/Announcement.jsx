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
    <div className="announcement-page">
      {/* HEADER */}
      <div className="announcement-header">
        <div>
          <h2 className="announcement-header-title">Publish Announcement</h2>
          <p className="announcement-header-subtitle">
            
          </p>
        </div>

        <button
          className="announcement-btn announcement-btn-outline"
          onClick={fetchHistory}
          disabled={historyLoading}
        >
          {historyLoading ? "Loading..." : "View History"}
        </button>
      </div>

      {/* SUCCESS */}
      {showSuccess && (
        <div className="announcement-alert-success">
          ✅ Announcement posted successfully and sent to users.
        </div>
      )}

      {/* GRID */}
      <div className="announcement-grid">
        {/* FORM CARD */}
        <div className="announcement-card">
          <div className="announcement-card-titlebar">
            <h3 className="announcement-card-title">Create Announcement</h3>
            <span className="announcement-chip">Admin</span>
          </div>

          <form className="announcement-form" onSubmit={handleSubmit}>
            <div className="announcement-field">
              <label className="announcement-label">Title</label>
              <input
                className="announcement-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter announcement title..."
              />
            </div>

            <div className="announcement-field">
              <label className="announcement-label">Content</label>
              <textarea
                className="announcement-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the announcement details..."
              />
            </div>

            <div className="announcement-field">
              <label className="announcement-label">Upload Image</label>

              <div className="announcement-upload">
                <input
                  className="announcement-file-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files[0])}
                />
                <div className="announcement-upload-hint">
                  {image ? `Selected: ${image.name}` : "PNG/JPG supported"}
                </div>
              </div>
            </div>

            <div className="announcement-checkbox-card">
              <div className="announcement-checkbox-left">
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                />
                <div>
                  <div className="announcement-checkbox-title">
                    Send push notification
                  </div>
                  <div className="announcement-checkbox-subtitle">
                    Notify Users only (FCM tokens)
                  </div>
                </div>
              </div>

              <span className="announcement-chip-muted">Optional</span>
            </div>

            <button
              className="announcement-btn announcement-btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? "Posting..." : "Post Announcement"}
            </button>
          </form>
        </div>

        {/* PREVIEW CARD */}
        <div className="announcement-card preview-card">
          <div className="announcement-card-titlebar">
            <h3 className="announcement-card-title">Live Preview</h3>
            <span className="announcement-chip-muted">Preview</span>
          </div>

          <div className="announcement-preview">
            <div className="announcement-preview-image">
              {image ? (
                <img
                  src={URL.createObjectURL(image)}
                  alt="preview"
                  className="announcement-preview-img"
                />
              ) : (
                <div className="announcement-preview-placeholder">
                  Upload an image to preview
                </div>
              )}
            </div>

            <div className="announcement-preview-body">
              <div className="announcement-preview-title">
                {title || "Announcement title will appear here..."}
              </div>
              <div className="announcement-preview-content">
                {content || "Announcement content preview will appear here..."}
              </div>
            </div>
          </div>

          <div className="announcement-preview-footer">
            <span className="announcement-preview-note">
              Tip: Keep your message clear and short.
            </span>
          </div>
        </div>
      </div>

      {/* ================= HISTORY MODAL ================= */}
      {showHistory && (
        <div
          className="modal-overlay"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="modal-title">Announcement History</div>
                <div className="modal-subtitle">Latest 50 announcements</div>
              </div>

              <button
                className="announcement-btn announcement-btn-danger"
                onClick={() => setShowHistory(false)}
              >
                Close
              </button>
            </div>

            <div className="modal-body">
              {historyItems.length === 0 && (
                <div className="empty-state">No announcements found.</div>
              )}

              {historyItems.map((it) => (
                <div key={it.id} className="history-row">
                  <img src={it.imagePath} alt="" className="history-thumb" />

                  <div className="history-meta">
                    <div className="history-title">{it.title}</div>
                    <div className="history-date">
                      {it.date?.toDate?.().toLocaleString()}
                    </div>
                  </div>

                  <div className="history-actions">
                    <button
                      className="announcement-btn announcement-btn-outline"
                      onClick={() => {
                        setSelectedItem(it);
                        setShowDetail(true);
                      }}
                    >
                      View
                    </button>

                    <button
                      className="announcement-btn announcement-btn-danger"
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
        <div
          className="modal-overlay"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="modal-card modal-card-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="modal-title">Announcement Details</div>
                <div className="modal-subtitle">
                  {selectedItem.date?.toDate?.().toLocaleString()}
                </div>
              </div>

              <button
                className="announcement-btn announcement-btn-outline"
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
