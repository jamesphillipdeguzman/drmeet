import {
  API_ORIGIN,
  API_BASE,
  DASHBOARD_STATE_KEY,
  USER_CACHE_KEY,
  THEME_KEY,
  CLEAR_SEND_DOC_DOCTOR_KEY,
  DOCTOR_OVERVIEW_CACHE_KEY,
  DOCTOR_OVERVIEW_TTL_MS,
  DASH_TAG_HOME,
  DASH_TAG_FLOAT,
  MESSAGES_API,
  DEFAULT_AVATAR_URL,
  CHAT_UPLOAD_ICON_SRC,
  CHAT_SEND_ICON_SRC,
} from "./config/api.js";

export { authState } from "./state/auth-state.js";
import {
  addInlineTooltips,
  attachClearButtons,
  downloadCsv,
  enforcePhoneInputs,
  escapeHtml,
  fileToDataUrl,
  showDangerConfirm,
  showToast,
} from "./core/ui.js";
import { createNavigation } from "./core/navigation.js";
import {
  initAuthModule,
  decodeJwtPayload,
  getCurrentUserId,
  getCurrentUserRole,
  getCurrentLinkedDoctorId,
  getCurrentUserName,
  cacheCurrentUserProfile,
  getCurrentReceptionistType,
  getCurrentUserPhotoUrl,
  getSidebarProfileImageSrc,
  applyUserRecordToLocalCache,
  refreshCurrentUserCacheFromApi,
  getSidebarRoleLabel,
  updateSidebarAccountInfo,
  clearGoogleAuthLoading,
  consumeOauthErrorFromHash,
  consumeOauthSuccessTokenFromHash,
  clearSessionExpiredState,
  showSessionExpiredBanner,
  checkAuthStatus,
  googleLogin,
  handleGoogleAuthMessage,
  isLoggedIn,
  renderLogin,
  renderSignup,
} from "./core/auth.js";

export { getCurrentUserId, getCurrentUserRole, isLoggedIn };

import {
  dashboardState,
  loadDashboardState,
  persistDashboardState,
  subscribeDashboard,
  pruneDashboardSubscribers,
  notifyDashboardSubscribers,
  resetMessagingSocket,
  setupSocket,
  loadConversations,
  loadMessages,
  sendMessage,
  sendDocumentMessage,
  renderMessengerConversationList,
  renderMessengerThread,
  mountFloatingChatWidget,
  hideFloatingChatWidget,
} from "./modules/messaging.js";

import {
  initPatientsModule,
  renderPatients,
  formatPatientDisplayName,
  formatPatientFullNameOnly,
  formatPatientAddress,
} from "./modules/patients.js";

export { formatPatientDisplayName, formatPatientFullNameOnly };

import {
  initDoctorsModule,
  renderDoctors,
  formatDoctorDisplayName,
  ensureDoctorSpecialtiesLoaded,
  getDoctorSpecialties,
  doctorMatchesPatientSearch,
} from "./modules/doctors.js";

import {
  initAppointmentsModule,
  renderAppointments,
  renderCalendar,
} from "./modules/appointments.js";

import {
  initUsersModule,
  renderUsers,
} from "./modules/users.js";

import {
  initShell,
  applyTheme,
  bootstrapTheme,
  setupShellInteractions,
} from "./core/shell.js";

export { formatDoctorDisplayName, ensureDoctorSpecialtiesLoaded, getDoctorSpecialties };


// SPA navigation and dynamic content rendering variables
let mainContent = null;
let navLinks = null;
let sidebar = null;
let sidebarToggle = null;
let sidebarUserTrigger = null;
let sidebarUserPopover = null;
let sidebarLogoutBtn = null;
let sidebarUserMenu = null;
let sidebarAvatarCircle = null;
let sidebarAvatarName = null;
let sidebarAccountMeta = null;
let commandPalette = null;
let commandInput = null;
let commandResults = null;
let commandPaletteTrigger = null;

let navigation = null;

// Destructured navigation functions
let getSignupRoleFromHash = null;
let parseDoctorDashboardTab = null;
let renderPage = null;
let renderTopbarBreadcrumbs = null;
let setDoctorDashboardHashTab = null;
let setupCommandPalette = null;

// PAYMENT_METHOD_CATEGORIES_FALLBACK and CLINICAL_HMO_PAYMENT_METHODS
// are now canonical exports from ./modules/appointments.js

let sidebarClockIntervalId = null;

let avatarPresetsPromise = null;
async function ensureAvatarPresetsLoaded() {
  if (!avatarPresetsPromise) {
    avatarPresetsPromise = fetch("/data/avatar-presets.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        window.__DRMEET_AVATAR_PRESETS__ =
          data && typeof data === "object" ? data : {};
        return window.__DRMEET_AVATAR_PRESETS__;
      })
      .catch(() => {
        window.__DRMEET_AVATAR_PRESETS__ = {};
        return {};
      });
  }
  return avatarPresetsPromise;
}

function isAllowedPresetImageUrl(url) {
  const s = String(url || "").trim();
  return /^images\/[a-zA-Z0-9._-]+\.(webp|png|jpg|jpeg|svg)$/i.test(s);
}

function buildAvatarPresetGridHtml(role) {
  const key = role === "doctor" ? "doctor" : "patient";
  const presets = window.__DRMEET_AVATAR_PRESETS__?.[key];
  if (!Array.isArray(presets) || !presets.length) return "";
  const chips = presets
    .filter((u) => isAllowedPresetImageUrl(u))
    .map(
      (src) =>
        `<button type="button" class="avatar-preset-btn" data-preset-url="${escapeHtml(src)}" title="Use this avatar" aria-label="Use preset avatar"><img src="${escapeHtml(src)}" alt="" /></button>`,
    )
    .join("");
  if (!chips) return "";
  return `<div class="avatar-preset-wrap"><span class="avatar-preset-label">Or choose a preset avatar</span><div class="avatar-preset-grid">${chips}</div><input type="hidden" name="presetPhotoUrl" value="" /></div>`;
}

function wireAvatarPresetGrid(root, fileInput) {
  const hidden = root.querySelector('input[name="presetPhotoUrl"]');
  root.querySelectorAll(".avatar-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-preset-url") || "";
      if (!isAllowedPresetImageUrl(url)) return;
      root.querySelectorAll(".avatar-preset-btn").forEach((b) =>
        b.classList.remove("is-selected"),
      );
      btn.classList.add("is-selected");
      if (hidden) hidden.value = url;
      if (fileInput) fileInput.value = "";
    });
  });
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      if (fileInput.files?.[0]) {
        if (hidden) hidden.value = "";
        root.querySelectorAll(".avatar-preset-btn").forEach((b) =>
          b.classList.remove("is-selected"),
        );
      }
    });
  }
}

function normalizeFetchErrorMessage(err, fallbackMessage) {
  if (window.DrMeetUtils?.normalizeFetchErrorMessage) {
    return window.DrMeetUtils.normalizeFetchErrorMessage(err, fallbackMessage);
  }
  return String(err?.message || "") || fallbackMessage;
}

export function buildHeaders(baseHeaders = {}) {
  const token = localStorage.getItem("token");
  return token
    ? { ...baseHeaders, Authorization: `Bearer ${token}` }
    : { ...baseHeaders };
}

