/* ============================================
   KnowYourEMI — Comments System
   /comments/comments.js
============================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, updateDoc,
  arrayUnion, increment, query, orderBy, limit, startAfter,
  getCountFromServer, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

// ── Firebase Config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDJbz1E95LgueYnAeKQWatbESnAMR6JF5w",
  authDomain: "knowyouremi-3d4e4.firebaseapp.com",
  projectId: "knowyouremi-3d4e4",
  storageBucket: "knowyouremi-3d4e4.firebasestorage.app",
  messagingSenderId: "248147543329",
  appId: "1:248147543329:web:be05e925f23373587d6a60"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── Owner UID — set this after first Google sign-in ─────────────
// Steps: sign in via Google button → open browser console → type: firebase.auth().currentUser.uid
// Paste that value here:
const OWNER_UID = "mLoa5SeCd5SQ8rx52QNzaldkdYD2";

// ── GA4 event helper ─────────────────────────────────────────────
function trackEvent(eventName, params = {}) {
  if (typeof gtag === "function") {
    gtag("event", eventName, { event_category: "comments", page_path: location.pathname, ...params });
  }
}

// ── Constants ────────────────────────────────────────────────────
const PAGE_SIZE       = 20;
const REPLIES_PREVIEW = 3;

// ── Auth state ───────────────────────────────────────────────────
let currentUser = null;

// ── Page key ────────────────────────────────────────────────────
function getPageKey() {
  const host = location.hostname || "knowyouremi.in";
  const path = location.pathname.replace(/\/+$/, "").replace(/\.html$/, "") || "/";
  return (host + path).replace(/\//g, "__");
}

// ── Device ID ───────────────────────────────────────────────────
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

// ── Avatar HTML — photo or initials ─────────────────────────────
function avatarHTML(name, photoURL, size = "main") {
  const cls = size === "reply" ? "kye-avatar kye-reply-avatar" : "kye-avatar";
  if (photoURL) {
    return `<img src="${sanitize(photoURL)}" class="${cls} kye-avatar-photo" alt="${sanitize(name)}" referrerpolicy="no-referrer" />`;
  }
  return `<div class="${cls} kye-avatar-${avatarColor(name)}">${initials(name)}</div>`;
}

// ── Owner badge ──────────────────────────────────────────────────
function ownerBadge(uid) {
  if (!uid || uid !== OWNER_UID) return "";
  return `<span class="kye-owner-badge">Author</span>`;
}

// ── Auth UI ──────────────────────────────────────────────────────
function updateAuthUI() {
  const signInBtn  = document.getElementById("kye-signin-btn");
  const signOutBtn = document.getElementById("kye-signout-btn");
  const userInfo   = document.getElementById("kye-user-info");
  const nameInput  = document.getElementById("kye-name");
  const nameWrap   = document.getElementById("kye-name-wrap");

  if (!signInBtn) return;

  if (currentUser) {
    signInBtn.style.display  = "none";
    signOutBtn.style.display = "inline-flex";
    if (userInfo) {
      userInfo.style.display = "flex";
      userInfo.innerHTML = `
        ${avatarHTML(currentUser.displayName, currentUser.photoURL)}
        <div class="kye-user-meta">
          <span class="kye-user-name">${sanitize(currentUser.displayName)}</span>
          <span class="kye-user-label">Commenting as this account</span>
        </div>`;
    }
    if (nameWrap) nameWrap.style.display = "none";
  } else {
    signInBtn.style.display  = "inline-flex";
    signOutBtn.style.display = "none";
    if (userInfo) userInfo.style.display = "none";
    if (nameWrap) nameWrap.style.display = "block";
  }
}

async function handleSignIn() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      showToast("Sign-in failed. Please try again.");
    }
  }
}

async function handleSignOut() {
  await signOut(auth);
  showToast("Signed out.");
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

// ── Build reply HTML ─────────────────────────────────────────────
function buildReplyHTML(r, i) {
  return `
    <div class="kye-reply-item" data-reply-index="${i}">
      ${avatarHTML(r.name, r.photoURL || null, "reply")}
      <div class="kye-reply-content">
        <div class="kye-reply-header">
          <span class="kye-reply-name">${sanitize(r.name)}</span>
          ${ownerBadge(r.uid)}
          <span class="kye-reply-time">${timeAgo(r.timestamp)}</span>
        </div>
        <div class="kye-reply-body">${renderBody(r.message)}</div>
      </div>
    </div>`;
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
      ${avatarHTML(data.name, data.photoURL || null)}
      <div class="kye-comment-name-wrap">
        <span class="kye-comment-name">${sanitize(data.name)}</span>
        ${ownerBadge(data.uid)}
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
  attachShowAllReplies(card, id, replies);
  attachReplyOnReplyHandlers(card, id);

  return card;
}

// ── Show all replies ─────────────────────────────────────────────
function attachShowAllReplies(card, id, replies) {
  const btn = card.querySelector(".kye-show-replies-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const list = card.querySelector(".kye-replies-list");
    if (!list) return;
    list.innerHTML = replies.map((r, i) => buildReplyHTML(r, i)).join("");
    btn.remove();
    attachReplyOnReplyHandlers(card, id);
  });
}

function attachReplyOnReplyHandlers(card, commentId) {
  card.querySelectorAll(".kye-reply-item").forEach((item, idx) => {
    const existing = item.querySelector(".kye-reply-on-reply-btn");
    if (existing) return;
    const btn = document.createElement("button");
    btn.className = "kye-reply-btn";
    btn.textContent = "Reply";
    btn.style.marginTop = "0.2rem";
    const replyName = item.querySelector(".kye-reply-name")?.textContent || "";
    btn.addEventListener("click", () => openReplyForm(commentId, replyName, `@${replyName} `));
    item.querySelector(".kye-reply-content").appendChild(btn);
  });
}

// ── Like ─────────────────────────────────────────────────────────
async function handleLike(commentId, card) {
  const btn     = card.querySelector(".kye-like-btn");
  const countEl = card.querySelector(".kye-like-count");
  btn.disabled = true;
  try {
    await updateDoc(doc(db, "pages", getPageKey(), "comments", commentId), {
      likes: increment(1), likedBy: arrayUnion(deviceId)
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

  const isSignedIn = !!currentUser;
  wrap.style.display = "block";
  wrap.innerHTML = `
    <div class="kye-reply-form">
      <div class="kye-reply-form-header">Reply${parentName ? ` to ${sanitize(parentName)}` : ""}</div>
      ${!isSignedIn ? `<input class="kye-input" id="rname-${commentId}" type="text" placeholder="Your name *" maxlength="60" />` : ""}
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
  setTimeout(() => {
    const focus = isSignedIn ? document.getElementById(`rmsg-${commentId}`) : document.getElementById(`rname-${commentId}`);
    focus?.focus();
  }, 50);
}

// ── Submit reply ─────────────────────────────────────────────────
async function submitReply(commentId) {
  const msgEl  = document.getElementById(`rmsg-${commentId}`);
  const btn    = document.getElementById(`rsubmit-${commentId}`);

  let name, photoURL = null, uid = null;

  if (currentUser) {
    name     = currentUser.displayName;
    photoURL = currentUser.photoURL;
    uid      = currentUser.uid;
  } else {
    const nameEl = document.getElementById(`rname-${commentId}`);
    name = nameEl?.value.trim();
    if (!name) { nameEl.focus(); showToast("Please enter your name."); return; }
  }

  const msg = msgEl?.value.trim();
  if (!msg) { msgEl.focus(); showToast("Reply cannot be empty."); return; }

  btn.disabled = true;
  btn.textContent = "Posting...";

  const replyData = {
    name,
    message:   msg,
    timestamp: new Date().toISOString(),
    likes:     0,
    ...(photoURL && { photoURL }),
    ...(uid      && { uid })
  };

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
  const msgEl = document.getElementById("kye-message");
  const btn   = document.getElementById("kye-submit");

  let name, photoURL = null, uid = null;

  if (currentUser) {
    name     = currentUser.displayName;
    photoURL = currentUser.photoURL;
    uid      = currentUser.uid;
  } else {
    const nameEl = document.getElementById("kye-name");
    name = nameEl?.value.trim();
    if (!name) { nameEl.focus(); showToast("Please enter your name."); return; }
  }

  const msg = msgEl?.value.trim();
  if (!msg)           { msgEl.focus(); showToast("Please write a comment."); return; }
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
      page:      getPageKey(),
      ...(photoURL && { photoURL }),
      ...(uid      && { uid })
    });

    showToast("Comment posted! Thanks for joining the discussion.");
    trackEvent("comment_posted", { comment_length: msg.length });

    msgEl.value = "";
    const nameEl = document.getElementById("kye-name");
    if (nameEl) nameEl.value = "";
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
      likes: 0, likedBy: [], replies: [],
      ...(photoURL && { photoURL }),
      ...(uid      && { uid })
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
      <div class="kye-auth-bar">
        <button id="kye-signin-btn" class="kye-signin-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>
        <div id="kye-user-info" class="kye-user-info" style="display:none"></div>
        <button id="kye-signout-btn" class="kye-signout-btn" style="display:none">Sign out</button>
      </div>

      <div id="kye-name-wrap">
        <input class="kye-input" id="kye-name" type="text" placeholder="Your name *" maxlength="60" style="margin-bottom:0.75rem" />
      </div>

      <h3 style="font-size:0.85rem;font-weight:600;color:#111827;margin-bottom:0.5rem;">Leave a comment</h3>
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

  document.getElementById("kye-signin-btn").addEventListener("click", handleSignIn);
  document.getElementById("kye-signout-btn").addEventListener("click", handleSignOut);
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

  // Auth state listener
  onAuthStateChanged(auth, user => {
    currentUser = user;
    updateAuthUI();
  });

  loadComments(false);
}

// ── Boot ─────────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", render);
} else {
  render();
}
