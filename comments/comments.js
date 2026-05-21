/* ============================================
   KnowYourEMI — Comments System
   /comments/comments.js

   Add to any page:
     <div id="knowyouremi-comments"></div>
     <script type="module" src="/comments/comments.js"></script>
============================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  increment,
  query,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  serverTimestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ── Firebase Config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDJbz1E95LgueYnAeKQWatbESnAMR6JF5w",
  authDomain: "knowyouremi-3d4e4.firebaseapp.com",
  projectId: "knowyouremi-3d4e4",
  storageBucket: "knowyouremi-3d4e4.firebasestorage.app",
  messagingSenderId: "248147543329",
  appId: "1:248147543329:web:be05e925f23373587d6a60"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── GA4 event helper ─────────────────────────────────────────────
function trackEvent(eventName, params = {}) {
  if (typeof gtag === "function") {
    gtag("event", eventName, {
      event_category: "comments",
      page_path: location.pathname,
      ...params
    });
  }
}

// ── Constants ────────────────────────────────────────────────────
const PAGE_SIZE       = 20;
const REPLIES_PREVIEW = 3;

// ── Page key — flattened to a single string so Firestore path is always
// pages/{pageKey}/comments/{commentId} — 3 segments (odd), never 4
function getPageKey() {
  const host = location.hostname || "knowyouremi.in";
  const path = location.pathname.replace(/\/+$/, "").replace(/\.html$/, "") || "/";
  return (host + path).replace(/\//g, "__");
}

// ── Device ID for like deduplication ────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem("kye_device_id");
  if (!id) {
    id = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("kye_device_id", id);
  }
  return id;
}

function commentsCol() {
  return collection(db, "pages", getPageKey(), "comments");
}

// ── State ────────────────────────────────────────────────────────
let lastDoc     = null;
let currentSort = "newest";
let totalCount  = 0;
let loadedCount = 0;
const deviceId  = getDeviceId();

// ── Helpers ──────────────────────────────────────────────────────
function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 8;
}

function timeAgo(ts) {
  if (!ts) return "";
  const ms   = ts.toMillis ? ts.toMillis() : Number(ts);
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60)      return "just now";
  if (secs < 3600)    return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400)   return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`;
  const d = ts.toDate ? ts.toDate() : new Date(ms);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function sanitize(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function renderBody(text) {
  return sanitize(text).replace(/(@[\w]+)/g, '<span class="kye-mention">$1</span>');
}

function showToast(msg) {
  let t = document.getElementById("kye-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "kye-toast";
    t.className = "kye-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

function updateCountLabel() {
  const el = document.getElementById("kye-count-label");
  if (el) el.innerHTML = `<strong>${totalCount}</strong> ${totalCount === 1 ? "comment" : "comments"}`;
}

// ── Query builder ────────────────────────────────────────────────
function buildQuery(afterDoc = null) {
  const col   = commentsCol();
  const field = currentSort === "liked" ? "likes" : "timestamp";
  return afterDoc
    ? query(col, orderBy(field, "desc"), startAfter(afterDoc), limit(PAGE_SIZE))
    : query(col, orderBy(field, "desc"), limit(PAGE_SIZE));
}

// ── Load comments ────────────────────────────────────────────────
async function loadComments(append = false) {
  const list    = document.getElementById("kye-comment-list");
  const moreBtn = document.getElementById("kye-load-more");

  if (!append) {
    lastDoc = null;
    loadedCount = 0;
    list.innerHTML = `<div class="kye-spinner"><div class="kye-spinner-ring"></div></div>`;
    try {
      const snap = await getCountFromServer(commentsCol());
      totalCount = snap.data().count;
      updateCountLabel();
    } catch (_) {}
  }

  try {
    const snapshot = await getDocs(buildQuery(append ? lastDoc : null));
    if (!append) list.innerHTML = "";

    if (snapshot.empty && !append) {
      list.innerHTML = `
        <div class="kye-empty">
          <div class="kye-empty-icon">💬</div>
          <p>No comments yet. Be the first to start the discussion.</p>
        </div>`;
      if (moreBtn) moreBtn.style.display = "none";
      return;
    }

    snapshot.forEach(docSnap => {
      list.appendChild(buildCommentCard(docSnap.id, docSnap.data()));
      loadedCount++;
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (moreBtn) moreBtn.style.display = loadedCount < totalCount ? "inline-block" : "none";

  } catch (err) {
    console.error("KYE Comments: load error", err);
    if (!append) list.innerHTML = `<div class="kye-empty"><p>Could not load comments. Please refresh.</p></div>`;
  }
}

// ── Build comment card ───────────────────────────────────────────
function buildCommentCard(id, data) {
  const card     = document.createElement("div");
  card.className  = "kye-comment-card";
  card.dataset.id = id;

  const liked   = (data.likedBy || []).includes(deviceId);
  const replies = data.replies || [];
  const preview = replies.slice(0, REPLIES_PREVIEW);
  const hasMore = replies.length > REPLIES_PREVIEW;

  card.innerHTML = `
    <div class="kye-comment-header">
      <div class="kye-avatar kye-avatar-${avatarColor(data.name)}">${initials(data.name)}</div>
      <div>
        <span class="kye-comment-name">${sanitize(data.name)}</span>
        <span class="kye-comment-time">&nbsp;&middot;&nbsp;${timeAgo(data.timestamp)}</span>
      </div>
    </div>
    <div class="kye-comment-body">${renderBody(data.message)}</div>
    <div class="kye-comment-actions">
      <button class="kye-like-btn ${liked ? "liked" : ""}" ${liked ? "disabled" : ""}>
        <span class="kye-like-icon">👍</span>
        <span class="kye-like-count">${data.likes || 0}</span>
      </button>
      <button class="kye-reply-btn">Reply</button>
    </div>
    <div class="kye-replies-wrap" id="replies-${id}" ${replies.length === 0 ? 'style="display:none"' : ""}>
      <div class="kye-replies-list">
        ${preview.map((r, i) => buildReplyHTML(r, i)).join("")}
      </div>
      ${hasMore ? `<button class="kye-show-replies-btn" data-total="${replies.length}">Show all ${replies.length} replies</button>` : ""}
    </div>
    <div class="kye-reply-form-wrap" id="reply-form-${id}" style="display:none"></div>
  `;

  card.querySelector(".kye-like-btn").addEventListener("click", () => handleLike(id, card));
  card.querySelector(".kye-reply-btn").addEventListener("click", () => openReplyForm(id, data.name, ""));
  card.querySelector(".kye-show-replies-btn")?.addEventListener("click", e => expandReplies(id, e.target));
  attachReplyOnReplyHandlers(card, id);

  return card;
}

// ── Build reply HTML ─────────────────────────────────────────────
function buildReplyHTML(reply, index) {
  return `
    <div class="kye-reply-item" data-reply-index="${index}">
      <div class="kye-avatar kye-reply-avatar kye-avatar-${avatarColor(reply.name)}">${initials(reply.name)}</div>
      <div class="kye-reply-content">
        <div class="kye-reply-header">
          <span class="kye-reply-name">${sanitize(reply.name)}</span>
          <span class="kye-reply-time">&middot; ${timeAgo(reply.timestamp)}</span>
        </div>
        <div class="kye-reply-body">${renderBody(reply.message)}</div>
        <button class="kye-reply-btn" style="margin-top:0.3rem;font-size:0.75rem"
                data-reply-to="${sanitize(reply.name)}">Reply</button>
      </div>
    </div>`;
}

function attachReplyOnReplyHandlers(card, parentId) {
  card.querySelectorAll("[data-reply-to]").forEach(btn => {
    btn.addEventListener("click", () => openReplyForm(parentId, null, `@${btn.dataset.replyTo} `));
  });
}

// ── Expand all replies ───────────────────────────────────────────
async function expandReplies(commentId, btn) {
  btn.textContent = "Loading...";
  btn.disabled = true;
  try {
    const snap    = await getDoc(doc(db, "pages", getPageKey(), "comments", commentId));
    const replies = snap.exists() ? (snap.data().replies || []) : [];
    const card    = document.querySelector(`[data-id="${commentId}"]`);
    const list    = card?.querySelector(".kye-replies-list");
    if (list) {
      list.innerHTML = replies.map((r, i) => buildReplyHTML(r, i)).join("");
      attachReplyOnReplyHandlers(card, commentId);
    }
    btn.remove();
  } catch (err) {
    console.error("KYE Comments: expand replies error", err);
    btn.textContent = `Show all ${btn.dataset.total} replies`;
    btn.disabled = false;
  }
}

// ── Like ─────────────────────────────────────────────────────────
async function handleLike(commentId, card) {
  const btn     = card.querySelector(".kye-like-btn");
  const countEl = card.querySelector(".kye-like-count");
  btn.disabled  = true;
  try {
    await updateDoc(doc(db, "pages", getPageKey(), "comments", commentId), {
      likes:   increment(1),
      likedBy: arrayUnion(deviceId)
    });
    countEl.textContent = parseInt(countEl.textContent || "0") + 1;
    btn.classList.add("liked");
    trackEvent("comment_liked", { comment_id: commentId });
  } catch (err) {
    console.error("KYE Comments: like error", err);
    btn.disabled = false;
  }
}

// ── Reply form ───────────────────────────────────────────────────
function openReplyForm(commentId, parentName, prefill) {
  document.querySelectorAll(".kye-reply-form-wrap").forEach(el => {
    if (el.id !== `reply-form-${commentId}`) { el.style.display = "none"; el.innerHTML = ""; }
  });

  const wrap = document.getElementById(`reply-form-${commentId}`);
  if (!wrap) return;

  if (wrap.style.display !== "none" && wrap.innerHTML) {
    wrap.style.display = "none"; wrap.innerHTML = ""; return;
  }

  wrap.style.display = "block";
  wrap.innerHTML = `
    <div class="kye-reply-form">
      <div class="kye-reply-form-header">Reply${parentName ? ` to ${sanitize(parentName)}` : ""}</div>
      <input class="kye-input" id="rname-${commentId}" type="text" placeholder="Your name *" maxlength="60" />
      <textarea class="kye-input kye-textarea" id="rmsg-${commentId}"
                placeholder="Write your reply..." maxlength="1000"
                style="margin-top:0.5rem">${prefill || ""}</textarea>
      <div class="kye-reply-form-actions">
        <button class="kye-cancel-btn" id="rcancel-${commentId}">Cancel</button>
        <button class="kye-reply-submit-btn" id="rsubmit-${commentId}">Post Reply</button>
      </div>
    </div>`;

  document.getElementById(`rcancel-${commentId}`).addEventListener("click", () => {
    wrap.style.display = "none"; wrap.innerHTML = "";
  });
  document.getElementById(`rsubmit-${commentId}`).addEventListener("click", () => submitReply(commentId));
  setTimeout(() => document.getElementById(`rname-${commentId}`)?.focus(), 50);
}

// ── Submit reply ─────────────────────────────────────────────────
async function submitReply(commentId) {
  const nameEl = document.getElementById(`rname-${commentId}`);
  const msgEl  = document.getElementById(`rmsg-${commentId}`);
  const btn    = document.getElementById(`rsubmit-${commentId}`);

  const name = nameEl?.value.trim();
  const msg  = msgEl?.value.trim();

  if (!name) { nameEl.focus(); showToast("Please enter your name."); return; }
  if (!msg)  { msgEl.focus();  showToast("Reply cannot be empty."); return; }

  btn.disabled = true;
  btn.textContent = "Posting...";

  // ISO string timestamp — serverTimestamp() not supported inside arrayUnion
  const replyData = { name, message: msg, timestamp: new Date().toISOString(), likes: 0 };

  try {
    await updateDoc(doc(db, "pages", getPageKey(), "comments", commentId), {
      replies: arrayUnion(replyData)
    });

    showToast("Reply posted!");
    trackEvent("comment_reply_posted", { comment_id: commentId, reply_length: msg.length });

    const wrap = document.getElementById(`reply-form-${commentId}`);
    if (wrap) { wrap.style.display = "none"; wrap.innerHTML = ""; }

    const repliesWrap = document.getElementById(`replies-${commentId}`);
    if (repliesWrap) {
      repliesWrap.style.display = "block";
      let list = repliesWrap.querySelector(".kye-replies-list");
      if (!list) {
        list = document.createElement("div");
        list.className = "kye-replies-list";
        repliesWrap.prepend(list);
      }
      const fakeReply = { ...replyData, timestamp: { toMillis: () => Date.now() } };
      list.insertAdjacentHTML("beforeend", buildReplyHTML(fakeReply, list.children.length));
      const card = document.querySelector(`[data-id="${commentId}"]`);
      if (card) attachReplyOnReplyHandlers(card, commentId);
    }

  } catch (err) {
    console.error("KYE Comments: reply error", err);
    showToast("Something went wrong. Please try again.");
    btn.disabled = false;
    btn.textContent = "Post Reply";
  }
}

// ── Submit top-level comment ─────────────────────────────────────
async function submitComment() {
  const nameEl = document.getElementById("kye-name");
  const msgEl  = document.getElementById("kye-message");
  const btn    = document.getElementById("kye-submit");

  const name = nameEl?.value.trim();
  const msg  = msgEl?.value.trim();

  if (!name) { nameEl.focus(); showToast("Please enter your name."); return; }
  if (!msg)  { msgEl.focus();  showToast("Please write a comment."); return; }
  if (msg.length < 3) { msgEl.focus(); showToast("Comment is too short."); return; }

  btn.disabled = true;
  btn.textContent = "Posting...";

  try {
    const docRef = await addDoc(commentsCol(), {
      name,
      message:   msg,
      timestamp: serverTimestamp(),
      likes:     0,
      likedBy:   [],
      replies:   [],
      page:      getPageKey()
    });

    showToast("Comment posted! Thanks for joining the discussion.");
    trackEvent("comment_posted", { comment_length: msg.length });

    nameEl.value = "";
    msgEl.value  = "";
    btn.disabled = false;
    btn.textContent = "Post Comment";

    totalCount++;
    loadedCount++;
    updateCountLabel();

    const list = document.getElementById("kye-comment-list");
    list.querySelector(".kye-empty")?.remove();

    const fakeData = {
      name, message: msg,
      timestamp: { toMillis: () => Date.now(), toDate: () => new Date() },
      likes: 0, likedBy: [], replies: []
    };
    list.prepend(buildCommentCard(docRef.id, fakeData));

  } catch (err) {
    console.error("KYE Comments: submit error", err);
    showToast("Something went wrong. Please try again.");
    btn.disabled = false;
    btn.textContent = "Post Comment";
  }
}

// ── Render section ───────────────────────────────────────────────
function render() {
  const root = document.getElementById("knowyouremi-comments");
  if (!root) return;

  const link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = "/comments/comments.css";
  document.head.appendChild(link);

  root.innerHTML = `
    <div>
      <span class="kye-section-label">Community</span>
      <h2 class="kye-section-title">Join the Discussion</h2>
      <p class="kye-section-sub">Share your experience, ask a question, or help someone out.</p>
    </div>

    <div class="kye-form-card">
      <h3>Leave a comment</h3>
      <input class="kye-input" id="kye-name" type="text" placeholder="Your name *" maxlength="60" style="margin-bottom:0.75rem" />
      <textarea class="kye-input kye-textarea" id="kye-message"
                placeholder="Your comment..." maxlength="2000"></textarea>
      <button class="kye-submit-btn" id="kye-submit" style="margin-top:0.75rem">Post Comment</button>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
      <p class="kye-count" id="kye-count-label"><strong>--</strong> comments</p>
      <div class="kye-sort-bar">
        <span>Sort:</span>
        <button class="kye-sort-btn active" data-sort="newest">Newest</button>
        <button class="kye-sort-btn" data-sort="liked">Most liked</button>
      </div>
    </div>

    <div id="kye-comment-list">
      <div class="kye-spinner"><div class="kye-spinner-ring"></div></div>
    </div>

    <div class="kye-load-more-wrap">
      <button class="kye-load-more-btn" id="kye-load-more" style="display:none">Load more comments</button>
    </div>
  `;

  document.getElementById("kye-submit").addEventListener("click", submitComment);
  document.getElementById("kye-message").addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitComment();
  });

  root.querySelectorAll(".kye-sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.sort === currentSort) return;
      root.querySelectorAll(".kye-sort-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSort = btn.dataset.sort;
      loadComments(false);
    });
  });

  document.getElementById("kye-load-more").addEventListener("click", () => loadComments(true));

  loadComments(false);
}

// ── Boot ─────────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", render);
} else {
  render();
}