export async function apiRequest(url, options = {}) {
  const urlStr = typeof url === "string" ? url : "";
  const skipAuthBlock =
    /\/auth\/(login|signup|status)/.test(urlStr) ||
    urlStr.includes("/auth/google");
  if (authState.sessionExpired && !skipAuthBlock) {
    return new Response(
      JSON.stringify({ error: "Session expired.", code: "TOKEN_EXPIRED" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  const headers = buildHeaders(options.headers || {});
  const res = await fetch(url, { ...options, headers, credentials: "include" });
  if (res.status === 401 && !skipAuthBlock) {
    try {
      const data = await res.clone().json();
      if (
        data?.code === "TOKEN_EXPIRED" ||
        /session expired/i.test(String(data?.message || ""))
      ) {
        authState.sessionExpired = true;
        showSessionExpiredBanner();
      }
    } catch (e) {
      /* ignore */
    }
  }
  return res;
}

export async function getApiErrorMessage(res, fallbackMessage) {
  if (window.DrMeetUtils?.getApiErrorMessage) {
    return window.DrMeetUtils.getApiErrorMessage(res, fallbackMessage);
  }
  return fallbackMessage;
}

function formatDateForInput(value) {
  if (window.DrMeetUtils?.formatDateForInput) {
    return window.DrMeetUtils.formatDateForInput(value);
  }
  return "";
}

function formatDateDisplay(value) {
  if (window.DrMeetUtils?.formatDateDisplay) {
    return window.DrMeetUtils.formatDateDisplay(value);
  }
  return String(value || "");
}

function buildDoctorAvailabilityLabel(doctor) {
  const slots = Array.isArray(doctor.availability) ? doctor.availability : [];
  if (doctor.availabilityText) return doctor.availabilityText;
  if (!slots.length) return "Availability not set";
  return slots
    .map((slot) =>
      slot.timeRange
        ? `${slot.day || "Day"} ${slot.timeRange}`
        : `${slot.day || "Day"} ${slot.startTime || "--:--"}-${slot.endTime || "--:--"}`,
    )
    .join(" | ");
}

function normalizeTimeText(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function buildBookingTimeGridHtml({
  suggestedAvailableTimes = [],
  conflictingTimes = [],
  selectedTime = "",
}) {
  const selected = normalizeTimeText(selectedTime);
  const taken = new Set(
    (Array.isArray(conflictingTimes) ? conflictingTimes : [])
      .map((t) => normalizeTimeText(t))
      .filter(Boolean),
  );
  const available = new Set(
    (Array.isArray(suggestedAvailableTimes) ? suggestedAvailableTimes : [])
      .map((t) => normalizeTimeText(t))
      .filter(Boolean),
  );
  const merged = new Set([...available, ...taken]);
  if (!merged.size) return "";
  const times = [...merged].sort((a, b) => a.localeCompare(b));
  return `<div class="booking-time-grid">
    ${times
      .map((timeVal) => {
        const isTaken = taken.has(timeVal);
        const isSelected = !isTaken && selected === timeVal;
        return `<button type="button" class="btn btn-sm booking-time-chip ${isTaken ? "is-taken" : "is-available"} ${isSelected ? "is-selected" : ""}" data-smart-time="${escapeHtml(timeVal)}" ${isTaken ? "disabled" : ""}>${escapeHtml(timeVal)}${isTaken ? " (Taken)" : ""}</button>`;
      })
      .join("")}
  </div>`;
}

window.addEventListener("DOMContentLoaded", () => {
  // DOM element selections
  mainContent = document.getElementById("main-content");
  navLinks = document.querySelectorAll(".nav-link");
  sidebar = document.getElementById("app-sidebar");
  sidebarToggle = document.getElementById("sidebar-toggle");
  sidebarUserTrigger = document.getElementById("sidebar-user-trigger");
  sidebarUserPopover = document.getElementById("sidebar-user-popover");
  sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");
  sidebarUserMenu = document.querySelector(".sidebar-user-menu");
  sidebarAvatarCircle = document.querySelector(".sidebar-avatar-circle");
  sidebarAvatarName = document.querySelector(".sidebar-avatar-name");
  sidebarAccountMeta = document.getElementById("sidebar-account-meta");
  commandPalette = document.getElementById("command-palette");
  commandInput = document.getElementById("command-input");
  commandResults = document.getElementById("command-results");
  commandPaletteTrigger = document.getElementById("command-palette-trigger");

  // Create navigation
  navigation = createNavigation({
    navLinks,
    commandPalette,
    commandInput,
    commandResults,
    commandPaletteTrigger,
    isLoggedIn,
    getCurrentUserRole,
    applyTheme,
    renderers: {
      renderDoctorDashboard,
      renderSettings,
      renderPrivacy,
      renderPatients,
      renderDoctors,
      renderAppointments,
      renderCalendar,
      renderUsers,
      renderLogin,
      renderSignup,
      renderPatientBooking,
      renderHome,
    },
  });

  // Assign destructured properties
  getSignupRoleFromHash = navigation.getSignupRoleFromHash;
  parseDoctorDashboardTab = navigation.parseDoctorDashboardTab;
  renderPage = navigation.renderPage;
  renderTopbarBreadcrumbs = navigation.renderTopbarBreadcrumbs;
  setDoctorDashboardHashTab = navigation.setDoctorDashboardHashTab;
  setupCommandPalette = navigation.setupCommandPalette;

  // Initialize Modules
  initAuthModule({
    apiRequest,
    resetMessagingSocket,
    updateAuthNav,
    renderHome,
    getSignupRoleFromHash,
  });

  initPatientsModule({
    apiRequest,
    getApiErrorMessage,
    getCurrentUserRole,
    getCurrentUserId,
    getCurrentLinkedDoctorId,
    getCurrentReceptionistType,
    formatRelativeTime,
    formatDateDisplay,
    formatDateForInput,
    sendDocumentMessage,
    resolvePatientMessageRecipient,
    downloadCsv,
    loadFacilities,
    renderFacilityDatalist,
    attachFacilityInputBehavior,
    loadHmoProviders,
    isAllowedPresetImageUrl,
    buildAvatarPresetGridHtml,
    wireAvatarPresetGrid,
    showDangerConfirm,
    ensureAvatarPresetsLoaded,
  });

  initDoctorsModule({
    apiRequest,
    getApiErrorMessage,
    getCurrentUserRole,
    getCurrentUserId,
    getCurrentReceptionistType,
    isAllowedPresetImageUrl,
    buildAvatarPresetGridHtml,
    wireAvatarPresetGrid,
    ensureAvatarPresetsLoaded,
    setupTaggedFacilityMultiSelect,
    renderFacilityDatalist,
    parseAffiliatedClinics,
    loadFacilities,
    buildDoctorAvailabilityLabel,
    formatDateForInput,
    renderPatientBooking,
  });

  initShell({ updateAuthNav, renderLogin });

  initAppointmentsModule({
    apiRequest,
    getApiErrorMessage,
    getCurrentUserRole,
    getCurrentUserId,
    getCurrentLinkedDoctorId,
    formatPatientDisplayName,
    formatPatientFullNameOnly,
    formatPatientAddress,
    formatDateDisplay,
    formatDateForInput,
    normalizeTimeText,
    buildBookingTimeGridHtml,
    showDangerConfirm,
    showToast,
    escapeHtml,
    setPageTone,
    API_BASE,
  });

  initUsersModule({
    apiRequest,
    getCurrentUserRole,
    showToast,
    showDangerConfirm,
    mainContent,
    setPageTone,
  });

  // Start the App
  bootstrapTheme();
  loadDashboardState();
  setupShellInteractions();
  setupCommandPalette();
  checkAuthStatus();
  void ensureDoctorSpecialtiesLoaded();
  updateAuthNav();
  renderPage();

  navigation.registerNavigationEvents();

  window.addEventListener("message", handleGoogleAuthMessage);
});


function updateAuthNav() {
  const loginLink = document.getElementById("login-link");
  const signedIn = isLoggedIn();
  const role = getCurrentUserRole();
  const doctorDashLi = document.querySelector(".nav-li-doctor-dash");
  if (doctorDashLi) {
    doctorDashLi.style.display = signedIn && role === "doctor" ? "" : "none";
  }
  const staffNavLis = document.querySelectorAll(".nav-li-staff-only");
  const staffNavRoles = new Set(["doctor", "receptionist", "admin"]);
  staffNavLis.forEach((li) => {
    li.style.display = signedIn && staffNavRoles.has(String(role || "")) ? "" : "none";
  });
  if (signedIn) {
    mountFloatingChatWidget();
  } else {
    hideFloatingChatWidget();
  }
  if (!loginLink) return;
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const isHome = href === "#home";
    const isLogin = href === "#login";
    if (!signedIn) {
      link.style.display = isHome || isLogin ? "" : "none";
      return;
    }
    if (isLogin) {
      link.style.display = "none";
      return;
    }
    link.style.display = "";
  });
  if (sidebarUserMenu) {
    sidebarUserMenu.style.display = signedIn ? "" : "none";
  }
  if (sidebarUserPopover) {
    sidebarUserPopover.classList.add("hidden");
  }
  if (sidebarUserTrigger) {
    sidebarUserTrigger.style.display = signedIn ? "" : "none";
  }
  updateSidebarAccountInfo();
  if (sidebarClockIntervalId) {
    clearInterval(sidebarClockIntervalId);
    sidebarClockIntervalId = null;
  }
  if (signedIn) {
    cacheCurrentUserProfile();
    refreshCurrentUserCacheFromApi();
    sidebarClockIntervalId = setInterval(updateSidebarAccountInfo, 1000);
  }
  if (signedIn) {
    loginLink.textContent = "Login";
    loginLink.onclick = null;
  } else {
    loginLink.textContent = "Login";
    loginLink.onclick = null;
  }
}

function parseIsoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeTime(isoValue) {
  if (window.DrMeetUtils?.formatRelativeTime) {
    return window.DrMeetUtils.formatRelativeTime(isoValue);
  }
  return "just now";
}

function sortMessagesByRecent(messages) {
  return [...messages].sort((a, b) => {
    const left = parseIsoDate(a.createdAt)?.getTime() || 0;
    const right = parseIsoDate(b.createdAt)?.getTime() || 0;
    return right - left;
  });
}

export function participantAvatarUrl(participant) {
  const raw = String(
    participant?.avatarUrl || participant?.picture || "",
  ).trim();
  return raw || DEFAULT_AVATAR_URL;
}

export function participantDisplayName(participant) {
  return participant
    ? `${participant.firstName || ""} ${participant.lastName || ""}`.trim()
    : "Conversation";
}

export function conversationTypingLabel(conversationId, currentUserId) {
  const typingSet =
    dashboardState.typingByConversation?.[String(conversationId)];
  if (!typingSet || !(typingSet instanceof Set) || !typingSet.size) return "";
  const othersTyping = [...typingSet].some(
    (id) => String(id) !== String(currentUserId || ""),
  );
  return othersTyping ? "Typing..." : "";
}

export async function resolveDoctorIdForPatientMessaging() {
  const docRes = await apiRequest(`${API_BASE}/doctors`);
  if (!docRes.ok) return null;
  const doctors = await docRes.json();
  if (!Array.isArray(doctors) || !doctors.length) return null;
  const apptRes = await apiRequest(`${API_BASE}/appointments`);
  if (apptRes.ok) {
    const list = await apptRes.json();
    if (Array.isArray(list) && list.length) {
      const row = list.find((a) => a.doctor);
      if (row?.doctor) {
        const profile = doctors.find(
          (d) => String(d._id) === String(row.doctor),
        );
        if (profile?.userId) return String(profile.userId);
      }
    }
  }
  if (doctors[0]?.userId) return String(doctors[0].userId);
  return null;
}

async function resolvePatientMessageRecipient(patient) {
  if (!patient?._id) return null;
  try {
    const res = await apiRequest(
      `${API_BASE}/patients/${patient._id}/messaging-recipient`,
    );
    if (!res.ok) return null;
    const payload = await res.json();
    return payload?.recipientUserId ? String(payload.recipientUserId) : null;
  } catch (error) {
    return null;
  }
}

async function fetchMyPatientRecord() {
  const res = await apiRequest(`${API_BASE}/patients`);
  if (!res.ok) return null;
  const list = await res.json();
  return Array.isArray(list) && list.length ? list[0] : null;
}

const messengerAttachmentPreviewUrls = new WeakMap();

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function clearMessengerAttachmentPreview(rootEl) {
  if (!rootEl) return;
  const preview = rootEl.querySelector("[data-messenger-attachment-preview]");
  const fileInput = rootEl.querySelector("[data-messenger-file-input]");
  const prevUrl = messengerAttachmentPreviewUrls.get(rootEl);
  if (prevUrl) {
    URL.revokeObjectURL(prevUrl);
    messengerAttachmentPreviewUrls.delete(rootEl);
  }
  if (fileInput) fileInput.value = "";
  if (preview) {
    preview.classList.add("hidden");
    preview.innerHTML = "";
  }
}

function syncMessengerAttachmentPreview(rootEl) {
  if (!rootEl) return;
  const preview = rootEl.querySelector("[data-messenger-attachment-preview]");
  const fileInput = rootEl.querySelector("[data-messenger-file-input]");
  if (!preview) return;

  const prevUrl = messengerAttachmentPreviewUrls.get(rootEl);
  if (prevUrl) {
    URL.revokeObjectURL(prevUrl);
    messengerAttachmentPreviewUrls.delete(rootEl);
  }

  const file = fileInput?.files?.[0];
  if (!file) {
    preview.classList.add("hidden");
    preview.innerHTML = "";
    return;
  }

  const isImage = String(file.type || "")
    .toLowerCase()
    .startsWith("image/");
  let thumbMarkup = `<span class="messenger-attachment-icon" aria-hidden="true">📎</span>`;
  if (isImage) {
    const objectUrl = URL.createObjectURL(file);
    messengerAttachmentPreviewUrls.set(rootEl, objectUrl);
    thumbMarkup = `<img src="${escapeHtml(objectUrl)}" alt="" class="messenger-attachment-thumb" />`;
  }

  preview.innerHTML = `
    <div class="messenger-attachment-chip">
      ${thumbMarkup}
      <div class="messenger-attachment-meta">
        <strong class="messenger-attachment-name">${escapeHtml(file.name || "Attachment")}</strong>
        <span class="messenger-attachment-status">${escapeHtml(formatFileSize(file.size))} · Queued — press Send</span>
      </div>
      <button type="button" class="messenger-attachment-remove" data-messenger-attachment-remove aria-label="Remove attachment">&times;</button>
    </div>`;
  preview.classList.remove("hidden");

  preview
    .querySelector("[data-messenger-attachment-remove]")
    ?.addEventListener("click", () => {
      clearMessengerAttachmentPreview(rootEl);
    });
}

const doctorDashUI = { activeTab: "overview", loaded: {} };

function readDoctorOverviewCache() {
  try {
    const raw = sessionStorage.getItem(DOCTOR_OVERVIEW_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.at > DOCTOR_OVERVIEW_TTL_MS) return null;
    return parsed.data;
  } catch (e) {
    return null;
  }
}

function writeDoctorOverviewCache(data) {
  try {
    sessionStorage.setItem(
      DOCTOR_OVERVIEW_CACHE_KEY,
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch (e) {
    /* ignore */
  }
}

async function fetchDoctorOverviewFresh() {
  const res = await apiRequest(`${API_BASE}/doctors/me/overview`);
  if (!res.ok)
    throw new Error(await getApiErrorMessage(res, "Unable to load overview."));
  const data = await res.json();
  writeDoctorOverviewCache(data);
  return data;
}

async function getDoctorOverviewForUi() {
  const cached = readDoctorOverviewCache();
  if (cached) return { data: cached, fromCache: true };
  const data = await fetchDoctorOverviewFresh();
  return { data, fromCache: false };
}

async function showClinicalTab(tab) {
  const panel = document.getElementById("clinical-tab-panel");
  if (!panel) return;
  const reuseClinicalPatientSearch =
    tab === "patients" ? document.getElementById("clinical-patient-search") : null;
  const isClinicalPatientListRefresh =
    Boolean(reuseClinicalPatientSearch && panel.contains(reuseClinicalPatientSearch));

  if (isClinicalPatientListRefresh) {
    const ul = panel.querySelector(".clinical-patient-list");
    if (ul) ul.innerHTML = `<li class="feedback clinical-loading">Searching…</li>`;
  } else {
    panel.innerHTML = `<p class="feedback clinical-loading">Loading…</p>`;
  }

  try {
    if (tab === "overview") {
      const { data, fromCache } = await getDoctorOverviewForUi();
      const s = data.stats || {};
      panel.innerHTML = `
        <div class="clinical-overview-rows">
          <article class="card clinical-stat-card"><h4>Assigned patients</h4><p class="clinical-stat-value">${escapeHtml(String(s.assignedPatientCount ?? 0))}</p></article>
          <article class="card clinical-stat-card"><h4>Upcoming visits</h4><p class="clinical-stat-value">${escapeHtml(String(s.upcomingAppointmentCount ?? 0))}</p></article>
          <article class="card clinical-stat-card"><h4>Past visits</h4><p class="clinical-stat-value">${escapeHtml(String(s.pastAppointmentCount ?? 0))}</p></article>
          <article class="card clinical-stat-card"><h4>Conversations</h4><p class="clinical-stat-value">${escapeHtml(String(s.messageThreads ?? 0))}</p></article>
        </div>
        <section class="card clinical-detail-card">
          <h4>Practice details</h4>
          <p><strong>Professional license</strong><br /><span class="clinical-muted">${escapeHtml(data.licenseNumber || "—")}</span></p>
          <p><strong>Clinic / facility</strong><br /><span class="clinical-muted">${escapeHtml(data.clinic || "—")}</span></p>
          <p><strong>Room</strong><br /><span class="clinical-muted">${escapeHtml(data.room || "—")}</span></p>
          ${fromCache ? `<p class="clinical-cache-note">Figures below may be from your last refresh. Tap Refresh summary for the latest.</p>` : ""}
          <button type="button" class="btn btn-secondary btn-sm" id="clinical-refresh-overview">Refresh summary</button>
        </section>
      `;
      document
        .getElementById("clinical-refresh-overview")
        ?.addEventListener("click", async () => {
          sessionStorage.removeItem(DOCTOR_OVERVIEW_CACHE_KEY);
          doctorDashUI.loaded.overview = false;
          await fetchDoctorOverviewFresh();
          await showClinicalTab("overview");
        });
      doctorDashUI.loaded.overview = true;
      return;
    }

    if (tab === "patients") {
      const prevSearch = document.getElementById("clinical-patient-search");
      const q = prevSearch?.value?.trim() || "";
      const url = new URL(
        `${API_BASE}/doctors/me/patients`,
        window.location.origin,
      );
      if (q) url.searchParams.set("q", q);
      const res = await apiRequest(url.toString());
      if (!res.ok)
        throw new Error(
          await getApiErrorMessage(res, "Unable to load patients."),
        );
      const payload = await res.json();
      const rows = Array.isArray(payload.patients) ? payload.patients : [];
      const listItemsHtml = rows.length
        ? rows
          .map(
            (p) => `
            <li class="clinical-patient-row card">
              <div>
                <strong>${escapeHtml(formatPatientDisplayName(p) || "Patient")}</strong>
                <p class="clinical-muted">${escapeHtml(p.email || "")} · ${escapeHtml(p.phone || "")}</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm clinical-patient-quick" data-patient-quick="${escapeHtml(String(p._id))}">Quick view</button>
            </li>`,
          )
          .join("")
        : `<li class="feedback">No patients match your assignment yet.</li>`;

      if (isClinicalPatientListRefresh) {
        const ul = panel.querySelector(".clinical-patient-list");
        if (ul) ul.innerHTML = listItemsHtml;
      } else {
        panel.innerHTML = `
        <label class="clinical-search-label">Search patients
          <input type="search" id="clinical-patient-search" class="clinical-search-input" placeholder="Name or email" value="${escapeHtml(q)}" />
        </label>
        <ul class="clinical-patient-list">
          ${listItemsHtml}
        </ul>
      `;
        const search = document.getElementById("clinical-patient-search");
        let clinicalPatientSearchTimer = null;
        const runClinicalPatientSearch = () => {
          void showClinicalTab("patients");
        };
        search?.addEventListener("input", () => {
          if (clinicalPatientSearchTimer) clearTimeout(clinicalPatientSearchTimer);
          clinicalPatientSearchTimer = setTimeout(runClinicalPatientSearch, 320);
        });
        search?.addEventListener("change", runClinicalPatientSearch);
        search?.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            if (clinicalPatientSearchTimer) clearTimeout(clinicalPatientSearchTimer);
            runClinicalPatientSearch();
          }
        });
      }
      panel.querySelectorAll("[data-patient-quick]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-patient-quick");
          const row = rows.find((r) => String(r._id) === String(id));
          if (!row) return;
          showToast(
            `${row.firstName || ""} ${row.lastName || ""} · ${row.email || "no email"}`,
          );
        });
      });
      doctorDashUI.loaded.patients = true;
      return;
    }

    if (tab === "appointments") {
      const res = await apiRequest(
        `${API_BASE}/doctors/me/appointments?scope=all`,
      );
      if (!res.ok)
        throw new Error(
          await getApiErrorMessage(res, "Unable to load appointments."),
        );
      const payload = await res.json();
      const upcoming = Array.isArray(payload.upcoming) ? payload.upcoming : [];
      const past = Array.isArray(payload.past) ? payload.past : [];

      const renderApptRow = (a) => {
        const pname =
          typeof a.patientId === "object"
            ? formatPatientDisplayName(a.patientId) ||
            String(a.patientId?.name || "")
            : "";
        const dt = a.date ? new Date(a.date).toLocaleString() : "";
        const statusValue = String(a.status || "pending").toLowerCase();
        const statusOpts = ["pending", "confirmed", "completed", "cancelled"]
          .map(
            (st) => {
              const label = st === "completed" ? "complete" : st;
              return `<option value="${st}" ${statusValue === st ? "selected" : ""}>${label}</option>`;
            },
          )
          .join("");
        return `
          <tr data-appt-id="${escapeHtml(String(a._id))}">
            <td>${escapeHtml(dt)}</td>
            <td>${escapeHtml(String(a.time || ""))}</td>
            <td>${escapeHtml(pname || "Unknown patient")}</td>
            <td>${escapeHtml(String(a.reason || ""))}</td>
            <td>
              <select class="clinical-appt-status" aria-label="Appointment status">
                ${statusOpts}
              </select>
            </td>
          </tr>`;
      };

      panel.innerHTML = `
        <div class="clinical-appt-toolbar">
          <button type="button" class="btn btn-secondary btn-sm" id="clinical-appt-refresh">Refresh appointments</button>
        </div>
        <section class="card clinical-appt-section">
          <h4>Upcoming</h4>
          <div class="clinical-table-wrap">
            <table class="clinical-table">
              <thead><tr><th>When</th><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>${upcoming.length ? upcoming.map(renderApptRow).join("") : `<tr><td colspan="5" class="clinical-muted">No upcoming appointments.</td></tr>`}</tbody>
            </table>
          </div>
        </section>
        <section class="card clinical-appt-section">
          <h4>Past</h4>
          <div class="clinical-table-wrap">
            <table class="clinical-table">
              <thead><tr><th>When</th><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>${past.length ? past.map(renderApptRow).join("") : `<tr><td colspan="5" class="clinical-muted">No past appointments.</td></tr>`}</tbody>
            </table>
          </div>
        </section>
      `;

      document.getElementById("clinical-appt-refresh")?.addEventListener("click", () => {
        sessionStorage.removeItem(DOCTOR_OVERVIEW_CACHE_KEY);
        void showClinicalTab("appointments");
      });
      panel.querySelectorAll(".clinical-appt-status").forEach((sel) => {
        sel.addEventListener("change", async () => {
          const tr = sel.closest("tr");
          const id = tr?.getAttribute("data-appt-id");
          if (!id) return;
          try {
            const resAp = await apiRequest(
              `${API_BASE}/doctors/me/appointments/${id}/status`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: sel.value }),
              },
            );
            if (!resAp.ok)
              throw new Error(
                await getApiErrorMessage(resAp, "Update failed."),
              );
            showToast("Appointment updated.");
            sessionStorage.removeItem(DOCTOR_OVERVIEW_CACHE_KEY);
          } catch (err) {
            showToast(err?.message || "Unable to update.", "error");
          }
        });
      });
      doctorDashUI.loaded.appointments = true;
      return;
    }

    if (tab === "documents") {
      const [res, pres] = await Promise.all([
        apiRequest(`${API_BASE}/doctors/me/documents`),
        apiRequest(`${API_BASE}/doctors/me/patients?limit=500`),
      ]);
      if (!res.ok)
        throw new Error(
          await getApiErrorMessage(res, "Unable to load documents."),
        );
      const payload = await res.json();
      const docs = Array.isArray(payload.documents) ? payload.documents : [];
      let patientRows = [];
      if (pres.ok) {
        const pj = await pres.json();
        patientRows = Array.isArray(pj.patients) ? pj.patients : [];
      }
      const patientOptions = [
        `<option value="">Select patient…</option>`,
        ...patientRows.map((p) => {
          const label = formatPatientDisplayName(p) || "Patient";
          return `<option value="${escapeHtml(String(p._id))}">${escapeHtml(label)}</option>`;
        }),
      ].join("");
      panel.innerHTML = `
        <p class="clinical-muted clinical-doc-hint">Upload files to your shared clinic library or attach them to a specific patient’s chart.</p>
        <section class="card">
          <h4>Upload a document</h4>
          <form id="clinical-doc-upload" class="clinical-upload-form">
            <label>Save to
              <select name="scope" id="clinical-doc-scope">
                <option value="clinic">Clinic library (shared)</option>
                <option value="patient">Patient chart</option>
              </select>
            </label>
            <label>Patient
              <select name="patientId" id="clinical-doc-patient">${patientOptions}</select>
              <small class="clinical-field-hint" id="clinical-doc-patient-hint">Choose a patient when saving to a chart.</small>
            </label>
            <label>Document title
              <input name="documentName" type="text" required placeholder="e.g. Lab results — CBC, Referral letter" />
            </label>
            <label>File
              <input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" />
            </label>
            <button type="submit" class="btn btn-primary">Upload</button>
          </form>
        </section>
        <h4 class="clinical-docs-list-title">Recent uploads</h4>
        <ul class="clinical-doc-list">
          ${docs.length
          ? docs
            .map(
              (d) => `
            <li class="card clinical-doc-row">
              <div>
                <strong>${escapeHtml(d.name || "Document")}</strong>
                <p class="clinical-muted">${escapeHtml(d.source === "patient" ? "Patient chart" : d.source === "clinic" ? "Clinic library" : d.source || "—")}${d.patientName ? ` · ${escapeHtml(d.patientName)}` : ""}</p>
                <p class="clinical-muted">${d.uploadedAt ? escapeHtml(new Date(d.uploadedAt).toLocaleString()) : ""}</p>
              </div>
              <a class="btn btn-secondary btn-sm" href="${escapeHtml(d.fileUrl || d.url || "#")}" target="_blank" rel="noopener noreferrer">Open</a>
            </li>`,
            )
            .join("")
          : `<li class="feedback">No documents yet.</li>`
        }
        </ul>
      `;

      const scopeSel = document.getElementById("clinical-doc-scope");
      const patientSel = document.getElementById("clinical-doc-patient");
      const syncDocPatientField = () => {
        const sc = scopeSel?.value || "clinic";
        if (!patientSel) return;
        if (sc === "patient") {
          patientSel.disabled = false;
          patientSel.required = true;
        } else {
          patientSel.disabled = true;
          patientSel.required = false;
          patientSel.value = "";
        }
      };
      scopeSel?.addEventListener("change", syncDocPatientField);
      syncDocPatientField();

      document
        .getElementById("clinical-doc-upload")
        ?.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const form = ev.target;
          const submitBtn = form.querySelector('button[type="submit"]');
          const fd = new FormData(form);
          const file = fd.get("file");
          if (!(file instanceof File) || !file.size) {
            showToast("Choose a file to upload.", "error");
            return;
          }
          const scope = String(fd.get("scope") || "clinic");
          const patientId = String(fd.get("patientId") || "").trim();
          if (scope === "patient" && !patientId) {
            showToast("Select a patient for chart uploads.", "error");
            return;
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Uploading…";
          }
          try {
            const documentFileData = await fileToDataUrl(file);
            const body = {
              scope,
              patientId: scope === "patient" ? patientId : "",
              documentName: fd.get("documentName"),
              documentFileData,
            };
            const resUp = await apiRequest(
              `${API_BASE}/doctors/me/documents`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              },
            );
            if (!resUp.ok)
              throw new Error(
                await getApiErrorMessage(resUp, "Upload failed."),
              );
            showToast("Document uploaded.");
            sessionStorage.removeItem(DOCTOR_OVERVIEW_CACHE_KEY);
            await showClinicalTab("documents");
          } catch (err) {
            showToast(err?.message || "Upload failed.", "error");
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Upload";
            }
          }
        });
      doctorDashUI.loaded.documents = true;
      return;
    }

    if (tab === "settings") {
      const res = await apiRequest(`${API_BASE}/doctors/me/overview`);
      if (!res.ok)
        throw new Error(
          await getApiErrorMessage(res, "Unable to load settings."),
        );
      const overview = await res.json();
      const prefs = overview.notificationPrefs || {};
      panel.innerHTML = `
        <section class="card">
          <h4>Notifications</h4>
          <label><input type="checkbox" id="clinical-pref-appt" ${prefs.emailAppointments !== false ? "checked" : ""} /> Appointment-related email (beta)</label>
          <label><input type="checkbox" id="clinical-pref-msg" ${prefs.emailMessages !== false ? "checked" : ""} /> Message-related email (beta)</label>
          <button type="button" class="btn btn-primary" id="clinical-save-prefs">Save preferences</button>
        </section>
        <section class="card">
          <h4>Account</h4>
          <p class="clinical-muted">Theme, password, and profile fields stay in <a href="#settings">global settings</a>.</p>
        </section>
      `;
      document
        .getElementById("clinical-save-prefs")
        ?.addEventListener("click", async () => {
          const emailAppointments =
            document.getElementById("clinical-pref-appt")?.checked ?? true;
          const emailMessages =
            document.getElementById("clinical-pref-msg")?.checked ?? true;
          try {
            const resP = await apiRequest(
              `${API_BASE}/doctors/me/notification-prefs`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emailAppointments, emailMessages }),
              },
            );
            if (!resP.ok)
              throw new Error(await getApiErrorMessage(resP, "Save failed."));
            showToast("Preferences saved.");
            sessionStorage.removeItem(DOCTOR_OVERVIEW_CACHE_KEY);
          } catch (err) {
            showToast(err?.message || "Unable to save.", "error");
          }
        });
      doctorDashUI.loaded.settings = true;
      return;
    }

    if (tab === "billing") {
      const res = await apiRequest(
        `${API_BASE}/doctors/me/appointments?scope=all`,
      );
      if (!res.ok)
        throw new Error(
          await getApiErrorMessage(res, "Unable to load visits."),
        );
      const payload = await res.json();
      const merged = [...(payload.upcoming || []), ...(payload.past || [])];
      const seen = new Set();
      const rows = [];
      merged.forEach((a) => {
        const id = String(a._id);
        if (seen.has(id)) return;
        seen.add(id);
        rows.push(a);
      });
      rows.sort((a, b) => new Date(b.date) - new Date(a.date));

      const pname = (a) =>
        typeof a.patientId === "object"
          ? formatPatientDisplayName(a.patientId) ||
          String(a.patientId?.name || "Patient")
          : "Patient";
      const patientPhoto = (a) => {
        const o = a.patientId;
        if (typeof o === "object" && o?.photoUrl)
          return String(o.photoUrl).trim();
        return "";
      };

      panel.innerHTML = `
        <section class="card">
          <h4>Billing &amp; HMO per visit</h4>
          <p class="clinical-muted">Set fees and services for each visit, record how the patient paid, and track insurance when applicable.</p>
          <div class="clinical-table-wrap clinical-billing-scroll">
            <table class="clinical-table clinical-billing-table">
              <thead>
                <tr>
                  <th>Visit</th>
                  <th>Patient</th>
                  <th>Consult fee</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>HMO</th>
                  <th>Coverage</th>
                  <th>Claim</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${rows.length
          ? rows
            .map((a) => {
              const b = a.billing || {};
              const dt = a.date
                ? escapeHtml(new Date(a.date).toLocaleString())
                : "—";
              const pimg = escapeHtml(
                patientPhoto(a) || DEFAULT_AVATAR_URL,
              );
              return `<tr>
                    <td>${dt}</td>
                    <td class="clinical-billing-patient-cell"><span class="clinical-billing-patient-identity"><img class="clinical-billing-patient-avatar" src="${pimg}" alt="" width="32" height="32" />${escapeHtml(pname(a))}</span></td>
                    <td>${escapeHtml(String(b.consultationFee ?? 0))}</td>
                    <td>${escapeHtml(String(b.totalAmount ?? 0))}</td>
                    <td>${escapeHtml(String(b.paymentStatus || "unpaid"))}</td>
                    <td>${escapeHtml(String(b.hmoProvider || "—"))}</td>
                    <td>${escapeHtml(String(b.hmoCoverageStatus || "—"))}</td>
                    <td>${escapeHtml(String(b.hmoClaimStatus || "—"))}</td>
                    <td><button type="button" class="btn btn-secondary btn-sm clinical-billing-edit" data-appt-id="${escapeHtml(String(a._id))}">Edit</button></td>
                  </tr>`;
            })
            .join("")
          : `<tr><td colspan="9" class="clinical-muted">No appointments yet.</td></tr>`
        }
              </tbody>
            </table>
          </div>
        </section>
      `;

      let hmoOptions = "";
      let paymentCategories = [];
      try {
        const [pres, pm] = await Promise.all([
          apiRequest(`${API_BASE}/patients/constants/hmo-providers`),
          apiRequest(`${API_BASE}/doctors/me/payment-methods`),
        ]);
        if (pres.ok) {
          const js = await pres.json();
          const list = Array.isArray(js.providers) ? js.providers : [];
          hmoOptions = list
            .map(
              (p) =>
                `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`,
            )
            .join("");
        }
        if (pm.ok) {
          const pj = await pm.json();
          paymentCategories = Array.isArray(pj.paymentMethodCategories)
            ? pj.paymentMethodCategories
            : [];
        }
      } catch (e) {
        /* ignore */
      }
      if (!paymentCategories.length) {
        paymentCategories = PAYMENT_METHOD_CATEGORIES_FALLBACK.map((c) => ({
          category: c.category,
          methods: [...c.methods],
        }));
      }

      const formatPaymentCategoryLabel = (slug) =>
        String(slug || "")
          .split("_")
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");

      const ensureBillingDialog = () => {
        let dlg = document.getElementById("clinical-billing-dialog");
        if (!dlg) {
          dlg = document.createElement("dialog");
          dlg.id = "clinical-billing-dialog";
          dlg.className = "clinical-billing-dialog";
          document.body.appendChild(dlg);
        }
        return dlg;
      };

      const openBillingEditor = async (appt) => {
        const dlg = ensureBillingDialog();
        const b = appt.billing || {};
        const lines = Array.isArray(b.serviceLines) ? b.serviceLines : [];
        const svcRows =
          lines.length > 0
            ? lines
            : [
              { description: "", amount: 0 },
              { description: "", amount: 0 },
            ];
        const savedMethod = String(b.paymentMethod || "").trim();
        const savedCat = String(b.paymentMethodCategory || "").trim();
        let initialCat = savedCat;
        if (!initialCat && savedMethod) {
          for (const c of paymentCategories) {
            if ((c.methods || []).includes(savedMethod)) {
              initialCat = c.category;
              break;
            }
          }
        }
        if (!initialCat && paymentCategories.length) {
          initialCat = paymentCategories[0].category;
        }
        const activeGroup =
          paymentCategories.find((c) => c.category === initialCat) ||
          paymentCategories[0] ||
          {};
        const methodsList = Array.isArray(activeGroup.methods)
          ? activeGroup.methods
          : [];
        const payCategoryOptions = paymentCategories
          .map(
            (c) =>
              `<option value="${escapeHtml(c.category)}" ${c.category === initialCat ? "selected" : ""}>${escapeHtml(formatPaymentCategoryLabel(c.category))}</option>`,
          )
          .join("");
        const legacyPayOption =
          savedMethod && !methodsList.includes(savedMethod)
            ? `<option value="${escapeHtml(savedMethod)}" selected>${escapeHtml(savedMethod)} (saved)</option>`
            : "";
        const payMethodOptions = [
          `<option value="">— Select method —</option>`,
          ...methodsList.map(
            (m) =>
              `<option value="${escapeHtml(m)}" ${m === savedMethod ? "selected" : ""}>${escapeHtml(m)}</option>`,
          ),
          legacyPayOption,
        ].join("");
        dlg.innerHTML = `
          <div class="clinical-billing-dialog-inner card">
            <div class="clinical-billing-dialog-head">
              <h4>Edit billing</h4>
              <button type="button" class="btn btn-secondary btn-sm" data-billing-close>&times;</button>
            </div>
            <form id="clinical-billing-form" class="clinical-billing-form" novalidate>
              <input type="hidden" name="appointmentId" value="${escapeHtml(String(appt._id))}" />
              <label>Consultation fee (PHP)<input name="consultationFee" type="number" step="0.01" min="0" value="${escapeHtml(String(b.consultationFee ?? 0))}" /></label>
              <fieldset class="clinical-service-lines">
                <legend>Services (line items)</legend>
                ${[0, 1, 2, 3]
            .map((i) => {
              const line = svcRows[i] || { description: "", amount: 0 };
              return `
                  <div class="clinical-service-line">
                    <input type="text" name="svc_desc_${i}" placeholder="Description" value="${escapeHtml(String(line.description || ""))}" />
                    <input type="number" name="svc_amt_${i}" placeholder="Amount" step="0.01" min="0" value="${escapeHtml(String(line.amount ?? 0))}" />
                  </div>`;
            })
            .join("")}
              </fieldset>
              <label>Payment status
                <select name="paymentStatus">
                  ${["unpaid", "partial", "paid"].map((v) => `<option value="${v}" ${String(b.paymentStatus || "unpaid") === v ? "selected" : ""}>${v}</option>`).join("")}
                </select>
              </label>
              <label>Payment category
                <select name="paymentMethodCategory" id="clinical-pay-category">${payCategoryOptions}</select>
              </label>
              <label>Payment method
                <select name="paymentMethod" id="clinical-pay-method">${payMethodOptions}</select>
              </label>
              <div id="clinical-hmo-section" class="clinical-hmo-section">
                <h5 class="clinical-hmo-title">Insurance / HMO</h5>
                <label>HMO or payer name
                  <select name="hmoProvider"><option value="">—</option>${hmoOptions}</select>
                </label>
                <label>Member ID<input name="hmoMemberId" value="${escapeHtml(String(b.hmoMemberId || ""))}" placeholder="Member or policy number" /></label>
                <label>Coverage verification
                  <select name="hmoCoverageStatus">
                    ${["", "verified", "partial", "denied"].map((v) => `<option value="${v}" ${String(b.hmoCoverageStatus || "") === v ? "selected" : ""}>${v || "—"}</option>`).join("")}
                  </select>
                </label>
                <label>Pre-authorization reference<input name="hmoPreAuthorization" value="${escapeHtml(String(b.hmoPreAuthorization || ""))}" placeholder="Authorization or approval ref" /></label>
                <label>Claim status
                  <select name="hmoClaimStatus">
                    ${["", "pending", "submitted", "approved", "rejected", "paid"].map((v) => `<option value="${v}" ${String(b.hmoClaimStatus || "") === v ? "selected" : ""}>${v || "—"}</option>`).join("")}
                  </select>
                </label>
                <label>Plan covered amount (PHP)<input name="hmoCoveredAmount" type="number" step="0.01" min="0" value="${escapeHtml(String(b.hmoCoveredAmount ?? 0))}" /></label>
                <label>Patient co-pay (PHP)<input name="hmoPatientCopay" type="number" step="0.01" min="0" value="${escapeHtml(String(b.hmoPatientCopay ?? 0))}" /></label>
              </div>
              <div class="clinical-billing-links">
                ${b.soaUrl ? `<p><a href="${escapeHtml(b.soaUrl)}" target="_blank" rel="noopener noreferrer">Open SOA</a></p>` : ""}
                ${b.invoiceUrl ? `<p><a href="${escapeHtml(b.invoiceUrl)}" target="_blank" rel="noopener noreferrer">Open invoice</a></p>` : ""}
              </div>
              <label>Attachment type
                <select id="clinical-billing-doc-kind-sel">
                  <option value="claim">HMO / insurance claim</option>
                  <option value="soa">Statement of account</option>
                  <option value="invoice">Invoice</option>
                </select>
              </label>
              <label class="clinical-upload-inline">Attach PDF or image
                <input type="file" id="clinical-billing-doc-input" data-billing-doc-kind accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" />
              </label>
              <button type="button" class="btn btn-secondary btn-sm" id="clinical-billing-upload-btn">Upload attachment</button>
              <div class="clinical-billing-actions">
                <button type="submit" class="btn btn-primary">Save billing</button>
                <button type="button" class="btn btn-secondary" data-billing-close>Cancel</button>
              </div>
            </form>
          </div>`;

        const sel = dlg.querySelector('select[name="hmoProvider"]');
        if (sel && b.hmoProvider) sel.value = b.hmoProvider;

        const catSel = dlg.querySelector("#clinical-pay-category");
        const methodSel = dlg.querySelector("#clinical-pay-method");
        const hmoSection = dlg.querySelector("#clinical-hmo-section");
        const syncHmoSection = () => {
          if (!hmoSection || !methodSel) return;
          const method = String(methodSel.value || "").trim();
          const show = CLINICAL_HMO_PAYMENT_METHODS.has(method);
          hmoSection.hidden = !show;
          hmoSection.setAttribute("aria-hidden", show ? "false" : "true");
        };
        const syncMethodsForCategory = () => {
          if (!catSel || !methodSel) return;
          const cat = catSel.value;
          const grp = paymentCategories.find((c) => c.category === cat);
          const methods = Array.isArray(grp?.methods) ? grp.methods : [];
          const keep = methodSel.value;
          methodSel.innerHTML = [
            `<option value="">— Select method —</option>`,
            ...methods.map(
              (m) =>
                `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`,
            ),
          ].join("");
          if (methods.includes(keep)) methodSel.value = keep;
          syncHmoSection();
        };
        catSel?.addEventListener("change", syncMethodsForCategory);
        methodSel?.addEventListener("change", syncHmoSection);
        syncHmoSection();

        dlg.querySelectorAll("[data-billing-close]").forEach((btn) => {
          btn.addEventListener("click", () => dlg.close());
        });

        const uploadBillingAttachment = async () => {
          const input = dlg.querySelector("#clinical-billing-doc-input");
          const uploadBtn = dlg.querySelector("#clinical-billing-upload-btn");
          const file = input?.files?.[0];
          if (!file) {
            showToast("Choose a file to upload.", "error");
            return;
          }
          const kind = String(
            dlg.querySelector("#clinical-billing-doc-kind-sel")?.value || "claim",
          ).toLowerCase();
          if (!["soa", "invoice", "claim"].includes(kind)) {
            showToast("Invalid document type.", "error");
            if (input) input.value = "";
            return;
          }
          if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = "Uploading…";
          }
          try {
            const documentFileData = await fileToDataUrl(file);
            const resUp = await apiRequest(
              `${API_BASE}/doctors/me/appointments/${appt._id}/billing/documents`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  kind,
                  documentName: file.name,
                  documentFileData,
                }),
              },
            );
            if (!resUp.ok)
              throw new Error(
                await getApiErrorMessage(resUp, "Upload failed."),
              );
            showToast("Document uploaded.");
            if (input) input.value = "";
            const next = await resUp.json();
            appt.billing = next?.appointment?.billing || appt.billing || {};
            await openBillingEditor(appt);
          } catch (err) {
            showToast(err?.message || "Upload failed.", "error");
          } finally {
            if (uploadBtn) {
              uploadBtn.disabled = false;
              uploadBtn.textContent = "Upload attachment";
            }
          }
        };
        dlg
          .querySelector("#clinical-billing-upload-btn")
          ?.addEventListener("click", uploadBillingAttachment);

        dlg
          .querySelector("#clinical-billing-form")
          ?.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const formEl = ev.currentTarget;
            const submitBtn = formEl.querySelector('button[type="submit"]');
            if (submitBtn?.dataset.saving === "1") return;
            const fd = new FormData(formEl);
            const apptIdForSave = String(
              fd.get("appointmentId") || appt._id || "",
            ).trim();
            if (!apptIdForSave) {
              showToast("Missing appointment id.", "error");
              return;
            }
            if (submitBtn) {
              submitBtn.dataset.saving = "1";
              submitBtn.disabled = true;
            }
            const serviceLines = [];
            for (let i = 0; i < 4; i++) {
              const d = String(fd.get(`svc_desc_${i}`) || "").trim();
              const amt = Number(fd.get(`svc_amt_${i}`)) || 0;
              if (d || amt) serviceLines.push({ description: d, amount: amt });
            }
            const methodForSave = String(fd.get("paymentMethod") || "").trim();
            const body = {
              consultationFee: Number(fd.get("consultationFee")) || 0,
              serviceLines,
              paymentStatus: fd.get("paymentStatus"),
              paymentMethodCategory: fd.get("paymentMethodCategory"),
              paymentMethod: fd.get("paymentMethod"),
              hmoProvider: fd.get("hmoProvider"),
              hmoMemberId: fd.get("hmoMemberId"),
              hmoCoverageStatus: fd.get("hmoCoverageStatus"),
              hmoPreAuthorization: fd.get("hmoPreAuthorization"),
              hmoClaimStatus: fd.get("hmoClaimStatus"),
              hmoCoveredAmount: Number(fd.get("hmoCoveredAmount")) || 0,
              hmoPatientCopay: Number(fd.get("hmoPatientCopay")) || 0,
            };
            if (!CLINICAL_HMO_PAYMENT_METHODS.has(methodForSave)) {
              body.hmoProvider = "";
              body.hmoMemberId = "";
              body.hmoCoverageStatus = "";
              body.hmoPreAuthorization = "";
              body.hmoClaimStatus = "";
              body.hmoCoveredAmount = 0;
              body.hmoPatientCopay = 0;
            }
            try {
              const resP = await apiRequest(
                `${API_BASE}/doctors/me/appointments/${encodeURIComponent(apptIdForSave)}/billing`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                },
              );
              if (!resP.ok)
                throw new Error(await getApiErrorMessage(resP, "Save failed."));
              showToast("Billing saved.");
              dlg.close();
              await showClinicalTab("billing");
            } catch (err) {
              showToast(err?.message || "Unable to save billing.", "error");
            } finally {
              if (submitBtn) {
                submitBtn.dataset.saving = "0";
                submitBtn.disabled = false;
              }
            }
          });

        dlg.showModal();
      };

      panel.querySelectorAll(".clinical-billing-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-appt-id");
          const appt = rows.find((r) => String(r._id) === String(id));
          if (!appt) return;
          void openBillingEditor(appt);
        });
      });

      doctorDashUI.loaded.billing = true;
      return;
    }

    panel.innerHTML = `<div class="feedback error">Unknown tab.</div>`;
  } catch (err) {
    panel.innerHTML = `<div class="feedback error">${escapeHtml(err?.message || "Unable to load tab.")}</div>`;
  }
}

