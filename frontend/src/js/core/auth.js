/**
 * frontend/src/js/core/auth.js
 * Session and Authentication Management Layer
 */

import {
  API_ORIGIN,
  API_BASE,
  USER_CACHE_KEY,
  THEME_KEY,
  DEFAULT_AVATAR_URL,
} from "../config/api.js";

import { authState, googleAuthState } from "../state/auth-state.js";
import { escapeHtml } from "./ui.js";

// Global environment handlers injected from app.js
let apiRequestFn = null;
let resetMessagingSocketFn = null;
let updateAuthNavFn = null;
let renderHomeFn = null;
let getSignupRoleFromHashFn = null;

export function initAuthModule(handlers = {}) {
  apiRequestFn = handlers.apiRequest || null;
  resetMessagingSocketFn = handlers.resetMessagingSocket || null;
  updateAuthNavFn = handlers.updateAuthNav || null;
  renderHomeFn = handlers.renderHome || null;
  getSignupRoleFromHashFn = handlers.getSignupRoleFromHash || null;
}

// Wrappers for global environment handlers
async function apiRequest(...args) {
  if (typeof apiRequestFn === "function") {
    return apiRequestFn(...args);
  }
  throw new Error("apiRequest is not initialized in auth module.");
}

function resetMessagingSocket(...args) {
  if (typeof resetMessagingSocketFn === "function") {
    return resetMessagingSocketFn(...args);
  }
}

function updateAuthNav(...args) {
  if (typeof updateAuthNavFn === "function") {
    return updateAuthNavFn(...args);
  }
}

function renderHome(...args) {
  if (typeof renderHomeFn === "function") {
    return renderHomeFn(...args);
  }
}

function getSignupRoleFromHash(...args) {
  if (typeof getSignupRoleFromHashFn === "function") {
    return getSignupRoleFromHashFn(...args);
  }
  return null;
}

// Auth Helpers & Variables
export function decodeJwtPayload(token) {
  if (window.DrMeetUtils?.decodeJwtPayload) {
    return window.DrMeetUtils.decodeJwtPayload(token);
  }
  return null;
}

export function isLoggedIn() {
  return !!localStorage.getItem("token");
}

export function getCurrentUserId() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return payload?._id || payload?.id || null;
}

export function getCurrentUserRole() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  return role != null ? String(role).toLowerCase() : null;
}

export function getCurrentLinkedDoctorId() {
  const token = localStorage.getItem("token");
  if (!token) return "";
  const payload = decodeJwtPayload(token);
  return String(payload?.linkedDoctorId || "");
}

export function getCurrentUserName() {
  const token = localStorage.getItem("token");
  if (!token) return "";
  const payload = decodeJwtPayload(token);
  const first = String(payload?.firstName || "").trim();
  const last = String(payload?.lastName || "").trim();
  return `${first} ${last}`.trim();
}

export function cacheCurrentUserProfile() {
  const token = localStorage.getItem("token");
  if (!token) return;
  const payload = decodeJwtPayload(token);
  if (!payload) return;
  let prev = {};
  try {
    prev = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "{}");
  } catch (e) {
    prev = {};
  }
  const jwtPhoto = String(payload?.photoUrl || payload?.picture || "").trim();
  const prevPhoto = String(prev?.photoUrl || prev?.picture || "").trim();
  const photoUrl = jwtPhoto || prevPhoto;
  localStorage.setItem(
    USER_CACHE_KEY,
    JSON.stringify({
      _id: payload?._id || payload?.id || "",
      firstName: payload?.firstName || "",
      lastName: payload?.lastName || "",
      role: payload?.role || "",
      linkedDoctorId: payload?.linkedDoctorId || "",
      receptionistType: payload?.receptionistType || "",
      photoUrl,
      picture: jwtPhoto ? payload?.picture || "" : prev?.picture || "",
      cachedAt: prev.cachedAt || Date.now(),
    }),
  );
}

export function getCurrentReceptionistType() {
  try {
    const cached = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "{}");
    return String(cached?.receptionistType || "").toLowerCase();
  } catch (error) {
    return "";
  }
}

export function getCurrentUserPhotoUrl() {
  try {
    const cached = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "{}");
    return String(cached?.photoUrl || cached?.picture || "").trim();
  } catch (error) {
    return "";
  }
}

/**
 * Raw profile image URL with a stable cache-bust query (updates when `cachedAt` changes).
 * Avoids `Date.now()` here because `updateSidebarAccountInfo` runs on an interval.
 */
