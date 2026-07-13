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
  CLEAR_SEND_DOC_DOCTOR_KEY,
} from "../config/api.js";

import { authState, googleAuthState } from "../state/auth-state.js";
import { escapeHtml, addInlineTooltips, enforcePhoneInputs } from "./ui.js";
import { ensureDoctorSpecialtiesLoaded, getDoctorSpecialties } from "../modules/doctors.js";

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
  const picture = payload?.picture || payload?.avatarUrl || payload?.photoUrl || prev?.picture || "";
  const jwtPhoto = String(payload?.photoUrl || payload?.avatarUrl || picture || "").trim();
  const prevPhoto = String(prev?.photoUrl || prev?.avatarUrl || "").trim();
  const photoUrl = jwtPhoto || prevPhoto;
  const avatarUrl = photoUrl;

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
      avatarUrl,
      picture,
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
    const picture = user.picture || user.avatarUrl || user.photoUrl || prev.picture || "";
    const photo =
      String(user.photoUrl || user.avatarUrl || picture || prev.photoUrl || prev.avatarUrl || "").trim() ||
      "";
    const merged = {
      ...prev,
      _id: id,
      firstName: user.firstName ?? prev.firstName ?? "",
      lastName: user.lastName ?? prev.lastName ?? "",
      role: user.role ?? prev.role ?? "",
      linkedDoctorId: user.linkedDoctorId ?? prev.linkedDoctorId ?? "",
      receptionistType: user.receptionistType ?? prev.receptionistType ?? "",
      photoUrl: photo,
      avatarUrl: photo,
      picture,
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
    const picture = user?.picture || user?.avatarUrl || user?.photoUrl || "";
    const photo = String(user?.photoUrl || user?.avatarUrl || picture || "").trim();
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
        avatarUrl: photo,
        picture,
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

function setPageTone(kind) {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) return;
  mainContent.classList.remove(
    "page-tone-patients",
    "page-tone-doctors",
    "page-tone-appointments",
    "page-tone-users",
  );
  if (kind) mainContent.classList.add(`page-tone-${kind}`);
}

function wirePasswordToggles(scope = document) {
  scope.querySelectorAll("[data-password-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-password-target");
      const input = scope.querySelector(`#${targetId}`);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "🙈" : "👁";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });
}

function normalizeFetchErrorMessage(err, fallbackMessage) {
  if (window.DrMeetUtils?.normalizeFetchErrorMessage) {
    return window.DrMeetUtils.normalizeFetchErrorMessage(err, fallbackMessage);
  }
  return String(err?.message || "") || fallbackMessage;
}

async function getApiErrorMessage(res, fallbackMessage) {
  if (window.DrMeetUtils?.getApiErrorMessage) {
    return window.DrMeetUtils.getApiErrorMessage(res, fallbackMessage);
  }
  return fallbackMessage;
}

export function renderLogin() {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) return;
  setPageTone("");
  if (isLoggedIn()) {
    mainContent.innerHTML = `
      <div class="feedback success">You are logged in.</div>
      <button onclick="window.logoutUser()">Logout</button>
    `;
    window.logoutUser = () => {
      localStorage.removeItem("token");
      localStorage.removeItem(USER_CACHE_KEY);
      resetMessagingSocket();
      updateAuthNav();
      window.location.hash = "#login";
      renderLogin();
    };
    return;
  }
  mainContent.innerHTML = `
    <h2>Login</h2>
    <form id="login-form">
      <label>Email <input name="email" type="email" required /></label>
      <label><span class="label-text-row">Password</span>
        <span class="password-input-wrap">
          <input id="login-password" name="password" type="password" required autocomplete="current-password" />
          <button type="button" class="password-toggle-btn" data-password-target="login-password" aria-label="Show password">👁</button>
        </span>
      </label>
      <div class="signup-actions">
        <button type="submit" class="btn btn-primary">Sign in</button>
        <button type="reset" class="btn btn-secondary">Reset</button>
      </div>
    </form>
    <button id="google-login-btn" type="button" class="btn btn-google" style="margin-top:1rem;">Continue with Google</button>
    <div id="login-feedback"></div>
  `;
  const googleLoginBtn = document.getElementById("google-login-btn");
  const form = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
  wirePasswordToggles(form);
  if (form) {
    form.addEventListener("reset", () => {
      if (feedback) {
        feedback.textContent = "";
        feedback.className = "";
      }
    });
  }
  const oauthSuccessToken = consumeOauthSuccessTokenFromHash();
  if (oauthSuccessToken) {
    clearGoogleAuthLoading("Google sign-in successful.");
    resetMessagingSocket();
    localStorage.setItem("token", oauthSuccessToken);
    clearSessionExpiredState();
    updateAuthNav();
    window.location.hash = "#home";
    renderHome();
    return;
  }
  const oauthError = consumeOauthErrorFromHash();
  if (oauthError) {
    clearGoogleAuthLoading(oauthError, true);
    if (feedback) {
      feedback.textContent = oauthError;
      feedback.className = "feedback error";
    }
  }
  if (googleLoginBtn) {
    googleLoginBtn.onclick = () =>
      googleLogin({ feedbackEl: feedback, buttonEl: googleLoginBtn });
  }
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (feedback) feedback.textContent = "Logging in...";
      const creds = Object.fromEntries(new FormData(form));
      try {
        const res = await fetch(`${API_ORIGIN}/auth/login`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(creds),
        });
        if (!res.ok) throw new Error("Invalid credentials");
        const data = await res.json();
        if (data.token) {
          resetMessagingSocket();
          localStorage.setItem("token", data.token);
          if (
            String(data.user?.role || getCurrentUserRole() || "").toLowerCase() ===
            "patient"
          ) {
            localStorage.setItem(CLEAR_SEND_DOC_DOCTOR_KEY, "1");
          }
          clearSessionExpiredState();
          if (feedback) feedback.textContent = "Login successful!";
          updateAuthNav();
          setTimeout(() => {
            window.location.hash = "#home";
            renderHome();
          }, 800);
        } else {
          throw new Error("No token received");
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = normalizeFetchErrorMessage(err, "Login failed.");
          feedback.className = "feedback error";
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }
}