function renderDoctorDashboard() {
  if (!mainContent) return;
  setPageTone("doctors");
  if (!isLoggedIn() || getCurrentUserRole() !== "doctor") {
    mainContent.innerHTML = `<div class="feedback error">The clinical dashboard is available to doctor accounts.</div>`;
    return;
  }

  const tab = parseDoctorDashboardTab();
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "patients", label: "Patients" },
    { id: "appointments", label: "Appointments" },
    { id: "billing", label: "Billing" },
    { id: "documents", label: "Documents" },
    { id: "settings", label: "Settings" },
  ];

  mainContent.innerHTML = `
    <div class="clinical-dashboard" data-clinical-root>
      <header class="clinical-dash-header">
        <div class="clinical-dash-identity">
          <p class="clinical-dash-kicker">Clinical workspace</p>
          <h2 class="clinical-dash-title">Doctor dashboard</h2>
          <p class="clinical-muted">Overview, patients, visits, billing, and documents — all in one place.</p>
        </div>
      </header>
      <nav class="clinical-dash-tabs" role="tablist" aria-label="Clinical sections">
        ${tabs
      .map(
        (t) =>
          `<button type="button" role="tab" class="clinical-tab ${tab === t.id ? "clinical-tab-active" : ""}" data-clinical-tab="${t.id}" aria-selected="${tab === t.id ? "true" : "false"}">${escapeHtml(t.label)}</button>`,
      )
      .join("")}
      </nav>
      <div id="clinical-tab-panel" class="clinical-tab-panel" role="tabpanel"></div>
    </div>
  `;

  mainContent
    .querySelector(".clinical-dashboard")
    ?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-clinical-tab]");
      if (!btn) return;
      const next = btn.getAttribute("data-clinical-tab");
      if (!next || next === parseDoctorDashboardTab()) return;
      setDoctorDashboardHashTab(next);
    });

  void showClinicalTab(parseDoctorDashboardTab());
}