export function getSidebarProfileImageSrc() {
  try {
    const cached = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "{}");
    const raw = String(cached?.photoUrl || cached?.picture || "").trim();
    if (!raw) return "";
    if (raw.startsWith("data:")) return raw;
    const v = Number(cached?.cachedAt) || 0;
    const sep = raw.includes("?") ? "&" : "?";
    return `${raw}${sep}v=${v}`;
  } catch (error) {
    return "";
  }
}

/** Merge a user object from API (e.g. PUT /users/:id) into local storage so UI updates before a follow-up GET. */
export function applyUserRecordToLocalCache(user) {
  if (!user || typeof user !== "object") return;
  try {
    const prev = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "{}");
    const id = user._id || prev._id;
    if (!id) return;
    const photo =
      String(user.picture || user.photoUrl || prev.photoUrl || prev.picture || "").trim() ||
      "";
    const merged = {
      ...prev,
      _id: id,
      firstName: user.firstName ?? prev.firstName ?? "",
      lastName: user.lastName ?? prev.lastName ?? "",
      role: user.role ?? prev.role ?? "",
      linkedDoctorId: user.linkedDoctorId ?? prev.linkedDoctorId ?? "",
      receptionistType: user.receptionistType ?? prev.receptionistType ?? "",
      photoUrl: photo || prev.photoUrl || "",
      picture: user.picture ?? prev.picture ?? "",
      cachedAt: Date.now(),
    };
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(merged));
  } catch (error) {
    /* ignore */
  }
}

export async function refreshCurrentUserCacheFromApi() {
  const id = getCurrentUserId();
  if (!id) return;
  try {
    const res = await apiRequest(`${API_BASE}/users/${id}`);
    if (!res.ok) return;
    const user = await res.json();
    const photo = String(user?.picture || user?.photoUrl || "").trim();
    localStorage.setItem(
      USER_CACHE_KEY,
      JSON.stringify({
        _id: user?._id || id,
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        role: user?.role || "",
        linkedDoctorId: user?.linkedDoctorId || "",
        receptionistType: user?.receptionistType || "",
        photoUrl: photo,
        picture: user?.picture || "",
        cachedAt: Date.now(),
      }),
    );
  } catch (error) {
    // non-blocking
  }
}

export function getSidebarRoleLabel(role) {
  switch (String(role || "").toLowerCase()) {
    case "patient":
      return "I'm a patient";
    case "doctor":
      return "I'm a doctor";
    case "receptionist":
      return "I'm a receptionist";
    case "admin":
      return "I'm an admin";
    default:
      return "My Account";
  }
}

export function updateSidebarAccountInfo() {
  const signedIn = isLoggedIn();
  const role = getCurrentUserRole();
  const fullName = getCurrentUserName();
  const roleLabel = getSidebarRoleLabel(role);
  const initial = (fullName || role || "U").charAt(0).toUpperCase();

  const avatarEl = document.querySelector(".sidebar-avatar-circle");
  if (avatarEl) {
    const imgSrc = getSidebarProfileImageSrc();
    if (signedIn && imgSrc) {
      avatarEl.innerHTML = `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(fullName || "User")} profile photo" />`;
      avatarEl.classList.add("has-photo");
    } else {
      avatarEl.textContent = signedIn ? initial : "U";
      avatarEl.classList.remove("has-photo");
    }
  }

  const avatarNameEl = document.querySelector(".sidebar-avatar-name");
  if (avatarNameEl) {
    avatarNameEl.textContent = signedIn ? fullName || "My Account" : "My Account";
  }

  const accountMetaEl = document.getElementById("sidebar-account-meta");
  if (accountMetaEl) {
    accountMetaEl.innerHTML = signedIn
      ? `<strong>${escapeHtml(fullName || "User")}</strong><span class="role-label">${escapeHtml(roleLabel)}</span>`
      : "Not signed in";
  }
}

// Google Auth loading / error / state handlers
export function clearGoogleAuthLoading(message, isError = false) {
  if (googleAuthState.timeoutId) {
    clearTimeout(googleAuthState.timeoutId);
    googleAuthState.timeoutId = null;
  }
  if (googleAuthState.pollId) {
    clearInterval(googleAuthState.pollId);
    googleAuthState.pollId = null;
  }
  googleAuthState.popup = null;
  googleAuthState.inProgress = false;

  if (googleAuthState.buttonEl) {
    googleAuthState.buttonEl.disabled = false;
    googleAuthState.buttonEl.removeAttribute("aria-busy");
  }
  if (googleAuthState.feedbackEl && message) {
    googleAuthState.feedbackEl.textContent = message;
    googleAuthState.feedbackEl.className = isError
      ? "feedback error"
      : "feedback";
  }
}