export async function renderSignup() {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) return;
  await ensureDoctorSpecialtiesLoaded();
  setPageTone("");
  if (isLoggedIn()) {
    mainContent.innerHTML = `<div class="feedback success">You are already logged in.</div>`;
    return;
  }
  const selectedRole = getSignupRoleFromHash();
  const signupTitle =
    selectedRole === "doctor"
      ? "Create your doctor account"
      : "Create your patient account";
  const signupLead =
    selectedRole === "doctor"
      ? "Doctor sign-up gives you access to schedule, patient communication, and care workflows."
      : "New accounts are registered as patients so you can book visits and message your care team.";
  const titleOptions =
    selectedRole === "doctor"
      ? `<option value="">(blank)</option><option value="Dr.">Dr.</option><option value="Dra.">Dra.</option>`
      : `<option value="">(blank)</option><option value="Mr.">Mr.</option><option value="Ms.">Ms.</option><option value="Mrs.">Mrs.</option>`;
  mainContent.innerHTML = `
    <h2>${signupTitle}</h2>
    <p class="signup-lead">${signupLead}</p>
    <form id="signup-form">
      <label>Title
        <select name="title">${titleOptions}</select>
      </label>
      <label>First Name <input name="firstName" required /></label>
      <label>Last Name <input name="lastName" required /></label>
      <label>Email <input name="email" type="email" required /></label>
      <label>Password
        <span class="password-input-wrap">
          <input id="signup-password" name="password" type="password" required />
          <button type="button" class="password-toggle-btn" data-password-target="signup-password" aria-label="Show password">👁</button>
        </span>
      </label>
      <label>Phone
        <input name="phone" inputmode="numeric" pattern="[0-9]{10,11}" maxlength="11" title="Use 10 or 11 digits" placeholder="e.g. 09171234567" />
        <small>Digits only, 10-11 numbers.</small>
      </label>
      <label>Address <input name="address" /></label>
      ${selectedRole === "doctor"
      ? `<label><span class="label-text-row" data-tooltip="Set the primary board-certified specialty used for profile matching.">Primary Specialty</span><input name="specialty" list="doctor-specialties-signup" required placeholder="e.g. Cardiology" /></label>
             <datalist id="doctor-specialties-signup">
               ${[...new Set(getDoctorSpecialties())].map((s) => `<option value="${s}"></option>`).join("")}
             </datalist>`
      : ""
    }
      <div class="signup-actions">
        <button type="submit" class="btn btn-primary">Create Account</button>
        <button type="button" class="btn btn-secondary" id="signup-start-over">Start Over</button>
      </div>
    </form>
    <p class="signup-lead" style="margin-top:0.75rem;">Already registered? <a href="#login">Go to Login</a></p>
    <div id="signup-feedback"></div>
  `;
  const form = document.getElementById("signup-form");
  if (form) {
    addInlineTooltips(form);
    enforcePhoneInputs(form);
    wirePasswordToggles(form);
  }
  const feedback = document.getElementById("signup-feedback");
  const oauthSuccessToken = consumeOauthSuccessTokenFromHash();
  if (oauthSuccessToken) {
    clearGoogleAuthLoading("Google sign-in successful.");
    resetMessagingSocket();
    localStorage.setItem("token", oauthSuccessToken);
    clearSessionExpiredState();
    updateAuthNav();
    window.location.hash = "#home";
    renderHome();
    return;
  }
  const oauthError = consumeOauthErrorFromHash();
  if (oauthError) {
    clearGoogleAuthLoading(oauthError, true);
    if (feedback) {
      feedback.textContent = oauthError;
      feedback.className = "feedback error";
    }
  }
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (feedback) feedback.textContent = "Signing up...";
      const user = Object.fromEntries(new FormData(form));
      if (selectedRole) user.role = selectedRole;
      try {
        const res = await fetch(`${API_ORIGIN}/auth/signup`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        if (!res.ok) {
          throw new Error(await getApiErrorMessage(res, "Signup failed."));
        }
        const data = await res.json();
        if (data.token) {
          resetMessagingSocket();
          localStorage.setItem("token", data.token);
          clearSessionExpiredState();
          if (feedback) feedback.textContent = "Signup successful!";
          updateAuthNav();
          setTimeout(() => {
            window.location.hash = "#home";
            renderHome();
          }, 800);
        } else {
          throw new Error("No token received");
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = normalizeFetchErrorMessage(err, "Signup failed.");
          feedback.className = "feedback error";
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }
  document
    .getElementById("signup-start-over")
    ?.addEventListener("click", () => {
      if (form) form.reset();
      if (feedback) {
        feedback.textContent = "";
        feedback.className = "";
      }
    });
}