function setPageTone(kind) {
  if (!mainContent) return;
  mainContent.classList.remove(
    "page-tone-patients",
    "page-tone-doctors",
    "page-tone-appointments",
    "page-tone-users",
  );
  if (kind) mainContent.classList.add(`page-tone-${kind}`);
}

async function renderSettings() {
  if (!mainContent) return;
  setPageTone("");
  if (!isLoggedIn()) {
    mainContent.innerHTML = `<div class="feedback error">Please log in to view settings.</div>`;
    return;
  }
  await ensureAvatarPresetsLoaded();
  let cache = {};
  try {
    cache = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "{}");
  } catch (e) {
    cache = {};
  }
  const theme = localStorage.getItem(THEME_KEY) || "light";
  const role = getCurrentUserRole();
  const isStaffBookingPolicyRole = ["doctor", "receptionist"].includes(
    String(role || ""),
  );
  const presetRole = getCurrentUserRole() === "doctor" ? "doctor" : "patient";
  mainContent.innerHTML = `
    <h2 class="page-title">Settings</h2>
    <section class="card">
      <h3>Profile</h3>
      <p><strong>Name:</strong> ${escapeHtml(`${cache.firstName || ""} ${cache.lastName || ""}`.trim() || "—")}</p>
      <p><strong>Role:</strong> ${escapeHtml(String(cache.role || "—"))}</p>
    </section>
    <section class="card settings-profile-card">
      <h3>Profile photo</h3>
      <p class="signup-lead">Pick a preset (${presetRole === "doctor" ? "doctor" : "patient"} library) or upload your own image.</p>
      ${buildAvatarPresetGridHtml(presetRole)}
      <label>Upload custom image
        <input type="file" id="settings-profile-photo-file" accept="image/*" />
      </label>
      <button type="button" class="btn btn-primary" id="settings-save-profile-photo">Save profile photo</button>
      <p id="settings-profile-photo-feedback" class="feedback" style="display:none" role="status"></p>
    </section>
    <section class="card">
      <h3>Preferences</h3>
      <label>Theme
        <select id="settings-theme">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </section>
    <section class="card">
      <h3>Notifications</h3>
      <p class="signup-lead">Appointment and message alerts can be expanded here in a future update.</p>
      <label><input type="checkbox" id="settings-notify-email" disabled /> Email reminders (coming soon)</label>
    </section>
    ${isStaffBookingPolicyRole
      ? `<section class="card">
      <h3>Booking Strategy</h3>
      <p class="signup-lead">Set a daily patient booking cap for your clinic calendar.</p>
      <label>Maximum patients per day
        <input id="settings-max-bookings-day" type="number" min="1" max="200" step="1" value="10" />
      </label>
      <button type="button" class="btn btn-primary" id="settings-save-booking-limit">Save booking limit</button>
      <p id="settings-booking-limit-feedback" class="feedback" style="display:none" role="status"></p>
    </section>`
      : ""
    }
  `;
  const profCard = mainContent.querySelector(".settings-profile-card");
  const settingsFileInput = document.getElementById("settings-profile-photo-file");
  if (profCard && settingsFileInput) {
    wireAvatarPresetGrid(profCard, settingsFileInput);
  }
  document
    .getElementById("settings-save-profile-photo")
    ?.addEventListener("click", async () => {
      const uid = getCurrentUserId();
      if (!uid) return;
      const fb = document.getElementById("settings-profile-photo-feedback");
      const preset = String(
        profCard?.querySelector('[name="presetPhotoUrl"]')?.value || "",
      ).trim();
      const file = settingsFileInput?.files?.[0];
      try {
        const body = {};
        if (file) {
          body.pictureFileData = await fileToDataUrl(file);
        } else if (preset && isAllowedPresetImageUrl(preset)) {
          body.picture = preset;
        } else {
          showToast("Choose a preset or an image file.", "error");
          return;
        }
        const res = await apiRequest(`${API_BASE}/users/${uid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok)
          throw new Error(await getApiErrorMessage(res, "Unable to save photo."));
        const savedUser = await res.json();
        applyUserRecordToLocalCache(savedUser);
        await refreshCurrentUserCacheFromApi();
        updateSidebarAccountInfo();
        if (fb) {
          fb.style.display = "block";
          fb.className = "feedback success";
          fb.textContent = "Profile photo updated.";
        }
        showToast("Profile photo saved.");
      } catch (err) {
        showToast(err?.message || "Unable to save profile photo.", "error");
        if (fb) {
          fb.style.display = "block";
          fb.className = "feedback error";
          fb.textContent = err?.message || "Save failed.";
        }
      }
    });
  const sel = document.getElementById("settings-theme");
  if (sel) {
    sel.value = theme === "dark" ? "dark" : "light";
    sel.addEventListener("change", () => {
      applyTheme(sel.value);
      renderTopbarBreadcrumbs();
    });
  }
  if (isStaffBookingPolicyRole) {
    const dailyInput = document.getElementById("settings-max-bookings-day");
    const feedback = document.getElementById("settings-booking-limit-feedback");
    try {
      const linkedDoctorId = getCurrentLinkedDoctorId();
      const docRes = await apiRequest(`${API_BASE}/doctors`);
      if (docRes.ok) {
        const docs = await docRes.json();
        const rows = Array.isArray(docs) ? docs : [];
        if (role === "doctor") {
          const uid = getCurrentUserId();
          const mine = rows.find(
            (d) => String(d.userId || "") === String(uid || ""),
          );
          if (dailyInput && mine?.bookingPolicy?.maxPatientsPerDay) {
            dailyInput.value = String(
              Number(mine.bookingPolicy.maxPatientsPerDay) || 10,
            );
          }
        } else {
          const linked = rows.find(
            (d) => String(d._id) === String(linkedDoctorId || ""),
          );
          if (dailyInput && linked?.bookingPolicy?.maxPatientsPerDay) {
            dailyInput.value = String(
              Number(linked.bookingPolicy.maxPatientsPerDay) || 10,
            );
          }
        }
      }
    } catch (e) {
      /* ignore prefill errors */
    }
    document
      .getElementById("settings-save-booking-limit")
      ?.addEventListener("click", async () => {
        const maxPatientsPerDay = Number(dailyInput?.value || 0);
        if (!Number.isFinite(maxPatientsPerDay) || maxPatientsPerDay < 1) {
          showToast("Enter a valid daily booking limit.", "error");
          return;
        }
        try {
          const res = await apiRequest(`${API_BASE}/appointments/booking-policy`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              maxPatientsPerDay,
            }),
          });
          if (!res.ok) {
            throw new Error(
              await getApiErrorMessage(res, "Unable to save booking limit."),
            );
          }
          if (feedback) {
            feedback.style.display = "block";
            feedback.className = "feedback success";
            feedback.textContent = "Booking limit saved.";
          }
          showToast("Booking limit saved.");
        } catch (err) {
          if (feedback) {
            feedback.style.display = "block";
            feedback.className = "feedback error";
            feedback.textContent = err?.message || "Unable to save booking limit.";
          }
          showToast(err?.message || "Unable to save booking limit.", "error");
        }
      });
  }
}

function renderPrivacy() {
  if (!mainContent) return;
  setPageTone("");
  mainContent.innerHTML = `
    <section class="card">
      <h2>Privacy Policy</h2>
      <p>DrMeet protects your account and medical workflow data with role-based access controls, encrypted transport, and secure session handling.</p>
      <p>We collect only information needed to deliver appointments, messaging, and patient-care coordination. Personal data is restricted by role permissions.</p>
      <p>Contact your clinic administrator if you need account data updates or removal support.</p>
    </section>
  `;
}

function renderHome() {
  if (!mainContent) return;
  setPageTone("");
  const signedIn = isLoggedIn();
  const bookCta =
    getCurrentUserRole() === "patient"
      ? `<p class="dashboard-book-teaser"><a href="#book" class="btn btn-primary">Book a visit</a> <span class="dashboard-book-hint">Search for a doctor and request an appointment.</span></p>`
      : "";
  mainContent.innerHTML = `
    <section class="dashboard-hero">
      <h1 class="home-hero-title">Welcome to DrMeet</h1>
      <p>Connected care coordination for patients, doctors, and clinic teams. Use the command palette (Ctrl/Cmd+K) to navigate quickly.</p>
      ${bookCta}
      <div class="inbox-live-row">
        <span class="live-badge ${dashboardState.websocketActive ? "active" : ""}">Live</span>
        <span class="live-status-text">${dashboardState.websocketActive
      ? "Live connection active — inbox updates are on."
      : dashboardState.socketReconnecting
        ? "Connecting... live updates can take up to 30 seconds to resume."
        : dashboardState.socketAwaitingFirstConnect
          ? "Connecting... preparing live updates."
          : "Offline — live updates unavailable."
    }</span>
      </div>
    </section>
    <section class="why-drmeet card">
      <div>
        <h3 class="home-section-title">Why Choose DrMeet</h3>
        <p>DrMeet centralizes patient records, visit workflows, and secure messaging in one modern workspace. Teams collaborate faster while patients get clearer updates.</p>
        <p>Smart routing, role-based access, and real-time communication keep every handoff accurate and accountable.</p>
      </div>
      <img class="why-drmeet-media" src="/images/drmeet-pic1.webp" alt="DrMeet technology in action" />
    </section>
    <section class="role-select card role-select-highlight">
      <h3 class="home-cta-title">Please select your profile type below</h3>
      <div class="role-select-grid">
        <button type="button" class="role-card role-card-doctor" id="role-select-doctor">
          <span class="role-card-label">I am a Provider</span>
          <span class="role-card-hint">Register as a Doctor to manage your practice.
            <span class="info-tooltip-trigger" tabindex="0">
              <img src="/images/info-i.svg" alt="Info" class="info-tooltip-icon" />
              <span class="info-tooltip-bubble">Register as a Doctor to manage your practice.</span>
            </span>
          </span>
        </button>
        <button type="button" class="role-card role-card-patient" id="role-select-patient">
          <span class="role-card-label">I am a Patient</span>
          <span class="role-card-hint">Create an account to find care and book appointments.
            <span class="info-tooltip-trigger" tabindex="0">
              <img src="/images/info-i.svg" alt="Info" class="info-tooltip-icon" />
              <span class="info-tooltip-bubble">Create an account to find care and book appointments.</span>
            </span>
          </span>
        </button>
      </div>
    </section>
    ${signedIn
      ? `<p class="clinical-muted dashboard-messages-hint">Use the <strong>Messages</strong> button at the bottom-right to read and send secure chat.</p>`
      : ""
    }
  `;
  if (signedIn && getCurrentUserRole() === "admin") {
    const host = document.createElement("section");
    host.className = "card";
    host.innerHTML = `
      <div class="card-header">
        <h3>System Diagnostics</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="export-diagnostics-csv">Export CSV</button>
      </div>
      <div id="diagnostics-status" class="feedback">Loading diagnostics...</div>
    `;
    mainContent.appendChild(host);
    apiRequest(`${API_BASE}/system/diagnostics`)
      .then(async (res) => {
        if (!res.ok)
          throw new Error(
            await getApiErrorMessage(res, "Diagnostics unavailable"),
          );
        return res.json();
      })
      .then((payload) => {
        const checks = Array.isArray(payload?.checks) ? payload.checks : [];
        const container = document.getElementById("diagnostics-status");
        if (!container) return;
        container.className = "feedback";
        container.innerHTML = checks
          .map(
            (c) =>
              `<div class="status-row"><span class="status-pill status-${c.status}">${c.status}</span><strong>${escapeHtml(c.label || c.key)}</strong><span>${escapeHtml(c.details || "")}</span></div>`,
          )
          .join("");
        document
          .getElementById("export-diagnostics-csv")
          ?.addEventListener("click", () => {
            downloadCsv(`diagnostics-${Date.now()}.csv`, checks);
          });
      })
      .catch((err) => {
        const container = document.getElementById("diagnostics-status");
        if (!container) return;
        container.className = "feedback error";
        container.textContent = err.message || "Unable to load diagnostics.";
      });
  }
  document
    .getElementById("role-select-doctor")
    ?.addEventListener("click", () => {
      if (!isLoggedIn()) {
        window.location.hash = "#signup?role=doctor";
        void renderSignup();
        return;
      }
      window.location.hash = "#doctors";
      renderDoctors();
    });
  document
    .getElementById("role-select-patient")
    ?.addEventListener("click", () => {
      if (!isLoggedIn()) {
        window.location.hash = "#signup?role=patient";
        void renderSignup();
        return;
      }
      window.location.hash = "#book";
      renderPatientBooking();
    });
}

export function createSkeletonRows(total = 3) {
  return Array.from({ length: total })
    .map(
      () => `
        <div class="skeleton-row">
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-90"></div>
        </div>
      `,
    )
    .join("");
}

export function showComposeMessageModal(onSubmit) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="card modal-card-with-close" style="max-width:520px;width:100%;padding:1rem;">
      <button type="button" class="modal-close-x" aria-label="Close">&times;</button>
      <h3>Compose message</h3>
      <form id="compose-message-form">
        <label>Message
          <textarea id="compose-message-text" rows="4" placeholder="Write your message..." required></textarea>
        </label>
        <div class="modal-form-actions">
          <button type="submit" class="btn btn-primary">Send</button>
          <button type="button" class="btn btn-secondary" id="compose-message-cancel">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  const closeModal = () => modal.remove();
  modal.querySelector(".modal-close-x")?.addEventListener("click", closeModal);
  modal
    .querySelector("#compose-message-cancel")
    ?.addEventListener("click", closeModal);
  modal
    .querySelector("#compose-message-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = String(
        modal.querySelector("#compose-message-text")?.value || "",
      ).trim();
      if (!text) return;
      await onSubmit(text);
      closeModal();
    });
}

export function messengerUi(rootEl) {
  if (!rootEl) return {};
  return {
    layout: rootEl.querySelector("[data-messenger-layout]"),
    list: rootEl.querySelector("[data-messenger-conversation-list]"),
    empty: rootEl.querySelector("[data-messenger-empty]"),
    active: rootEl.querySelector("[data-messenger-active]"),
    scroll: rootEl.querySelector("[data-messenger-scroll]"),
    typing: rootEl.querySelector("[data-messenger-typing]"),
    peerAvatar: rootEl.querySelector("[data-messenger-peer-avatar]"),
    peerName: rootEl.querySelector("[data-messenger-peer-name]"),
  };
}

export function wireMessengerShell(rootEl) {
  if (!rootEl || rootEl.dataset.messengerShellWired) return;
  rootEl.dataset.messengerShellWired = "1";
  rootEl
    .querySelector("[data-messenger-search]")
    ?.addEventListener("input", (e) => {
      dashboardState.conversationSearchFilter = String(e.target.value || "");
      /* Only refresh the inbox list — do not notify full dashboard (avoids re-running thread UI). */
      renderMessengerConversationList(rootEl);
    });

  const ensureEmojiMenu = () => {
    let menu = rootEl.querySelector(".emoji-menu");
    if (menu) return menu;
    menu = document.createElement("div");
    menu.className = "emoji-menu hidden";
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", "Emoji picker");
    menu.innerHTML = `
      <div class="emoji-menu-grid" role="listbox">
        ${[
        "😀",
        "😁",
        "😂",
        "🤣",
        "😊",
        "😍",
        "😘",
        "😎",
        "😅",
        "😉",
        "🙂",
        "🤔",
        "😴",
        "😷",
        "🤒",
        "🤕",
        "👍",
        "🙏",
        "👏",
        "💪",
        "🙌",
        "🤝",
        "✅",
        "❌",
        "❤️",
        "💛",
        "💙",
        "💚",
        "✨",
        "🔥",
        "🎉",
        "📎",
      ]
        .map(
          (e) =>
            `<button type="button" class="emoji-item" data-emoji="${e}" aria-label="${e}">${e}</button>`,
        )
        .join("")}
      </div>`;
    rootEl.appendChild(menu);
    return menu;
  };

  const hideEmojiMenu = () => {
    const m = rootEl.querySelector(".emoji-menu");
    if (m) m.classList.add("hidden");
  };

  rootEl.addEventListener("click", (ev) => {
    const emojiBtn = ev.target.closest?.(".message-compose-emoji");
    const emojiItem = ev.target.closest?.(".emoji-item");
    const menu = rootEl.querySelector(".emoji-menu");

    if (emojiBtn) {
      ev.preventDefault();
      const textarea = rootEl.querySelector("[data-messenger-reply-text]");
      const m = ensureEmojiMenu();
      const rect = emojiBtn.getBoundingClientRect();
      // Use viewport-fixed positioning so it works reliably on mobile.
      m.style.position = "fixed";
      m.style.zIndex = "10000";
      m.classList.remove("hidden");

      // Compute after it's visible so offsetHeight is accurate.
      requestAnimationFrame(() => {
        const menuW = m.offsetWidth || 320;
        const menuH = m.offsetHeight || 240;
        const margin = 10;
        const centerX = rect.left + rect.width / 2;
        let left = Math.round(centerX - menuW / 2);
        left = Math.max(
          margin,
          Math.min(left, window.innerWidth - margin - menuW),
        );

        // Prefer above the button; if not enough space, drop below.
        let top = Math.round(rect.top - menuH - 10);
        if (top < margin) top = Math.round(rect.bottom + 10);
        top = Math.max(
          margin,
          Math.min(top, window.innerHeight - margin - menuH),
        );

        m.style.left = `${left}px`;
        m.style.top = `${top}px`;
      });

      textarea?.focus();
      return;
    }

    if (emojiItem) {
      ev.preventDefault();
      ev.stopPropagation();
      const emoji = emojiItem.getAttribute("data-emoji") || "";
      const textarea = rootEl.querySelector("[data-messenger-reply-text]");
      if (textarea && emoji) {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        textarea.value = `${before}${emoji}${after}`;
        const next = start + emoji.length;
        textarea.setSelectionRange(next, next);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.focus();
      }
      hideEmojiMenu();
      return;
    }

    // Click outside closes.
    if (menu && !menu.classList.contains("hidden")) {
      const insideMenu = ev.target.closest?.(".emoji-menu");
      if (!insideMenu) hideEmojiMenu();
    }
  });

  document.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key === "Escape") hideEmojiMenu();
    },
    { passive: true },
  );

  const clearThread = () => {
    dashboardState.activeConversationId = "";
    dashboardState.messages = [];
    notifyDashboardSubscribers();
  };
  rootEl
    .querySelector("[data-messenger-clear]")
    ?.addEventListener("click", clearThread);

  rootEl
    .querySelector("[data-messenger-file-input]")
    ?.addEventListener("change", () => {
      syncMessengerAttachmentPreview(rootEl);
    });
}

export function buildThreadMessagesHtml(messages, currentUserId) {
  const threadMessages = Array.isArray(messages) ? messages : [];
  if (dashboardState.socketReconnecting && !dashboardState.websocketActive) {
    return `<div class="feedback">Connecting… messages reload when live sync returns.</div>`;
  }
  if (!threadMessages.length) {
    return `<div class="feedback">No messages yet.</div>`;
  }
  return threadMessages
    .map((msg) => {
      const sender = msg.senderId || {};
      const senderId = msg.senderId?._id || msg.senderId || null;
      const isYou = senderId
        ? String(senderId) === String(currentUserId)
        : false;
      const senderName = sender
        ? `${sender.firstName || ""} ${sender.lastName || ""}`.trim()
        : "Unknown";
      const displayName = isYou ? "You" : senderName;
      const senderRole = String(sender.role || "").toLowerCase();
      const roleClass =
        senderRole === "patient"
          ? "role-patient"
          : senderRole === "doctor" || senderRole === "receptionist"
            ? "role-staff"
            : "role-default";

      const attachmentMarkup = msg.attachmentUrl
        ? (() => {
          const type = String(msg.attachmentType || "").toLowerCase();
          const url = escapeHtml(msg.attachmentUrl);
          const name = escapeHtml(msg.attachmentName || "Open attachment");
          const rawUrl = String(msg.attachmentUrl || "");
          const isImage =
            type.startsWith("image/") ||
            /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(rawUrl);
          return isImage
            ? `<div class="thread-attachment-wrap"><a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="${name}" class="thread-attachment-image" /></a><p><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></p></div>`
            : `<p class="thread-attachment-file"><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></p>`;
        })()
        : "";
      const rowSide = isYou ? "outgoing" : "incoming";
      const bubbleClass = isYou
        ? "thread-bubble--outgoing"
        : "thread-bubble--incoming";
      return `
      <div class="thread-row thread-row--${rowSide}">
        <article class="thread-bubble ${bubbleClass}" data-sender-role="${escapeHtml(roleClass)}">
          <div class="thread-bubble-meta">
            <strong>${escapeHtml(displayName)}</strong>
            <small>${msg.createdAt ? escapeHtml(formatRelativeTime(msg.createdAt)) : ""}</small>
          </div>
          <p class="thread-message-body">${escapeHtml(msg.message || "")}</p>
          ${attachmentMarkup}
        </article>
      </div>`;
    })
    .join("");
}

async function renderPatientBooking() {
  if (!mainContent) return;
  setPageTone("");
  if (!isLoggedIn()) {
    mainContent.innerHTML = `
      <section class="patient-booking-page">
        <div class="patient-booking-hero card">
          <h1>Book a visit</h1>
          <p class="patient-booking-lead">Sign in to search for a doctor and request an appointment.</p>
          <div class="patient-booking-cta-row">
            <a href="#login" class="btn btn-primary">Sign in</a>
            <a href="#home" class="btn btn-secondary">Create an account from Home</a>
          </div>
        </div>
      </section>`;
    return;
  }

  if (getCurrentUserRole() !== "patient") {
    mainContent.innerHTML = `
      <section class="patient-booking-page">
        <div class="patient-booking-hero card">
          <h1>Book a visit</h1>
          <p class="patient-booking-lead">This guided booking flow is for patient accounts.</p>
          <p class="feedback">Staff can manage doctors and appointments from the sidebar.</p>
          <a href="#appointments" class="btn btn-secondary">Go to Appointments</a>
        </div>
      </section>`;
    return;
  }

  mainContent.innerHTML = `
    <section class="patient-booking-page">
      <header class="patient-booking-hero card">
        <h1>Find your doctor</h1>
        <p class="patient-booking-lead">Search by name, specialty, department, or clinic. When you are ready, pick a time and send a booking request.</p>
        <div id="patient-profile-banner"></div>
      </header>
      <div class="patient-book-toolbar card">
        <label class="patient-search-label" for="patient-doctor-search">Search doctors</label>
        <input type="search" id="patient-doctor-search" class="patient-book-search" placeholder="Try cardiology, Dr. Lee, telemedicine, clinic name…" autocomplete="off" />
        <p class="patient-book-count" id="patient-doctor-count" aria-live="polite"></p>
      </div>
      <div id="patient-doctor-grid" class="patient-doctor-grid"></div>
      <div id="patient-booking-drawer" class="patient-booking-drawer hidden" role="dialog" aria-modal="true" aria-labelledby="patient-booking-doctor-title">
        <div class="patient-booking-drawer-backdrop" id="patient-booking-backdrop"></div>
        <div class="patient-booking-drawer-inner card">
          <div class="patient-booking-drawer-head">
            <h2 id="patient-booking-doctor-title">Book appointment</h2>
            <button type="button" class="btn btn-secondary btn-sm" id="patient-booking-close">Close</button>
          </div>
          <form id="patient-booking-form">
            <input type="hidden" name="doctorId" id="patient-booking-doctor-id" value="" />
            <label>Preferred date <input name="date" type="date" required /></label>
            <label>Preferred time <input name="time" type="time" required /></label>
            <div id="patient-booking-smart-hint" class="feedback booking-hint" style="display:none"></div>
            <div id="patient-booking-smart-times" class="booking-time-grid-wrap"></div>
            <label>Reason or notes (optional) <textarea name="notes" rows="3" placeholder="Briefly describe what you need"></textarea></label>
            <div class="patient-booking-actions">
              <button type="submit" class="btn btn-primary">Request appointment</button>
              <button type="button" class="btn btn-secondary" id="patient-booking-cancel">Cancel</button>
            </div>
          </form>
          <div id="patient-booking-feedback" class="feedback" style="display:none;margin-top:1rem;"></div>
        </div>
      </div>
    </section>`;

  const profileBanner = document.getElementById("patient-profile-banner");
  const myPatient = await fetchMyPatientRecord();
  if (profileBanner) {
    if (!myPatient) {
      profileBanner.innerHTML = `
        <div class="feedback patient-profile-missing">
          Add your patient details once so we can book visits for you.
          <a href="#patients" class="btn btn-primary btn-sm">Complete my profile</a>
        </div>`;
    } else {
      profileBanner.innerHTML = `<p class="patient-profile-ok"><strong>Profile on file:</strong> ${escapeHtml(formatPatientDisplayName(myPatient))}</p>`;
    }
  }

  const grid = document.getElementById("patient-doctor-grid");
  const searchInput = document.getElementById("patient-doctor-search");
  const countEl = document.getElementById("patient-doctor-count");
  const drawer = document.getElementById("patient-booking-drawer");
  const feedbackEl = document.getElementById("patient-booking-feedback");
  const bookingForm = document.getElementById("patient-booking-form");
  const smartHintEl = document.getElementById("patient-booking-smart-hint");
  const smartTimesEl = document.getElementById("patient-booking-smart-times");

  if (grid) grid.innerHTML = '<div class="feedback">Loading doctors…</div>';
  let doctors = [];
  try {
    const res = await apiRequest(`${API_BASE}/doctors`);
    if (!res.ok) throw new Error("Could not load doctors.");
    doctors = await res.json();
    if (!Array.isArray(doctors)) doctors = [];
  } catch (e) {
    if (grid) grid.innerHTML = `<div class="feedback error">${e.message || "Failed to load doctors."}</div>`;
    return;
  }

  function renderDoctorCards(list) {
    if (countEl) {
      countEl.textContent = list.length
        ? `${list.length} doctor${list.length === 1 ? "" : "s"} match your search`
        : "No doctors match your search.";
    }
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML =
        '<div class="feedback">Try another name, specialty, or keyword—or clear the search to see everyone.</div>';
      return;
    }
    const grouped = list.reduce((acc, doctor) => {
      const specialtyKey =
        String(doctor.specialty || "General").trim() || "General";
      if (!acc[specialtyKey]) acc[specialtyKey] = [];
      acc[specialtyKey].push(doctor);
      return acc;
    }, {});
    grid.innerHTML = Object.entries(grouped)
      .filter(([, items]) => Array.isArray(items) && items.length)
      .map(
        ([specialtyKey, items]) => `
        <section class="doctor-specialty-group">
          <h3 class="doctor-specialty-heading">${escapeHtml(specialtyKey)}</h3>
          <div class="patient-doctor-grid">
            ${items
            .map((d) => {
              const name = formatDoctorDisplayName(d);
              const spec = d.specialty || "Specialty not listed";
              const subSpec = String(
                d.subSpecialization || d.subSpecialty || "",
              ).trim();
              const subSpecBadge = subSpec
                ? `<span class="pill-tag" style="margin-left:0;">${escapeHtml(subSpec)}</span>`
                : "";
              const dept = d.department
                ? `<p class="doctor-pick-meta">${d.department}</p>`
                : "";
              const clinic = d.affiliatedClinics
                ? `<p class="doctor-pick-clinic">${d.affiliatedClinics}</p>`
                : "";
              const receptionistName = d.receptionistName
                ? `<p class="doctor-pick-reception">Receptionist: ${d.receptionistName}</p>`
                : "";
              const receptionistPhone = d.receptionistPhone
                ? `<p class="doctor-pick-reception">Contact: ${d.receptionistPhone}</p>`
                : "";
              const receptionistEmail = d.receptionistEmail
                ? `<p class="doctor-pick-reception">Email: ${d.receptionistEmail}</p>`
                : "";
              const avail = buildDoctorAvailabilityLabel(d);
              return `
          <article class="doctor-pick-card">
            <h3 class="doctor-pick-name">${name}</h3>
            <p class="doctor-pick-specialty">${spec}</p>
            ${subSpecBadge}
            ${dept}
            ${clinic}
            ${receptionistName}
            ${receptionistPhone}
            ${receptionistEmail}
            <p class="doctor-pick-avail">${avail}</p>
            <button type="button" class="btn btn-primary btn-sm doctor-pick-book" data-book-doctor="${d._id}">Book with this doctor</button>
          </article>`;
            })
            .join("")}
          </div>
        </section>`,
      )
      .join("");
  }

  function applyFilter() {
    if (!searchInput) return;
    const q = searchInput.value;
    const filtered = doctors.filter((d) => doctorMatchesPatientSearch(d, q));
    renderDoctorCards(filtered);
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
  }
  applyFilter();

  function openDrawer(doctorId) {
    if (!myPatient) {
      window.location.hash = "#patients";
      return;
    }
    const d = doctors.find((x) => String(x._id) === String(doctorId));
    const displayName = formatDoctorDisplayName(d) || "your doctor";
    const drawerTitle = document.getElementById("patient-booking-doctor-title");
    if (drawerTitle) {
      drawerTitle.textContent = `Book with ${displayName}`;
    }
    if (feedbackEl) {
      feedbackEl.style.display = "none";
      feedbackEl.textContent = "";
    }
    if (bookingForm) {
      bookingForm.reset();
      const docIdInput = document.getElementById("patient-booking-doctor-id");
      if (docIdInput) docIdInput.value = doctorId;
    }
    if (drawer) drawer.classList.remove("hidden");
    void renderPatientBookingHint();
  }

  function closeDrawer() {
    if (drawer) drawer.classList.add("hidden");
  }

  if (grid) {
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-book-doctor]");
      if (!btn) return;
      openDrawer(btn.getAttribute("data-book-doctor"));
    });
  }

  const closeBtn = document.getElementById("patient-booking-close");
  if (closeBtn) closeBtn.onclick = closeDrawer;
  const cancelBtn = document.getElementById("patient-booking-cancel");
  if (cancelBtn) cancelBtn.onclick = closeDrawer;

  const renderPatientBookingHint = async () => {
    const doctorId = String(
      document.getElementById("patient-booking-doctor-id")?.value || "",
    ).trim();
    const date = String(bookingForm?.date?.value || "").trim();
    if (!doctorId || !date) {
      if (smartHintEl) smartHintEl.style.display = "none";
      if (smartTimesEl) smartTimesEl.innerHTML = "";
      return;
    }
    try {
      const url = new URL(
        `${API_BASE}/appointments/booking-hints`,
        window.location.origin,
      );
      url.searchParams.set("doctorId", doctorId);
      url.searchParams.set("date", date);
      const res = await apiRequest(url.toString());
      if (!res.ok) {
        if (smartHintEl) {
          smartHintEl.style.display = "block";
          smartHintEl.className = "feedback error booking-hint";
          smartHintEl.textContent = await getApiErrorMessage(
            res,
            "Unable to load booking hints.",
          );
        }
        if (smartTimesEl) smartTimesEl.innerHTML = "";
        return;
      }
      const info = await res.json();
      if (smartHintEl) {
        smartHintEl.style.display = "block";
        smartHintEl.className =
          Number(info.remainingSlots) > 0
            ? "feedback booking-hint"
            : "feedback error booking-hint";
        smartHintEl.textContent = String(info.hint || "");
      }
      if (smartTimesEl) {
        smartTimesEl.innerHTML = buildBookingTimeGridHtml({
          suggestedAvailableTimes: info.suggestedAvailableTimes,
          conflictingTimes: info.conflictingTimes,
          selectedTime: bookingForm?.time?.value || "",
        });
      }
      smartTimesEl?.querySelectorAll("[data-smart-time]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const next = normalizeTimeText(btn.getAttribute("data-smart-time"));
          if (!next || !bookingForm || !bookingForm.time) return;
          bookingForm.time.value = next;
          void renderPatientBookingHint();
        });
      });
    } catch (error) {
      if (smartHintEl) {
        smartHintEl.style.display = "block";
        smartHintEl.className = "feedback error booking-hint";
        smartHintEl.textContent = "Unable to load booking hints.";
      }
      if (smartTimesEl) smartTimesEl.innerHTML = "";
    }
  };
  if (bookingForm) {
    bookingForm.date?.addEventListener("change", renderPatientBookingHint);
    bookingForm.time?.addEventListener("change", renderPatientBookingHint);

    bookingForm.onsubmit = async (e) => {
      e.preventDefault();
      if (!myPatient) {
        window.location.hash = "#patients";
        return;
      }
      const docIdInput = document.getElementById("patient-booking-doctor-id");
      const doctorId = docIdInput ? docIdInput.value : "";
      const fd = new FormData(bookingForm);
      const date = fd.get("date");
      const time = fd.get("time");
      const notes = String(fd.get("notes") || "").trim();
      if (feedbackEl) feedbackEl.style.display = "none";
      try {
        const res = await apiRequest(`${API_BASE}/appointments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctor: doctorId,
            date,
            time,
            notes,
            status: "pending",
          }),
        });
        if (!res.ok) {
          throw new Error(await getApiErrorMessage(res, "Booking failed"));
        }
        if (feedbackEl) {
          feedbackEl.className = "feedback success";
          feedbackEl.style.display = "block";
          feedbackEl.textContent =
            "Request sent. You will see it under Appointments—we will follow up soon.";
        }
        setTimeout(() => {
          closeDrawer();
          window.location.hash = "#appointments";
          renderAppointments();
        }, 1400);
      } catch (err) {
        if (feedbackEl) {
          feedbackEl.className = "feedback error";
          feedbackEl.style.display = "block";
          feedbackEl.textContent = err.message || "Something went wrong.";
        }
      }
    };
  }
}