export function consumeOauthErrorFromHash() {
  const hash = window.location.hash || "";
  const match = hash.match(/oauth=([a-z_]+)/i);
  if (!match) return null;
  if (hash.startsWith("#login?")) {
    window.history.replaceState(null, "", "#login");
  } else if (hash.startsWith("#signup?")) {
    window.history.replaceState(null, "", "#signup");
  }
  const code = String(match[1] || "").toLowerCase();
  const messages = {
    missing_code: "Google login could not be completed. Please try again.",
    failed: "Google login failed. Please try again.",
    session_error:
      "Google login failed while creating your session. Please try again.",
    callback_timeout: "Google login timed out. Please try again.",
  };
  return messages[code] || "Google login failed. Please try again.";
}

export function consumeOauthSuccessTokenFromHash() {
  const hash = window.location.hash || "";
  const tokenMatch = hash.match(/(?:^|[?&])token=([^&]+)/i);
  if (!tokenMatch) return null;
  const token = decodeURIComponent(tokenMatch[1] || "");
  if (!token) return null;
  const route = hash.startsWith("#signup?") ? "#signup" : "#login";
  window.history.replaceState(null, "", route);
  return token;
}

export function showSessionExpiredBanner() {
  const el = document.getElementById("session-expired-banner");
  if (!el) return;
  el.hidden = false;
  el.innerHTML =
    'Session expired. Please log in again. <a href="#login" class="session-expired-login-link">Log in</a>';
  el.querySelector(".session-expired-login-link")?.addEventListener(
    "click",
    () => {
      localStorage.removeItem("token");
      localStorage.removeItem(USER_CACHE_KEY);
      authState.sessionExpired = false;
      el.hidden = true;
      el.innerHTML = "";
      resetMessagingSocket();
      updateAuthNav();
    },
  );
}

export function clearSessionExpiredState() {
  authState.sessionExpired = false;
  const el = document.getElementById("session-expired-banner");
  if (el) {
    el.hidden = true;
    el.innerHTML = "";
  }
}

export async function checkAuthStatus() {
  try {
    const token = localStorage.getItem("token");
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_ORIGIN}/auth/status`, {
      method: "GET",
      credentials: "include",
      headers,
    });
    const data = await res.json();
    if (data?.authenticated) {
      updateAuthNav();
    }
  } catch (error) {
    console.warn("Auth status check failed:", error);
  }
}

export function googleLogin({ feedbackEl = null, buttonEl = null } = {}) {
  if (googleAuthState.inProgress) return;
  googleAuthState.feedbackEl = feedbackEl;
  googleAuthState.buttonEl = buttonEl;
  googleAuthState.inProgress = true;

  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.setAttribute("aria-busy", "true");
  }
  if (feedbackEl) {
    feedbackEl.textContent = "Opening Google sign-in...";
    feedbackEl.className = "feedback";
  }

  const requestedRole = getSignupRoleFromHash();
  const roleQuery = requestedRole
    ? `?role=${encodeURIComponent(requestedRole)}`
    : "";
  const popup = window.open(
    `${API_ORIGIN}/auth/google${roleQuery}`,
    "googleLogin",
    "width=500,height=600",
  );
  if (!popup) {
    clearGoogleAuthLoading("Popup blocked. Allow popups and try again.", true);
    return;
  }

  googleAuthState.popup = popup;
  googleAuthState.timeoutId = setTimeout(() => {
    try {
      googleAuthState.popup?.close();
    } catch (e) {
      // ignore
    }
    clearGoogleAuthLoading("Google login timed out. Please try again.", true);
  }, 45000);
  googleAuthState.pollId = setInterval(() => {
    if (googleAuthState.popup && googleAuthState.popup.closed) {
      setTimeout(() => {
        if (googleAuthState.inProgress) {
          clearGoogleAuthLoading(
            "Google sign-in was closed before completion.",
            true,
          );
        }
      }, 1000);
    }
  }, 500);
}

export function handleGoogleAuthMessage(event) {
  if (!event.data) return;
  if (event.data.type === "GOOGLE_AUTH_SUCCESS" && event.data.token) {
    clearGoogleAuthLoading("Google sign-in successful.");
    resetMessagingSocket();
    localStorage.setItem("token", event.data.token);
    clearSessionExpiredState();
    updateAuthNav();
    window.location.hash = "#home";
    renderHome();
    return;
  }
  if (event.data.type === "GOOGLE_AUTH_FAILURE") {
    clearGoogleAuthLoading(
      event.data.message || "Google sign-in failed.",
      true,
    );
  }
}