// --- Patients ---
let cachedFacilities = null;
let cachedHmoProviders = null;

async function loadFacilities() {
  if (cachedFacilities) return cachedFacilities;

  const res = await apiRequest(`${API_BASE}/patients/constants/facilities`);
  if (!res.ok) throw new Error("Failed to load facilities");

  const data = await res.json();
  cachedFacilities = data.facilities || [];

  return cachedFacilities;
}

async function loadHmoProviders() {
  if (cachedHmoProviders) return cachedHmoProviders;
  const res = await apiRequest(`${API_BASE}/patients/constants/hmo-providers`);
  if (!res.ok) throw new Error("Failed to load HMO providers");
  const data = await res.json();
  cachedHmoProviders = Array.isArray(data.providers) ? data.providers : [];
  return cachedHmoProviders;
}

function parseAffiliatedClinics(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function setupTaggedFacilityMultiSelect({
  inputSelector,
  hiddenInputSelector,
  tagsContainerSelector,
  options,
  initialValues = [],
  root = document,
}) {
  const input = root.querySelector(inputSelector);
  const hiddenInput = root.querySelector(hiddenInputSelector);
  const tagsContainer = root.querySelector(tagsContainerSelector);
  if (!input || !hiddenInput || !tagsContainer) return;

  const selected = [];
  const selectedSet = new Set();

  const render = () => {
    hiddenInput.value = selected.join(", ");
    tagsContainer.innerHTML = selected
      .map(
        (name) =>
          `<button type="button" class="facility-tag-btn" data-facility-remove="${escapeHtml(name)}">${escapeHtml(name)} <span aria-hidden="true">&times;</span></button>`,
      )
      .join("");
    tagsContainer.querySelectorAll("[data-facility-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = String(btn.getAttribute("data-facility-remove") || "");
        if (!selectedSet.has(name)) return;
        selectedSet.delete(name);
        const idx = selected.indexOf(name);
        if (idx >= 0) selected.splice(idx, 1);
        render();
      });
    });
  };

  const addClinic = (raw) => {
    const value = String(raw || "").trim();
    if (!value) return;
    if (selectedSet.has(value)) return;
    selectedSet.add(value);
    selected.push(value);
    render();
  };

  initialValues.forEach(addClinic);
  render();

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addClinic(input.value);
      input.value = "";
    } else if (event.key === "Backspace" && !input.value.trim() && selected.length) {
      const last = selected.pop();
      if (last) selectedSet.delete(last);
      render();
    }
  });

  input.addEventListener("blur", () => {
    if (input.value.trim()) {
      addClinic(input.value);
      input.value = "";
    }
  });

  attachFacilityInputBehavior(inputSelector);
  if (Array.isArray(options) && options.length) {
    input.setAttribute("list", "facility-list");
  }
}

async function renderFacilityDatalist(listId = "facility-list") {
  const facilities = await loadFacilities();

  const datalist = document.getElementById(listId);
  if (!datalist) return;

  datalist.innerHTML = facilities
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
}

function attachFacilityInputBehavior(selector) {
  document.querySelectorAll(selector).forEach((input) => {
    input.addEventListener("focus", () => {
      const val = input.value;
      input.value = " ";
      input.value = val;
    });
  });
}

// --- renderAppointments, renderCalendar: now in ./modules/appointments.js ---
// --- renderUsers, showUserForm, editUser, deleteUser: now in ./modules/users.js ---
// --- window.closePatientForm: now in ./modules/patients.js ---
// --- window.closeDoctorForm: now in ./modules/doctors.js ---
