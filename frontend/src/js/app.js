// SPA navigation and dynamic content rendering
const mainContent = document.getElementById("main-content");
const navLinks = document.querySelectorAll(".nav-link");
const sidebar = document.getElementById("app-sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarUserTrigger = document.getElementById("sidebar-user-trigger");
const sidebarUserPopover = document.getElementById("sidebar-user-popover");
const sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");
const sidebarUserMenu = document.querySelector(".sidebar-user-menu");
const sidebarAvatarCircle = document.querySelector(".sidebar-avatar-circle");
const sidebarAvatarName = document.querySelector(".sidebar-avatar-name");
const sidebarAccountMeta = document.getElementById("sidebar-account-meta");
const commandPalette = document.getElementById("command-palette");
const commandInput = document.getElementById("command-input");
const commandResults = document.getElementById("command-results");
const commandPaletteTrigger = document.getElementById("command-palette-trigger");
const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const API_ORIGIN = isLocalHost
  ? "http://localhost:3001"
  : "https://drmeet-api.onrender.com";
const API_BASE = `${API_ORIGIN}/api`;
const DASHBOARD_STATE_KEY = "drmeet-dashboard-state";
const USER_CACHE_KEY = "drmeet-user-cache";
const THEME_KEY = "drmeet-theme";
const MESSAGES_API = `${API_BASE}/messages`;
const dashboardSubscribers = [];
const dashboardState = {
  conversations: [],
  activeConversationId: "",
  messages: [],
  websocketActive: false,
  socketReconnecting: false,
  socketAwaitingFirstConnect: true,
};

let socket = null;
let socketInitialized = false;
const googleAuthState = {
  popup: null,
  timeoutId: null,
  pollId: null,
  feedbackEl: null,
  buttonEl: null,
  inProgress: false,
};
let sidebarClockIntervalId = null;
const DOCTOR_SPECIALTIES = [
  "Family Medicine","Fam Med","General Practice","GP","Internal Medicine","IM","Internist","Pediatrics","Pedia","Emergency Medicine","ER","Geriatric Medicine","Geriatrics",
  "Cardiology","Cardio","Endocrinology, Diabetes & Metabolism","Endocrinology","Gastroenterology","GI","Hepatology","Liver Specialist","Infectious Diseases","ID",
  "Nephrology","Kidney Specialist","Pulmonology","Pulmo","Rheumatology","Rheuma","Allergy & Immunology","Allergist","Hematology","Hema","Medical Oncology","Onco","Clinical Pharmacology",
  "General Surgery","GS","Colorectal Surgery","Hepatobiliary & Pancreatic Surgery","HPB Surgery","Breast Surgery","Minimally Invasive / Laparoscopic Surgery","MIS",
  "Orthopedic Surgery","Ortho","Neurosurgery","Neuro Surgery","Cardiothoracic Surgery","CTS","Vascular Surgery","Plastic & Reconstructive Surgery","Plastic Surgery","Hand Surgery","Urology","Uro",
  "Obstetrics and Gynecology","OB-GYN","OB","Maternal-Fetal Medicine","High-Risk Pregnancy","Reproductive Endocrinology & Infertility","Fertility Specialist","Gynecologic Oncology","Gyne Onco","Urogynecology",
  "Neonatology","NICU","Pediatric Cardiology","Pediatric Pulmonology","Pediatric Nephrology","Pediatric Gastroenterology","Pediatric Endocrinology","Pediatric Hematology-Oncology","Pedia Onco","Pediatric Infectious Diseases","Pediatric Neurology","Developmental & Behavioral Pediatrics","Dev Peds",
  "Neurology","Neuro","Psychiatry","Psych","Child & Adolescent Psychiatry","Addiction Medicine","Ophthalmology","Eye Specialist","Otolaryngology – Head and Neck Surgery","ENT",
  "Dermatology","Derma","Cosmetic Dermatology / Aesthetic Medicine","Aesthetic","Radiology","Diagnostic Radiology","Interventional Radiology","IR","Pathology","Lab Medicine","Nuclear Medicine","Anesthesiology","Anesthesia",
  "Physical Medicine & Rehabilitation","Physiatry","Rehab Med","Pain Medicine","Pain Management","Palliative Medicine","Hospice Care","Occupational Medicine","Occ Med","Sports Medicine","Lifestyle Medicine","Preventive Medicine",
  "Physical Therapy","PT","Occupational Therapy","OT","Speech-Language Pathology","Speech Therapy","Clinical Psychology","Nutrition & Dietetics","Dietitian","Respiratory Therapy","RT"
];

function normalizeFetchErrorMessage(err, fallbackMessage) {
  const message = String(err?.message || "");
  if (message.toLowerCase().includes("failed to fetch") || err instanceof TypeError) {
    return "Unable to reach the server right now. Please check your connection and try again.";
  }
  return message || fallbackMessage;
}

function clearGoogleAuthLoading(message, isError = false) {
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
    googleAuthState.feedbackEl.className = isError ? "feedback error" : "feedback";
  }
}

function consumeOauthErrorFromHash() {
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
    session_error: "Google login failed while creating your session. Please try again.",
    callback_timeout: "Google login timed out. Please try again.",
  };
  return messages[code] || "Google login failed. Please try again.";
}

function consumeOauthSuccessTokenFromHash() {
  const hash = window.location.hash || "";
  const tokenMatch = hash.match(/(?:^|[?&])token=([^&]+)/i);
  if (!tokenMatch) return null;
  const token = decodeURIComponent(tokenMatch[1] || "");
  if (!token) return null;
  const route = hash.startsWith("#signup?") ? "#signup" : "#login";
  window.history.replaceState(null, "", route);
  return token;
}

function getHashRoute() {
  const hash = window.location.hash || "#home";
  return hash.split("?")[0] || "#home";
}

function getSignupRoleFromHash() {
  const hash = window.location.hash || "";
  const match = hash.match(/role=(doctor|patient|receptionist)/i);
  return match ? String(match[1]).toLowerCase() : "";
}

function resetMessagingSocket() {
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch (e) {
      /* ignore */
    }
    socket = null;
  }
  socketInitialized = false;
  dashboardState.websocketActive = false;
  dashboardState.socketReconnecting = false;
  dashboardState.socketAwaitingFirstConnect = true;
}

function buildHeaders(baseHeaders = {}) {
  const token = localStorage.getItem("token");
  return token
    ? { ...baseHeaders, Authorization: `Bearer ${token}` }
    : { ...baseHeaders };
}

async function apiRequest(url, options = {}) {
  const headers = buildHeaders(options.headers || {});
  return fetch(url, { ...options, headers, credentials: "include" });
}

async function getApiErrorMessage(res, fallbackMessage) {
  try {
    const payload = await res.json();
    if (payload?.error) return payload.error;
    if (Array.isArray(payload?.missingFields) && payload.missingFields.length) {
      return `Missing required fields: ${payload.missingFields.join(", ")}`;
    }
    if (Array.isArray(payload?.errors) && payload.errors.length) {
      return payload.errors.map((item) => item.msg || item.message).filter(Boolean).join(", ");
    }
    if (Array.isArray(payload?.details) && payload.details.length) {
      return payload.details.join(", ");
    }
  } catch (error) {
    // Ignore JSON parse errors and use fallback text.
  }
  return fallbackMessage;
}

function formatDateForInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDateDisplay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date)) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildDoctorAvailabilityLabel(doctor) {
  const slots = Array.isArray(doctor.availability) ? doctor.availability : [];
  if (doctor.availabilityText) return doctor.availabilityText;
  if (!slots.length) return "Availability not set";
  return slots
    .map((slot) =>
      slot.timeRange
        ? `${slot.day || "Day"} ${slot.timeRange}`
        : `${slot.day || "Day"} ${slot.startTime || "--:--"}-${slot.endTime || "--:--"}`
    )
    .join(" | ");
}

function setActiveNav(hash) {
  navLinks.forEach((link) => {
    if (link.getAttribute("href") === hash) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

window.addEventListener("hashchange", renderPage);
window.addEventListener("DOMContentLoaded", () => {
  bootstrapTheme();
  loadDashboardState();
  setupShellInteractions();
  setupCommandPalette();
  checkAuthStatus();
  updateAuthNav();
  renderPage();
  window.addEventListener('message', handleGoogleAuthMessage);
});

function setupShellInteractions() {
  if (!sidebarToggle || !sidebar) return;
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
  sidebarUserTrigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    sidebarUserPopover?.classList.toggle("hidden");
  });
  document.addEventListener("click", (event) => {
    if (!sidebarUserPopover || !sidebarUserTrigger) return;
    if (
      !sidebarUserPopover.classList.contains("hidden") &&
      !sidebarUserPopover.contains(event.target) &&
      !sidebarUserTrigger.contains(event.target)
    ) {
      sidebarUserPopover.classList.add("hidden");
    }
  });
  sidebarLogoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem(USER_CACHE_KEY);
    resetMessagingSocket();
    updateAuthNav();
    if (sidebarUserPopover) sidebarUserPopover.classList.add("hidden");
    window.location.hash = "#login";
    renderLogin();
  });
}

function setupCommandPalette() {
  if (!commandPalette || !commandInput || !commandResults) return;
  commandPaletteTrigger?.addEventListener("click", openCommandPalette);
  document.addEventListener("keydown", (event) => {
    const pressedK = event.key.toLowerCase() === "k";
    if ((event.ctrlKey || event.metaKey) && pressedK) {
      event.preventDefault();
      openCommandPalette();
    }
    if (event.key === "Escape" && !commandPalette.classList.contains("hidden")) {
      closeCommandPalette();
    }
  });
  commandInput.addEventListener("input", renderCommandResults);
  commandPalette.addEventListener("click", () => {});
}

function getSearchableCommands() {
  if (!isLoggedIn()) {
    return [
      { id: "home", label: "Go to Home", action: () => navigateTo("#home") },
      { id: "book", label: "Book a visit (patients)", action: () => navigateTo("#book") },
    ];
  }
  const staticCommands = [
    { id: "home", label: "Go to Home", action: () => navigateTo("#home") },
    { id: "book", label: "Book a visit (patients)", action: () => navigateTo("#book") },
    { id: "patients", label: "Go to Patients", action: () => navigateTo("#patients") },
    { id: "doctors", label: "Go to Doctors", action: () => navigateTo("#doctors") },
    { id: "appointments", label: "Go to Appointments", action: () => navigateTo("#appointments") },
    { id: "users", label: "Go to Users", action: () => navigateTo("#users") },
  ];
  return staticCommands;
}

function openCommandPalette() {
  commandPalette.classList.remove("hidden");
  commandInput.value = "";
  renderCommandResults();
  commandInput.focus();
}

function closeCommandPalette() {
  commandPalette.classList.add("hidden");
}

function renderCommandResults() {
  const query = commandInput.value.trim().toLowerCase();
  const matches = getSearchableCommands().filter((item) =>
    item.label.toLowerCase().includes(query)
  );
  commandResults.innerHTML = matches
    .map(
      (item) => `<li><button type="button" data-command-id="${item.id}" class="command-item">${item.label}</button></li>`
    )
    .join("") || '<li class="empty">No matches found.</li>';
  commandResults.querySelectorAll("[data-command-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = matches.find((entry) => entry.id === button.dataset.commandId);
      if (!command) return;
      command.action();
      closeCommandPalette();
    });
  });
}

function navigateTo(hash) {
  window.location.hash = hash;
  renderPage();
}

function renderTopbarBreadcrumbs() {
  const container = document.getElementById("topbar-nav-tools");
  if (!container) return;
  const route = getHashRoute();
  const pages = [
    { hash: "#home", label: "Home" },
    { hash: "#book", label: "Book" },
    { hash: "#patients", label: "Patients" },
    { hash: "#doctors", label: "Doctors" },
    { hash: "#appointments", label: "Appointments" },
    { hash: "#users", label: "Users" },
  ];
  const crumbs = pages
    .map((page) => {
      const isActive = page.hash === route;
      return isActive
        ? `<span>${page.label}</span>`
        : `<a href="${page.hash}">${page.label}</a>`;
    })
    .join(" / ");
  container.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm icon-btn" id="topbar-back-btn" aria-label="Back"><img src="images/arrow-left-s-line.svg" alt="" /> Back</button>
    <nav class="breadcrumbs">${crumbs}</nav>
    <button type="button" class="btn btn-secondary btn-sm icon-btn" id="theme-toggle-btn" aria-label="Toggle theme"></button>
  `;
  container.querySelector("#topbar-back-btn")?.addEventListener("click", () => {
    window.history.back();
  });
  const themeBtn = container.querySelector("#theme-toggle-btn");
  const isDark = document.body.classList.contains("theme-dark");
  if (themeBtn) {
    themeBtn.innerHTML = `<img src="images/${isDark ? "contrast-2-fill.svg" : "contrast-2-line.svg"}" alt="" /> ${isDark ? "Dark" : "Light"}`;
    themeBtn.addEventListener("click", () => {
      applyTheme(isDark ? "light" : "dark");
      renderTopbarBreadcrumbs();
    });
  }
}

function loadDashboardState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DASHBOARD_STATE_KEY) || "{}");
    if (Array.isArray(parsed.conversations)) dashboardState.conversations = parsed.conversations;
    if (typeof parsed.activeConversationId === "string") dashboardState.activeConversationId = parsed.activeConversationId;
    if (Array.isArray(parsed.messages)) dashboardState.messages = parsed.messages;
  } catch (error) {
    console.warn("Unable to load dashboard state", error);
  }
}

function persistDashboardState() {
  const snapshot = {
    conversations: dashboardState.conversations,
    activeConversationId: dashboardState.activeConversationId,
    messages: dashboardState.messages,
  };
  localStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify(snapshot));
}

function subscribeDashboard(listener) {
  dashboardSubscribers.push(listener);
}

function notifyDashboardSubscribers() {
  dashboardSubscribers.forEach((listener) => listener(dashboardState));
}

function parseIsoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeTime(isoValue) {
  const date = parseIsoDate(isoValue);
  if (!date) return "just now";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes <= 0) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function sortMessagesByRecent(messages) {
  return [...messages].sort((a, b) => {
    const left = parseIsoDate(a.createdAt)?.getTime() || 0;
    const right = parseIsoDate(b.createdAt)?.getTime() || 0;
    return right - left;
  });
}

function decodeJwtPayload(token) {
  // Basic JWT payload decoder (no signature verification on client).
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

function getCurrentUserId() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return payload?._id || payload?.id || null;
}

function getCurrentUserRole() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  return role != null ? String(role).toLowerCase() : null;
}

function getCurrentLinkedDoctorId() {
  const token = localStorage.getItem("token");
  if (!token) return "";
  const payload = decodeJwtPayload(token);
  return String(payload?.linkedDoctorId || "");
}

function getCurrentUserName() {
  const token = localStorage.getItem("token");
  if (!token) return "";
  const payload = decodeJwtPayload(token);
  const first = String(payload?.firstName || "").trim();
  const last = String(payload?.lastName || "").trim();
  return `${first} ${last}`.trim();
}

function cacheCurrentUserProfile() {
  const token = localStorage.getItem("token");
  if (!token) return;
  const payload = decodeJwtPayload(token);
  if (!payload) return;
  localStorage.setItem(
    USER_CACHE_KEY,
    JSON.stringify({
      _id: payload?._id || payload?.id || "",
      firstName: payload?.firstName || "",
      lastName: payload?.lastName || "",
      role: payload?.role || "",
      linkedDoctorId: payload?.linkedDoctorId || "",
      cachedAt: Date.now(),
    }),
  );
}

function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("theme-dark", resolved === "dark");
  localStorage.setItem(THEME_KEY, resolved);
}

function bootstrapTheme() {
  const stored = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(stored);
}

function getSidebarRoleLabel(role) {
  switch (String(role || "").toLowerCase()) {
    case "patient":
      return "I'm a patient!";
    case "doctor":
      return "I'm a doctor";
    case "receptionist":
      return "I'm a receptionist";
    case "admin":
      return "I'm an admin!";
    default:
      return "My Account";
  }
}

function updateSidebarAccountInfo() {
  const signedIn = isLoggedIn();
  const role = getCurrentUserRole();
  const fullName = getCurrentUserName();
  const now = new Date();
  const dateText = now.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeText = now.toLocaleTimeString("en-PH");
  const roleLabel = getSidebarRoleLabel(role);
  const initial = (fullName || role || "U").charAt(0).toUpperCase();
  if (sidebarAvatarCircle) sidebarAvatarCircle.textContent = signedIn ? initial : "U";
  if (sidebarAvatarName) sidebarAvatarName.textContent = signedIn ? roleLabel : "My Account";
  if (sidebarAccountMeta) {
    sidebarAccountMeta.innerHTML = signedIn
      ? `<strong>${fullName || "User"}</strong><br>${dateText}<br>${timeText}`
      : "Not signed in";
  }
}

async function resolveDoctorIdForPatientMessaging() {
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
        const profile = doctors.find((d) => String(d._id) === String(row.doctor));
        if (profile?.userId) return String(profile.userId);
      }
    }
  }
  if (doctors[0]?.userId) return String(doctors[0].userId);
  return null;
}

async function fetchMyPatientRecord() {
  const res = await apiRequest(`${API_BASE}/patients`);
  if (!res.ok) return null;
  const list = await res.json();
  return Array.isArray(list) && list.length ? list[0] : null;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, type = "success") {
  const hostId = "global-toast-host";
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = hostId;
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const toast = document.createElement("div");
  toast.className = `toast-item ${type === "error" ? "error" : "success"}`;
  toast.textContent = String(message || "");
  host.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 280);
  }, 2800);
}

function showDangerConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="card danger-modal">
        <h3>Confirm Delete</h3>
        <p>${escapeHtml(message || "This action is irreversible.")}</p>
        <p class="danger-hint">This action is irreversible.</p>
        <div class="modal-form-actions">
          <button type="button" class="btn btn-action-delete" id="danger-confirm-ok">Delete</button>
          <button type="button" class="btn btn-secondary" id="danger-confirm-cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = (value) => {
      modal.remove();
      resolve(value);
    };
    modal.querySelector("#danger-confirm-ok")?.addEventListener("click", () => close(true));
    modal.querySelector("#danger-confirm-cancel")?.addEventListener("click", () => close(false));
  });
}

function enforcePhoneInputs(scope = document) {
  const inputs = scope.querySelectorAll('input[name="phone"], input[name="receptionistPhone"]');
  inputs.forEach((input) => {
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("maxlength", "11");
    input.setAttribute("pattern", "[0-9]{10,11}");
    input.addEventListener("input", () => {
      const cleaned = String(input.value || "").replace(/\D+/g, "").slice(0, 11);
      input.value = cleaned;
    });
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

async function sendDocumentMessage({ conversationId = "", patientId = "", doctorId = "", text = "", file }) {
  const fileData = await fileToDataUrl(file);
  return sendMessage(text, {
    conversationId,
    patientId,
    doctorId,
    fileData,
    attachmentName: file?.name || "",
    attachmentType: file?.type || "",
  });
}

function doctorMatchesPatientSearch(doctor, q) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return true;
  const blob = [
    doctor.firstName,
    doctor.lastName,
    doctor.title,
    doctor.specialty,
    doctor.department,
    doctor.affiliatedClinics,
    doctor.bio,
    doctor.email,
    doctor.room,
    buildDoctorAvailabilityLabel(doctor),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return blob.includes(needle);
}

function formatDoctorDisplayName(d) {
  if (!d) return "";
  const t = d.title ? `${d.title} ` : "";
  return `${t}${d.firstName || ""} ${d.lastName || ""}`.trim();
}

async function loadConversations() {
  try {
    const res = await apiRequest(`${MESSAGES_API}/conversations`);
    if (!res.ok) throw new Error("Failed to load conversations");
    const data = await res.json();
    dashboardState.conversations = Array.isArray(data?.conversations) ? data.conversations : [];

    // Default: load first conversation.
    if (!dashboardState.activeConversationId && dashboardState.conversations.length) {
      dashboardState.activeConversationId = String(dashboardState.conversations[0]._id);
      await loadMessages(dashboardState.activeConversationId);
    }

    persistDashboardState();
    notifyDashboardSubscribers();
  } catch (error) {
    notifyDashboardSubscribers();
  }
}

async function loadMessages(conversationId) {
  try {
    if (!conversationId) {
      dashboardState.messages = [];
      return;
    }
    const res = await apiRequest(
      `${MESSAGES_API}/conversations/${conversationId}/messages`,
    );
    if (!res.ok) throw new Error("Failed to load messages");
    const data = await res.json();
    dashboardState.messages = Array.isArray(data?.messages) ? data.messages : [];

    // Mark as read for the current user.
    await apiRequest(`${MESSAGES_API}/conversations/${conversationId}/read`, {
      method: "POST",
    });
  } catch (error) {
    dashboardState.messages = [];
  } finally {
    persistDashboardState();
    notifyDashboardSubscribers();
  }
}

async function createOrGetConversation(patientId, doctorId) {
  const res = await apiRequest(
    `${MESSAGES_API}/conversations/ensure/patient-doctor`,
    {
      method: "POST",
      headers: buildHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        patientId,
        doctorId,
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("CREATE CONV ERROR:", errorText);
    throw new Error(errorText || "Failed to create conversation");
  }

  const data = await res.json();
  return data.conversationId; // ⚠️ backend returns conversationId, not conversation object
}

async function sendMessage(text, options = {}) {
  let conversationId = options.conversationId || dashboardState.activeConversationId;

  const userId = getCurrentUserId();
  const role = getCurrentUserRole();

  if (!userId) {
    throw new Error("You must be logged in to send a message.");
  }

  if (!conversationId) {
    if (role !== "patient" && !(options.patientId && options.doctorId)) {
      throw new Error("Select a conversation before sending a message.");
    }
    const doctorId = options.doctorId || await resolveDoctorIdForPatientMessaging();
    const patientId = options.patientId || userId;
    if (!doctorId) {
      throw new Error("No assigned doctor found. Book an appointment first so messaging can be enabled.");
    }
    const createdConversationId = await createOrGetConversation(patientId, doctorId);

    conversationId = createdConversationId;
    dashboardState.activeConversationId = conversationId;
  }

  const res = await apiRequest(`${MESSAGES_API}/send`, {
    method: "POST",
    headers: buildHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      conversationId,
      message: text,
      fileData: options.fileData || "",
      attachmentName: options.attachmentName || "",
      attachmentType: options.attachmentType || "",
    }),
  });

  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, "Unable to send message"));
  }

  const data = await res.json();

  dashboardState.activeConversationId = String(
    data?.conversationId || conversationId
  );

  if (data?.message) {
    dashboardState.messages = [
      ...dashboardState.messages,
      data.message,
    ];
  }

  const idx = dashboardState.conversations.findIndex(
    (c) => String(c._id) === String(conversationId)
  );

  if (idx !== -1 && data?.conversation) {
    dashboardState.conversations[idx] = data.conversation;
  }

  persistDashboardState();
  notifyDashboardSubscribers();
}

async function checkAuthStatus() {
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

function setupSocket() {
  if (socketInitialized) return;
  const token = localStorage.getItem("token");
  if (!token) return;
  if (typeof window.io !== "function") return;

  socketInitialized = true;
  socket = window.io(API_ORIGIN, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 15000,
  });

  socket.io.on("reconnect_attempt", () => {
    dashboardState.socketReconnecting = true;
    dashboardState.messages = [];
    persistDashboardState();
    notifyDashboardSubscribers();
  });

  socket.on("connect", async () => {
    dashboardState.websocketActive = true;
    dashboardState.socketReconnecting = false;
    dashboardState.socketAwaitingFirstConnect = false;
    try {
      await loadConversations();
      if (dashboardState.activeConversationId) {
        await loadMessages(dashboardState.activeConversationId);
      }
    } catch (e) {
      /* ignore */
    }
    persistDashboardState();
    notifyDashboardSubscribers();
  });

  socket.on("disconnect", () => {
    dashboardState.websocketActive = false;
    dashboardState.socketReconnecting = true;
    dashboardState.socketAwaitingFirstConnect = false;
    dashboardState.messages = [];
    persistDashboardState();
    notifyDashboardSubscribers();
  });

  socket.on("reconnect", () => {
    dashboardState.socketReconnecting = false;
    dashboardState.socketAwaitingFirstConnect = false;
    notifyDashboardSubscribers();
  });

  socket.on("newMessage", async (msg) => {
    const incomingConversationId = msg?.conversationId || msg?.conversation_id;
    if (!incomingConversationId) return;

    const conversationId = String(incomingConversationId);
    const isActive = String(dashboardState.activeConversationId) === conversationId;

    // Update conversation preview (last message + sorting).
    const idx = dashboardState.conversations.findIndex(
      (c) => String(c._id) === conversationId,
    );
    if (idx !== -1) {
      dashboardState.conversations[idx] = {
        ...dashboardState.conversations[idx],
        lastMessage: msg?.message || dashboardState.conversations[idx].lastMessage,
        lastMessageAt: msg?.createdAt || dashboardState.conversations[idx].lastMessageAt,
      };
    }

    if (isActive) {
      // Avoid duplicates by message id when possible.
      const incomingId = msg?._id || msg?.id;
      const alreadyExists =
        incomingId && dashboardState.messages.some((m) => String(m._id || m.id) === String(incomingId));
      if (!alreadyExists) dashboardState.messages = [...dashboardState.messages, msg];

      // Keep read receipts current for open conversations.
      try {
        await apiRequest(`${MESSAGES_API}/conversations/${conversationId}/read`, { method: "POST" });
      } catch (e) {
        // ignore
      }
    }

    persistDashboardState();
    notifyDashboardSubscribers();
  });
}

function renderPage() {
  const route = getHashRoute();
  setActiveNav(route);
  renderTopbarBreadcrumbs();
  switch (route) {
    case "#privacy":
      renderPrivacy();
      break;
    case "#patients":
      renderPatients();
      break;
    case "#doctors":
      renderDoctors();
      break;
    case "#appointments":
      renderAppointments();
      break;
    case "#users":
      renderUsers();
      break;
    case "#login":
      renderLogin();
      break;
    case "#signup":
      renderSignup();
      break;
    case "#book":
      renderPatientBooking();
      break;
    default:
      renderHome();
  }
}

function setPageTone(kind) {
  if (!mainContent) return;
  mainContent.classList.remove("page-tone-patients", "page-tone-doctors", "page-tone-appointments", "page-tone-users");
  if (kind) mainContent.classList.add(`page-tone-${kind}`);
}

function renderPrivacy() {
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
  setPageTone("");
  const signedIn = isLoggedIn();
  const bookCta =
    getCurrentUserRole() === "patient"
      ? `<p class="dashboard-book-teaser"><a href="#book" class="btn btn-primary">Book a visit</a> <span class="dashboard-book-hint">Search for a doctor and request an appointment.</span></p>`
      : "";
  mainContent.innerHTML = `
    <section class="dashboard-hero">
      <h1>Welcome to DrMeet</h1>
      <p>Connected care coordination for patients, doctors, and clinic teams. Use the command palette (Ctrl/Cmd+K) to navigate quickly.</p>
      ${bookCta}
      <div class="inbox-live-row">
        <span class="live-badge ${dashboardState.websocketActive ? "active" : ""}">Live</span>
        <span class="live-status-text">${
          dashboardState.websocketActive
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
        <h3>Why Choose DrMeet</h3>
        <p>DrMeet centralizes patient records, visit workflows, and secure messaging in one modern workspace. Teams collaborate faster while patients get clearer updates.</p>
        <p>Smart routing, role-based access, and real-time communication keep every handoff accurate and accountable.</p>
      </div>
      <img class="why-drmeet-media" src="images/drmeet-pic1.png" alt="DrMeet technology in action" />
    </section>
    <section class="role-select card">
      <h3>Select Your Profile to Continue</h3>
      <div class="role-select-grid">
        <button type="button" class="role-card role-card-doctor" id="role-select-doctor">
          <span class="role-card-label">Doctor Profile</span>
          <span class="role-card-hint">For Doctors and Clinic Staff</span>
        </button>
        <button type="button" class="role-card role-card-patient" id="role-select-patient">
          <span class="role-card-label">Patient Profile</span>
        </button>
      </div>
    </section>
    ${
      signedIn
        ? `<section class="dashboard-grid">
            <article class="card board-card">
              <div class="card-header">
                <h3>Unified Inbox</h3>
                <button type="button" class="btn btn-primary" id="add-board-message">Compose message</button>
              </div>
              <div id="message-board-list" class="masonry-grid"></div>
            </article>
            <article class="card sms-card">
              <div class="card-header">
                <h3>Channel Summary</h3>
              </div>
              <div id="sms-feed-list" class="chat-thread"></div>
            </article>
          </section>
          <aside id="thread-drawer" class="thread-drawer hidden"></aside>`
        : ""
    }
  `;
  document.getElementById("role-select-doctor")?.addEventListener("click", () => {
    if (!isLoggedIn()) {
      window.location.hash = "#signup?role=doctor";
      renderSignup();
      return;
    }
    window.location.hash = "#doctors";
    renderDoctors();
  });
  document.getElementById("role-select-patient")?.addEventListener("click", () => {
    if (!isLoggedIn()) {
      window.location.hash = "#signup?role=patient";
      renderSignup();
      return;
    }
    window.location.hash = "#book";
    renderPatientBooking();
  });
  if (signedIn) mountDashboardWidgets();
}

function createSkeletonRows(total = 3) {
  return Array.from({ length: total })
    .map(
      () => `
        <div class="skeleton-row">
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-90"></div>
        </div>
      `
    )
    .join("");
}

function showComposeMessageModal(onSubmit) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="card" style="max-width:520px;width:100%;padding:1rem;">
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
  modal.querySelector("#compose-message-cancel")?.addEventListener("click", closeModal);
  modal.querySelector("#compose-message-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = String(modal.querySelector("#compose-message-text")?.value || "").trim();
    if (!text) return;
    await onSubmit(text);
    closeModal();
  });
}

function mountDashboardWidgets() {
  if (!isLoggedIn()) return;
  const boardContainer = document.getElementById("message-board-list");
  const smsContainer = document.getElementById("sms-feed-list");
  const addButton = document.getElementById("add-board-message");
  if (!boardContainer || !smsContainer) return;

  setupSocket();

  boardContainer.innerHTML = createSkeletonRows(2);
  smsContainer.innerHTML = createSkeletonRows(3);
  setTimeout(() => {
    renderMessageBoard(boardContainer);
    renderSmsFeed(smsContainer);
    renderThreadDrawer(document.getElementById("thread-drawer"));
  }, 350);

  addButton?.addEventListener("click", async () => {
    showComposeMessageModal(async (note) => {
      try {
        if (dashboardState.conversations.length > 0) {
          dashboardState.activeConversationId = String(dashboardState.conversations[0]._id);
          await loadMessages(dashboardState.activeConversationId);
        } else {
          dashboardState.activeConversationId = "";
          dashboardState.messages = [];
        }
        await sendMessage(note);
        showToast("Message sent.");
      } catch (err) {
        showToast(err?.message || "Unable to send message", "error");
      }
    });
  });

  dashboardSubscribers.length = 0;
  subscribeDashboard(() => {
    const liveBadge = document.querySelector(".live-badge");
    if (liveBadge) liveBadge.classList.toggle("active", dashboardState.websocketActive);
    const drawer = document.getElementById("thread-drawer");
    renderMessageBoard(boardContainer);
    renderSmsFeed(smsContainer);
    renderThreadDrawer(drawer);
  });
  loadConversations();
}

function renderMessageBoard(container) {
  const currentUserId = getCurrentUserId();
  const conversations = Array.isArray(dashboardState.conversations)
    ? dashboardState.conversations
    : [];
  const sorted = [...conversations].sort((a, b) => {
    const left = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const right = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return right - left;
  });

  container.innerHTML = sorted.length
    ? sorted
        .map((conv) => {
          const participants = Array.isArray(conv.participants) ? conv.participants : [];
          const other =
            participants.find((p) => String(p._id) !== String(currentUserId)) ||
            participants[0] ||
            null;
          const otherName = other
            ? `${other.firstName || ""} ${other.lastName || ""}`.trim()
            : "Conversation";
          const lastAt = conv.lastMessageAt || conv.updatedAt;
          const lastMsg = conv.lastMessage || "";

          return `
            <article class="message-card tailwind-card" data-conversation-id="${conv._id}">
              <div class="message-row">
                <h4>${otherName}</h4>
                <small>${lastAt ? formatRelativeTime(lastAt) : ""}</small>
              </div>
              <p class="message-preview">${lastMsg || "No messages yet"}</p>
              <div class="quick-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-open-thread="${conv._id}">Open thread</button>
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="feedback">No conversations yet.</div>`;

  container.querySelectorAll("[data-open-thread]").forEach((button) => {
    button.addEventListener("click", async () => {
      const conversationId = button.getAttribute("data-open-thread");
      if (!conversationId) return;
      dashboardState.activeConversationId = String(conversationId);
      await loadMessages(conversationId);
    });
  });

  container.querySelectorAll(".message-card").forEach((card) => {
    card.addEventListener("click", async (event) => {
      if (event.target.closest("button")) return;
      const conversationId = card.getAttribute("data-conversation-id");
      if (!conversationId) return;
      dashboardState.activeConversationId = String(conversationId);
      await loadMessages(conversationId);
    });
  });
}

function renderSmsFeed(container) {
  const containerEmptyState = `
    <div class="feedback">
      ${dashboardState.activeConversationId ? "Select a conversation to view messages." : "Select a conversation to view messages."}
    </div>
  `;

  if (!dashboardState.activeConversationId) {
    container.innerHTML = containerEmptyState;
    return;
  }

  if (dashboardState.socketReconnecting && !dashboardState.websocketActive) {
    container.innerHTML = `
      <div class="feedback sms-feed-loading">
        Connecting... live updates are restoring (this can take up to 30 seconds).
      </div>`;
    return;
  }

  const conv = dashboardState.conversations.find(
    (c) => String(c._id) === String(dashboardState.activeConversationId),
  );
  const participants = Array.isArray(conv?.participants) ? conv.participants : [];
  const currentUserId = getCurrentUserId();
  const other =
    participants.find((p) => String(p._id) !== String(currentUserId)) || participants[0] || null;
  const otherName = other
    ? `${other.firstName || ""} ${other.lastName || ""}`.trim()
    : "Conversation";

  container.innerHTML = `
    <div class="chat-bubble">
      <div class="chat-head">
        <strong>${otherName}</strong>
      </div>
      <p style="opacity:0.85">${(dashboardState.messages?.length || 0)} message(s)</p>
    </div>
  `;
}

function renderThreadDrawer(drawer) {
  if (!isLoggedIn()) {
    if (drawer) {
      drawer.classList.add("hidden");
      drawer.innerHTML = "";
    }
    return;
  }
  if (!drawer) return;
  const conversationId = dashboardState.activeConversationId;
  if (!conversationId) {
    drawer.classList.add("hidden");
    drawer.innerHTML = "";
    return;
  }

  const conv = dashboardState.conversations.find(
    (c) => String(c._id) === String(conversationId),
  );
  const participants = Array.isArray(conv?.participants) ? conv.participants : [];
  const currentUserId = getCurrentUserId();
  const other =
    participants.find((p) => String(p._id) !== String(currentUserId)) || participants[0] || null;
  const otherName = other
    ? `${other.firstName || ""} ${other.lastName || ""}`.trim()
    : "Conversation";

  const threadMessages = Array.isArray(dashboardState.messages) ? dashboardState.messages : [];
  drawer.classList.remove("hidden");
  drawer.innerHTML = `
    <div class="thread-header">
      <h3>${otherName}</h3>
      <button type="button" class="btn btn-secondary btn-sm" id="close-thread">Close</button>
    </div>
    <div class="thread-list">
      ${
        dashboardState.socketReconnecting && !dashboardState.websocketActive
          ? `<div class="feedback">Connecting... messages reload automatically when live sync returns.</div>`
          : threadMessages.length
          ? threadMessages
              .map((msg) => {
                const sender = msg.senderId || {};
                const senderId = msg.senderId?._id || msg.senderId || null;
                const isYou = senderId ? String(senderId) === String(currentUserId) : false;
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
                    const isImage = type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(msg.attachmentUrl || ""));
                    return isImage
                      ? `<div class="thread-attachment-wrap"><a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="${name}" class="thread-attachment-image" /></a><p><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></p></div>`
                      : `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></p>`;
                  })()
                  : "";
                return `
                  <div class="thread-item ${roleClass}">
                    <div class="thread-item-header">
                      <strong>${displayName}</strong>
                      <small>${msg.createdAt ? formatRelativeTime(msg.createdAt) : ""}</small>
                    </div>
                    <p>${escapeHtml(msg.message || "")}</p>
                    ${attachmentMarkup}
                  </div>
                `;
              })
              .join("")
          : `<div class="feedback">No messages yet.</div>`
      }
    </div>
    <div class="thread-drawer-reply">
      <p class="thread-reply-label">Reply in this conversation</p>
      <p class="thread-quick-hint thread-quick-hint--recipient" data-thread-hint-recipient></p>
      <textarea id="thread-quick-reply" rows="3" placeholder="Type your message…" autocomplete="off"></textarea>
      <label style="margin:0.5rem 0;">Attach screenshot or document
        <input id="thread-quick-file" type="file" accept="image/*,.pdf,.doc,.docx,.txt" />
      </label>
      <button type="button" class="btn btn-primary" id="thread-send-reply">Send message</button>
    </div>
  `;
  const recipientHintEl = drawer.querySelector("[data-thread-hint-recipient]");
  if (recipientHintEl) {
    recipientHintEl.textContent = `Quick reply to ${otherName}`;
  }

  drawer.querySelector("#close-thread")?.addEventListener("click", () => {
    drawer.classList.add("hidden");
  });

  drawer.querySelector("#thread-send-reply")?.addEventListener("click", async () => {
    const input = drawer.querySelector("#thread-quick-reply");
    const fileInput = drawer.querySelector("#thread-quick-file");
    const file = fileInput?.files?.[0];
    const content = input?.value?.trim();
    if ((!content && !file) || !conversationId) return;
    if (String(dashboardState.activeConversationId) !== String(conversationId)) {
      dashboardState.activeConversationId = String(conversationId);
    }
    try {
      if (file) {
        await sendDocumentMessage({ conversationId, text: content, file });
      } else {
        await sendMessage(content);
      }
      if (input) input.value = "";
      if (fileInput) fileInput.value = "";
    } catch (err) {
      showToast(err?.message || "Unable to send message", "error");
    }
  });
}

// --- Authentication ---
function isLoggedIn() {
  return !!localStorage.getItem("token");
}

function updateAuthNav() {
  const loginLink = document.getElementById("login-link");
  const signedIn = isLoggedIn();
  const role = getCurrentUserRole();
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
  updateSidebarAccountInfo();
  if (sidebarClockIntervalId) {
    clearInterval(sidebarClockIntervalId);
    sidebarClockIntervalId = null;
  }
  if (signedIn) {
    cacheCurrentUserProfile();
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

function renderLogin() {
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
      <label>Password <input name="password" type="password" required /></label>
      <button type="submit" class="btn btn-primary">Sign in</button>
    </form>
    <button id="google-login-btn" type="button" class="btn btn-google" style="margin-top:1rem;">Continue with Google</button>
    <div id="login-feedback"></div>
  `;
  const googleLoginBtn = document.getElementById('google-login-btn');
  const form = document.getElementById('login-form');
  const feedback = document.getElementById('login-feedback');
  const oauthSuccessToken = consumeOauthSuccessTokenFromHash();
  if (oauthSuccessToken) {
    clearGoogleAuthLoading("Google sign-in successful.");
    resetMessagingSocket();
    localStorage.setItem('token', oauthSuccessToken);
    updateAuthNav();
    window.location.hash = '#home';
    renderHome();
    return;
  }
  const oauthError = consumeOauthErrorFromHash();
  if (oauthError) {
    clearGoogleAuthLoading(oauthError, true);
    feedback.textContent = oauthError;
    feedback.className = "feedback error";
  }
  googleLoginBtn.onclick = () =>
    googleLogin({ feedbackEl: feedback, buttonEl: googleLoginBtn });
  form.onsubmit = async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    feedback.textContent = 'Logging in...';
    const creds = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch(`${API_ORIGIN}/auth/login`, {
        method: 'POST',
        credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const data = await res.json();
      if (data.token) {
        resetMessagingSocket();
        localStorage.setItem('token', data.token);
        feedback.textContent = 'Login successful!';
        updateAuthNav();
        setTimeout(() => {
          window.location.hash = '#home';
          renderHome();
        }, 800);
      } else {
        throw new Error('No token received');
      }
    } catch (err) {
      feedback.textContent = normalizeFetchErrorMessage(err, "Login failed.");
      feedback.className = 'feedback error';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };
}

function renderSignup() {
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
  const titleOptions = selectedRole === "doctor"
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
      <label>Password <input name="password" type="password" required /></label>
      <label>Phone
        <input name="phone" inputmode="numeric" pattern="[0-9]{10,11}" maxlength="11" title="Use 10 or 11 digits" placeholder="e.g. 09171234567" />
        <small>Digits only, 10-11 numbers.</small>
      </label>
      <label>Address <input name="address" /></label>
      ${
        selectedRole === "doctor"
          ? `<label>Specialty <input name="specialty" list="doctor-specialties-signup" required placeholder="e.g. Cardiology" /></label>
             <datalist id="doctor-specialties-signup">
               ${[...new Set(DOCTOR_SPECIALTIES)].map((s) => `<option value="${s}"></option>`).join("")}
             </datalist>`
          : ""
      }
      <button type="submit" class="btn btn-primary">Create account</button>
    </form>
    <p class="signup-lead" style="margin-top:0.75rem;">Already registered? <a href="#login">Go to Login</a></p>
    <div id="signup-feedback"></div>
  `;
  const form = document.getElementById('signup-form');
  enforcePhoneInputs(form);
  const feedback = document.getElementById('signup-feedback');
  const oauthSuccessToken = consumeOauthSuccessTokenFromHash();
  if (oauthSuccessToken) {
    clearGoogleAuthLoading("Google sign-in successful.");
    resetMessagingSocket();
    localStorage.setItem('token', oauthSuccessToken);
    updateAuthNav();
    window.location.hash = '#home';
    renderHome();
    return;
  }
  const oauthError = consumeOauthErrorFromHash();
  if (oauthError) {
    clearGoogleAuthLoading(oauthError, true);
    feedback.textContent = oauthError;
    feedback.className = "feedback error";
  }
  form.onsubmit = async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    feedback.textContent = 'Signing up...';
    const user = Object.fromEntries(new FormData(form));
    if (selectedRole) user.role = selectedRole;
    try {
      const res = await fetch(`${API_ORIGIN}/auth/signup`, {
        method: 'POST',
        credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Signup failed."));
      }
      const data = await res.json();
      if (data.token) {
        resetMessagingSocket();
        localStorage.setItem('token', data.token);
        feedback.textContent = 'Signup successful!';
        updateAuthNav();
        setTimeout(() => {
          window.location.hash = '#home';
          renderHome();
        }, 800);
      } else {
        throw new Error('No token received');
      }
    } catch (err) {
      feedback.textContent = normalizeFetchErrorMessage(err, "Signup failed.");
      feedback.className = 'feedback error';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };
}

function googleLogin({ feedbackEl = null, buttonEl = null } = {}) {
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
  const roleQuery = requestedRole ? `?role=${encodeURIComponent(requestedRole)}` : "";
  const popup = window.open(
    `${API_ORIGIN}/auth/google${roleQuery}`,
    'googleLogin',
    'width=500,height=600'
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
          clearGoogleAuthLoading("Google sign-in was closed before completion.", true);
        }
      }, 1000);
    }
  }, 500);
}

function handleGoogleAuthMessage(event) {
  if (!event.data) return;
  if (event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.token) {
    clearGoogleAuthLoading("Google sign-in successful.");
    resetMessagingSocket();
    localStorage.setItem('token', event.data.token);
    updateAuthNav();
    window.location.hash = '#home';
    renderHome();
    return;
  }
  if (event.data.type === 'GOOGLE_AUTH_FAILURE') {
    clearGoogleAuthLoading(event.data.message || "Google sign-in failed.", true);
  }
}

async function renderPatientBooking() {
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
  if (!myPatient) {
    profileBanner.innerHTML = `
      <div class="feedback patient-profile-missing">
        Add your patient details once so we can book visits for you.
        <a href="#patients" class="btn btn-primary btn-sm">Complete my profile</a>
      </div>`;
  } else {
    profileBanner.innerHTML = `<p class="patient-profile-ok"><strong>Profile on file:</strong> ${myPatient.firstName} ${myPatient.lastName}</p>`;
  }

  const grid = document.getElementById("patient-doctor-grid");
  const searchInput = document.getElementById("patient-doctor-search");
  const countEl = document.getElementById("patient-doctor-count");
  const drawer = document.getElementById("patient-booking-drawer");
  const feedbackEl = document.getElementById("patient-booking-feedback");
  const bookingForm = document.getElementById("patient-booking-form");

  grid.innerHTML = '<div class="feedback">Loading doctors…</div>';
  let doctors = [];
  try {
    const res = await apiRequest(`${API_BASE}/doctors`);
    if (!res.ok) throw new Error("Could not load doctors.");
    doctors = await res.json();
    if (!Array.isArray(doctors)) doctors = [];
  } catch (e) {
    grid.innerHTML = `<div class="feedback error">${e.message || "Failed to load doctors."}</div>`;
    return;
  }

  function renderDoctorCards(list) {
    countEl.textContent = list.length
      ? `${list.length} doctor${list.length === 1 ? "" : "s"} match your search`
      : "No doctors match your search.";
    if (!list.length) {
      grid.innerHTML =
        '<div class="feedback">Try another name, specialty, or keyword—or clear the search to see everyone.</div>';
      return;
    }
    grid.innerHTML = list
      .map((d) => {
        const name = formatDoctorDisplayName(d);
        const spec = d.specialty || "Specialty not listed";
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
            ${dept}
            ${clinic}
            ${receptionistName}
            ${receptionistPhone}
            ${receptionistEmail}
            <p class="doctor-pick-avail">${avail}</p>
            <button type="button" class="btn btn-primary btn-sm doctor-pick-book" data-book-doctor="${d._id}">Book with this doctor</button>
          </article>`;
      })
      .join("");
  }

  function applyFilter() {
    const q = searchInput.value;
    const filtered = doctors.filter((d) => doctorMatchesPatientSearch(d, q));
    renderDoctorCards(filtered);
  }

  searchInput.addEventListener("input", applyFilter);
  applyFilter();

  function openDrawer(doctorId) {
    if (!myPatient) {
      window.location.hash = "#patients";
      return;
    }
    const d = doctors.find((x) => String(x._id) === String(doctorId));
    const displayName = formatDoctorDisplayName(d) || "your doctor";
    document.getElementById("patient-booking-doctor-title").textContent = `Book with ${displayName}`;
    feedbackEl.style.display = "none";
    feedbackEl.textContent = "";
    bookingForm.reset();
    document.getElementById("patient-booking-doctor-id").value = doctorId;
    drawer.classList.remove("hidden");
  }

  function closeDrawer() {
    drawer.classList.add("hidden");
  }

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-book-doctor]");
    if (!btn) return;
    openDrawer(btn.getAttribute("data-book-doctor"));
  });

  document.getElementById("patient-booking-close").onclick = closeDrawer;
  document.getElementById("patient-booking-cancel").onclick = closeDrawer;

  bookingForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!myPatient) {
      window.location.hash = "#patients";
      return;
    }
    const doctorId = document.getElementById("patient-booking-doctor-id").value;
    const fd = new FormData(bookingForm);
    const date = fd.get("date");
    const time = fd.get("time");
    const notes = String(fd.get("notes") || "").trim();
    feedbackEl.style.display = "none";
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
      feedbackEl.className = "feedback success";
      feedbackEl.style.display = "block";
      feedbackEl.textContent =
        "Request sent. You will see it under Appointments—we will follow up soon.";
      setTimeout(() => {
        closeDrawer();
        window.location.hash = "#appointments";
        renderAppointments();
      }, 1400);
    } catch (err) {
      feedbackEl.className = "feedback error";
      feedbackEl.style.display = "block";
      feedbackEl.textContent = err.message || "Something went wrong.";
    }
  };
}

// --- Patients ---
async function renderPatients() {
  setPageTone("patients");
  mainContent.innerHTML =
    '<h2 class="page-title page-title-patients">Patients</h2><div class="feedback">Loading...</div>';
  try {
    const res = await apiRequest(`${API_BASE}/patients`);
    if (!res.ok) throw new Error("Failed to fetch patients");
    const patients = await res.json();
    const role = getCurrentUserRole();
    const isPatient = role === "patient";
    const isReceptionist = role === "receptionist";
    const patientOptions = patients
      .map((p) => `<option value="${p._id}">${p.firstName || ""} ${p.lastName || ""}</option>`)
      .join("");
    const isDoctor = role === "doctor";
    let canReceptionistSendDocs = false;
    if (isReceptionist) {
      try {
        const docsRes = await apiRequest(`${API_BASE}/doctors`);
        if (docsRes.ok) {
          const doctorRows = await docsRes.json();
          const linkedDoctorId = getCurrentLinkedDoctorId();
          const linked = doctorRows.find((d) => String(d._id) === String(linkedDoctorId));
          canReceptionistSendDocs = Boolean(linked?.allowReceptionistSendDocuments);
        }
      } catch (e) {
        canReceptionistSendDocs = false;
      }
    }
    mainContent.innerHTML = `
      <h2 class="page-title page-title-patients">Patients</h2>
      <div>
        <button class="cta-primary" onclick="window.showPatientForm()">Add Patient</button>
        ${isPatient ? '<button class="cta-primary" onclick="window.showFamilyMemberForm()">Register Family Member</button>' : ""}
        ${isPatient ? '<button class="cta-primary" onclick="window.sendMyDocumentToClinic()">Send Document to Clinic</button>' : ""}
      </div>
      ${isPatient && patients.length ? `
      <div class="list-filters">
        <label>Switch Profile
          <select id="patient-switch-profile">
            <option value="">All linked profiles</option>
            ${patientOptions}
          </select>
        </label>
      </div>` : ""}
      <hr class="section-divider" />
      <div class="list-filters">
        <input type="search" id="patient-filter-name" placeholder="Filter by name" />
        <input type="search" id="patient-filter-email" placeholder="Filter by email" />
        <input type="search" id="patient-filter-phone" placeholder="Filter by phone" />
        <input type="search" id="patient-filter-dob" placeholder="Filter by DOB (YYYY-MM-DD)" />
      </div>
      <table>
        <thead><tr><th>Name</th><th>Profile Type</th><th>Email</th><th>Phone</th><th>Date of Birth</th><th>Actions</th></tr></thead>
        <tbody id="patients-table-body"></tbody>
      </table>
      <div id="patient-form-modal" style="display:none"></div>
    `;
    const bodyEl = document.getElementById("patients-table-body");
    const renderRows = (list) => {
      bodyEl.innerHTML = list
        .map(
          (p) => `
            <tr>
              <td>${p.firstName} ${p.lastName}</td>
              <td>${p.familyHeadName ? `Family Head: ${p.familyHeadName}` : (p.relationshipToAccountHolder ? `Dependent: ${p.relationshipToAccountHolder}` : "Primary")}${p.isCareTeamLinked ? ' <span class="pill-tag">Attached</span>' : ""}</td>
              <td>${p.email || ""}</td>
              <td>${p.phone || ""}</td>
              <td>${formatDateDisplay(p.birthdate) || ""}</td>
              <td>
                <button class="btn btn-secondary btn-action-edit" onclick="window.editPatient('${p._id}')">Edit</button>
                <button class="btn btn-action-delete" onclick="window.deletePatient('${p._id}')">Delete</button>
                ${isDoctor || (isReceptionist && canReceptionistSendDocs) ? `<button class="btn btn-primary btn-action-edit" onclick="window.sendPatientDocumentFromDoctor('${p._id}')">Send Document</button>` : ""}
              </td>
            </tr>
          `
        )
        .join("");
    };
    const applyPatientFilters = () => {
      const nameQ = String(document.getElementById("patient-filter-name")?.value || "").toLowerCase().trim();
      const emailQ = String(document.getElementById("patient-filter-email")?.value || "").toLowerCase().trim();
      const phoneQ = String(document.getElementById("patient-filter-phone")?.value || "").toLowerCase().trim();
      const dobQ = String(document.getElementById("patient-filter-dob")?.value || "").toLowerCase().trim();
      const filtered = patients.filter((p) => {
        const name = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase();
        const email = String(p.email || "").toLowerCase();
        const phone = String(p.phone || "").toLowerCase();
        const dob = formatDateForInput(p.birthdate).toLowerCase();
        return (
          (!nameQ || name.includes(nameQ)) &&
          (!emailQ || email.includes(emailQ)) &&
          (!phoneQ || phone.includes(phoneQ)) &&
          (!dobQ || dob.includes(dobQ))
        );
      });
      renderRows(filtered);
    };
    ["patient-filter-name", "patient-filter-email", "patient-filter-phone", "patient-filter-dob"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", applyPatientFilters);
    });
    document.getElementById("patient-switch-profile")?.addEventListener("change", (event) => {
      const selectedId = String(event.target.value || "");
      if (!selectedId) {
        applyPatientFilters();
        return;
      }
      const picked = patients.filter((p) => String(p._id) === selectedId);
      renderRows(picked);
    });
    renderRows(patients);
    window.showPatientForm = showPatientForm;
    window.showFamilyMemberForm = () => showPatientForm(null, true);
    window.editPatient = editPatient;
    window.deletePatient = deletePatient;
    window.sendMyDocumentToClinic = async () => {
      const selectedId = String(document.getElementById("patient-switch-profile")?.value || "");
      const patientProfile = selectedId
        ? patients.find((p) => String(p._id) === selectedId)
        : patients.find((p) => !p.relationshipToAccountHolder) || patients[0];
      if (!patientProfile?.userId) {
        showToast("No messaging profile found for the selected patient.", "error");
        return;
      }
      const doctorUserId = await resolveDoctorIdForPatientMessaging();
      if (!doctorUserId) {
        showToast("No linked doctor found yet. Book an appointment first.", "error");
        return;
      }
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*,.pdf,.doc,.docx,.txt";
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
          await sendDocumentMessage({
            patientId: String(patientProfile.userId),
            doctorId: String(doctorUserId),
            text: "Patient document for clinic review.",
            file,
          });
          showToast("Document sent to clinic for review.");
        } catch (error) {
          showToast(error?.message || "Unable to send document.", "error");
        }
      };
      fileInput.click();
    };
    window.sendPatientDocumentFromDoctor = async (patientId) => {
      const patient = patients.find((p) => String(p._id) === String(patientId));
      if (!patient?.userId) {
        showToast("This patient has no linked login account for messaging.", "error");
        return;
      }
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*,.pdf,.doc,.docx,.txt";
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
          await sendDocumentMessage({
            patientId: String(patient.userId),
            doctorId: String(getCurrentUserId()),
            text: "Document from your doctor.",
            file,
          });
          showToast("Document sent to patient.");
        } catch (error) {
          showToast(error?.message || "Unable to send document.", "error");
        }
      };
      fileInput.click();
    };
  } catch (err) {
    mainContent.innerHTML = `<h2>Patients</h2><div class="feedback error">${err.message}</div>`;
  }
}

function showPatientForm(editId = null, familyMode = false) {
  const modal = document.getElementById("patient-form-modal");
  const role = getCurrentUserRole();
  const canAttachExisting = !editId && (role === "doctor" || role === "receptionist");
  modal.style.display = "block";
  modal.innerHTML = `
    <form id="patient-form">
      <h3>${editId ? "Edit" : familyMode ? "Register Family Member" : "Add"} Patient</h3>
      ${canAttachExisting ? `
      <section class="card" style="padding:0.75rem;">
        <h4 style="margin:0 0 0.45rem;">Search Existing Patient</h4>
        <label>Search by name, email, or phone
          <input type="search" id="patient-existing-search" placeholder="Type at least 2 characters" />
        </label>
        <div id="patient-existing-results" class="feedback" style="display:none"></div>
      </section>
      ` : ""}
      <label>First Name <input name="firstName" required /></label>
      <label>Last Name <input name="lastName" required /></label>
      <label>Email <input name="email" type="email" ${familyMode ? "" : "required"} /></label>
      <label>Phone
        <input name="phone" inputmode="numeric" pattern="[0-9]{10,11}" maxlength="11" title="Use 10 or 11 digits" placeholder="e.g. 09171234567" />
        <small>Digits only, 10-11 numbers.</small>
      </label>
      <label>Date of Birth <input name="birthdate" type="date" /></label>
      <label>Gender
        <select name="gender">
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label>Address <input name="address" /></label>
      ${familyMode ? `<label>Relationship to Account Holder <input name="relationshipToAccountHolder" required placeholder="e.g. Son, Daughter, Spouse" /></label>` : ""}
      <label>Notes <textarea name="notes" placeholder="Medical notes or reminders"></textarea></label>
      <label>Medical History
        <textarea name="medicalHistory" placeholder="One item per line"></textarea>
      </label>
      <label>Attach Document
        <input name="documentFile" type="file" accept="image/*,.pdf,.doc,.docx,.txt" />
      </label>
      <div class="modal-form-actions">
        <button type="submit" class="btn btn-secondary btn-action-edit">${editId ? "Update" : "Add"}</button>
        <button type="button" class="btn btn-action-delete" onclick="window.closePatientForm()">Cancel</button>
      </div>
    </form>
  `;
  window.closePatientForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("patient-form");
  enforcePhoneInputs(form);
  if (canAttachExisting) {
    const searchInput = document.getElementById("patient-existing-search");
    const resultEl = document.getElementById("patient-existing-results");
    let pickedExistingPatientId = "";
    searchInput?.addEventListener("input", async () => {
      const q = String(searchInput.value || "").trim();
      resultEl.style.display = "none";
      if (q.length < 2) return;
      try {
        const res = await apiRequest(`${API_BASE}/patients/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("Search failed");
        const matches = await res.json();
        if (!matches.length) {
          resultEl.style.display = "block";
          resultEl.className = "feedback";
          resultEl.textContent = "No duplicate match found. You may create a new patient record.";
          return;
        }
        resultEl.style.display = "block";
        resultEl.className = "feedback error";
        resultEl.innerHTML = matches
          .map((m) => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
              <span>${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)} (${escapeHtml(m.email || m.phone || "No contact")})</span>
              <button type="button" class="btn btn-secondary btn-sm" data-attach-patient="${m._id}">Add Existing</button>
            </div>
          `)
          .join("");
        resultEl.querySelectorAll("[data-attach-patient]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            pickedExistingPatientId = btn.getAttribute("data-attach-patient");
            try {
              const attachRes = await apiRequest(`${API_BASE}/patients/${pickedExistingPatientId}/attach`, { method: "POST" });
              if (!attachRes.ok) throw new Error(await getApiErrorMessage(attachRes, "Failed to attach patient"));
              modal.style.display = "none";
              renderPatients();
              showToast("Existing patient was added to your Patients tab.");
            } catch (error) {
              showToast(error.message || "Unable to attach existing patient.", "error");
            }
          });
        });
      } catch (error) {
        resultEl.style.display = "block";
        resultEl.className = "feedback error";
        resultEl.textContent = "Unable to search duplicates right now.";
      }
    });
  }
  if (editId) {
    apiRequest(`${API_BASE}/patients/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.firstName.value = data.firstName || "";
        form.lastName.value = data.lastName || "";
        form.email.value = data.email || "";
        form.phone.value = data.phone || "";
        form.birthdate.value = formatDateForInput(data.birthdate);
        form.gender.value = data.gender || "";
        form.address.value = data.address || "";
        form.notes.value = data.notes || "";
        form.medicalHistory.value = Array.isArray(data.medicalHistory) ? data.medicalHistory.join("\n") : "";
      });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const patient = Object.fromEntries(new FormData(form));
    const docFile = form.documentFile?.files?.[0];
    if (docFile) {
      patient.documentFileData = await fileToDataUrl(docFile);
      patient.documentName = docFile.name || "Patient attachment";
    }
    if (familyMode) {
      patient.relationshipToAccountHolder = String(patient.relationshipToAccountHolder || "").trim();
    }
    patient.medicalHistory = String(patient.medicalHistory || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      if (canAttachExisting) {
        const duplicateRes = await apiRequest(
          `${API_BASE}/patients/search?q=${encodeURIComponent(`${patient.firstName || ""} ${patient.lastName || ""} ${patient.email || ""}`.trim())}`,
        );
        if (duplicateRes.ok) {
          const dupes = await duplicateRes.json();
          if (Array.isArray(dupes) && dupes.length) {
            throw new Error("Possible duplicate exists. Use 'Search Existing Patient' and click Add Existing.");
          }
        }
      }
      const res = await apiRequest(
        `${API_BASE}/patients${editId ? "/" + editId : ""}`,
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patient),
        }
      );
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Failed to save patient"));
      }
      modal.style.display = "none";
      renderPatients();
    } catch (err) {
      showToast(err.message, "error");
    }
  };
}

function editPatient(id) {
  showPatientForm(id);
}
async function deletePatient(id) {
  if (!(await showDangerConfirm("Delete this patient?"))) return;
  try {
    const res = await apiRequest(`${API_BASE}/patients/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete patient");
    renderPatients();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// --- Doctors ---
async function renderDoctors() {
  setPageTone("doctors");
  mainContent.innerHTML =
    '<h2 class="page-title page-title-doctors">Doctors</h2><div class="feedback">Loading...</div>';
  try {
    const res = await apiRequest(`${API_BASE}/doctors`);
    if (!res.ok) throw new Error("Failed to fetch doctors");
    const allDoctors = await res.json();
    const role = getCurrentUserRole();
    const isAdmin = role === "admin";
    const isDoctor = role === "doctor";
    const currentUserId = getCurrentUserId();
    const doctors = isDoctor
      ? allDoctors.filter((d) => String(d.userId || "") === String(currentUserId || ""))
      : allDoctors;
    mainContent.innerHTML = `
      <h2 class="page-title page-title-doctors">Doctors</h2>
      ${isAdmin ? '<button class="cta-primary" onclick="window.showDoctorForm()">Add Doctor</button>' : ""}
      ${
        isDoctor
          ? `<section class="card" style="margin: 1rem 0;">
              <h3>Clinic Staff</h3>
              <p class="signup-lead">Invite a receptionist and link them to your clinic.</p>
              <form id="invite-receptionist-form">
                <label>Receptionist Email <input type="email" name="email" required placeholder="reception@clinic.com" /></label>
                <div class="modal-form-actions">
                  <button type="submit" class="btn btn-secondary btn-action-edit">Invite Receptionist</button>
                </div>
              </form>
              <div id="invite-receptionist-feedback" class="feedback" style="display:none"></div>
        <label style="margin-top:0.6rem;">Receptionist document permission
          <input type="checkbox" id="doctor-allow-receptionist-docs" />
          <small>Allow receptionist to send patient documents.</small>
        </label>
            </section>`
          : ""
      }
      <hr class="section-divider" />
      ${isDoctor ? "" : `<div class="list-filters">
        <input type="search" id="doctor-filter-name" placeholder="Filter by name" />
        <input type="search" id="doctor-filter-email" placeholder="Filter by email" />
        <input type="search" id="doctor-filter-specialty" placeholder="Filter by specialty" />
        <input type="search" id="doctor-filter-availability" placeholder="Filter by availability" />
        <input type="search" id="doctor-filter-phone" placeholder="Filter by phone" />
        <input type="search" id="doctor-filter-receptionist" placeholder="Filter by receptionist" />
        <input type="search" id="doctor-filter-clinic" placeholder="Filter by clinic" />
      </div>`}
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Specialty</th><th>Clinic</th><th>Availability</th><th>Phone</th><th>Receptionist</th><th>Actions</th></tr></thead>
        <tbody id="doctors-table-body"></tbody>
      </table>
      <div id="doctor-form-modal" style="display:none"></div>
    `;
    const bodyEl = document.getElementById("doctors-table-body");
    const renderRows = (list) => {
      bodyEl.innerHTML = list
        .map(
          (d) => `
            <tr>
              <td>${d.photoUrl ? `<img src="${escapeHtml(d.photoUrl)}" alt="Doctor avatar" class="doctor-avatar" />` : `<span class="doctor-avatar"></span>`}${d.firstName} ${d.lastName}</td>
              <td>${d.email || ""}</td>
              <td>${d.specialty || ""}</td>
              <td>${d.affiliatedClinics || "—"}</td>
              <td>${buildDoctorAvailabilityLabel(d)}</td>
              <td>${d.phone || ""}</td>
              <td>
                <div>${d.receptionistName || "—"}</div>
                <div>${d.receptionistPhone || ""}</div>
                <div>${d.receptionistEmail || ""}</div>
              </td>
              <td>
                ${
                  isAdmin || isDoctor
                    ? `<button class="btn btn-secondary btn-action-edit" onclick="window.editDoctor('${d._id}')">Edit</button>
                <button class="btn btn-action-delete" onclick="window.deleteDoctor('${d._id}')">Delete</button>`
                    : `<button class="btn btn-primary btn-action-edit" onclick="window.bookDoctorFromDoctorsTab()">Book an Appointment</button>`
                }
              </td>
            </tr>
          `
        )
        .join("");
    };
    const applyDoctorFilters = () => {
      const nameQ = String(document.getElementById("doctor-filter-name")?.value || "").toLowerCase().trim();
      const emailQ = String(document.getElementById("doctor-filter-email")?.value || "").toLowerCase().trim();
      const specialtyQ = String(document.getElementById("doctor-filter-specialty")?.value || "").toLowerCase().trim();
      const availabilityQ = String(document.getElementById("doctor-filter-availability")?.value || "").toLowerCase().trim();
      const phoneQ = String(document.getElementById("doctor-filter-phone")?.value || "").toLowerCase().trim();
      const receptionistQ = String(document.getElementById("doctor-filter-receptionist")?.value || "").toLowerCase().trim();
      const clinicQ = String(document.getElementById("doctor-filter-clinic")?.value || "").toLowerCase().trim();
      const filtered = doctors.filter((d) => {
        const name = `${d.firstName || ""} ${d.lastName || ""}`.toLowerCase();
        const email = String(d.email || "").toLowerCase();
        const specialty = String(d.specialty || "").toLowerCase();
        const availability = String(buildDoctorAvailabilityLabel(d) || "").toLowerCase();
        const phone = String(d.phone || "").toLowerCase();
        const receptionist = `${d.receptionistName || ""} ${d.receptionistPhone || ""} ${d.receptionistEmail || ""}`.toLowerCase();
        const clinic = String(d.affiliatedClinics || "").toLowerCase();
        return (
          (!nameQ || name.includes(nameQ)) &&
          (!emailQ || email.includes(emailQ)) &&
          (!specialtyQ || specialty.includes(specialtyQ)) &&
          (!availabilityQ || availability.includes(availabilityQ)) &&
          (!phoneQ || phone.includes(phoneQ)) &&
          (!receptionistQ || receptionist.includes(receptionistQ)) &&
          (!clinicQ || clinic.includes(clinicQ))
        );
      });
      renderRows(filtered);
    };
    if (!isDoctor) {
      ["doctor-filter-name", "doctor-filter-email", "doctor-filter-specialty", "doctor-filter-availability", "doctor-filter-phone", "doctor-filter-receptionist", "doctor-filter-clinic"].forEach((id) => {
        document.getElementById(id)?.addEventListener("input", applyDoctorFilters);
      });
    }
    renderRows(doctors);
    window.showDoctorForm = showDoctorForm;
    window.editDoctor = editDoctor;
    window.deleteDoctor = deleteDoctor;
    window.bookDoctorFromDoctorsTab = () => {
      window.location.hash = "#book";
      renderPatientBooking();
    };
    document.getElementById("invite-receptionist-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const feedback = document.getElementById("invite-receptionist-feedback");
      const email = String(new FormData(form).get("email") || "").trim();
      if (!email) return;
      feedback.style.display = "block";
      feedback.className = "feedback";
      feedback.textContent = "Inviting receptionist...";
      try {
        const inviteRes = await apiRequest(`${API_BASE}/doctors/clinic-staff/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!inviteRes.ok) {
          throw new Error(await getApiErrorMessage(inviteRes, "Failed to invite receptionist"));
        }
        feedback.className = "feedback success";
        feedback.textContent = "Receptionist linked successfully.";
        form.reset();
      } catch (error) {
        feedback.className = "feedback error";
        feedback.textContent = error.message || "Failed to invite receptionist.";
      }
    });
    if (isDoctor && doctors[0]) {
      const toggle = document.getElementById("doctor-allow-receptionist-docs");
      if (toggle) {
        toggle.checked = Boolean(doctors[0].allowReceptionistSendDocuments);
        toggle.addEventListener("change", async () => {
          try {
            const upRes = await apiRequest(`${API_BASE}/doctors/${doctors[0]._id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ allowReceptionistSendDocuments: toggle.checked }),
            });
            if (!upRes.ok) throw new Error(await getApiErrorMessage(upRes, "Failed to update permission"));
            showToast("Receptionist document permission updated.");
          } catch (error) {
            toggle.checked = !toggle.checked;
            showToast(error.message || "Failed to update permission.", "error");
          }
        });
      }
    }
  } catch (err) {
    mainContent.innerHTML = `<h2>Doctors</h2><div class="feedback error">${err.message}</div>`;
  }
}

function showDoctorForm(editId = null) {
  const modal = document.getElementById("doctor-form-modal");
  modal.style.display = "block";
  modal.innerHTML = `
    <form id="doctor-form">
      <h3>${editId ? "Edit" : "Add"} Doctor</h3>
      <label>First Name <input name="firstName" required /></label>
      <label>Last Name <input name="lastName" required /></label>
      <label>Email <input name="email" type="email" required /></label>
      <label>Specialty <input name="specialty" list="doctor-specialties" required /></label>
      <datalist id="doctor-specialties">
        ${[...new Set(DOCTOR_SPECIALTIES)].map((s) => `<option value="${s}"></option>`).join("")}
      </datalist>
      <label>Bio <textarea name="bio" placeholder="Short profile"></textarea></label>
      <label>Availability Rules (one per line)
        <textarea name="availabilityText" placeholder="Monday - Friday 10:00-15:00&#10;Saturday 09:00-12:00"></textarea>
      </label>
      <label>Room <input name="room" placeholder="e.g. Room 204" /></label>
      <label>Affiliated Hospitals / Clinics <input name="affiliatedClinics" placeholder="Clinic A, Hospital B" /></label>
      <label>Phone
        <input name="phone" inputmode="numeric" pattern="[0-9]{10,11}" maxlength="11" title="Use 10 or 11 digits" placeholder="e.g. 09171234567" />
        <small>Digits only, 10-11 numbers.</small>
      </label>
      <label>Receptionist Name <input name="receptionistName" placeholder="Front desk contact name" /></label>
      <label>Receptionist Phone
        <input name="receptionistPhone" inputmode="numeric" pattern="[0-9]{10,11}" maxlength="11" title="Use 10 or 11 digits" placeholder="e.g. 09171234567" />
        <small>Digits only, 10-11 numbers.</small>
      </label>
      <label>Receptionist Email <input name="receptionistEmail" type="email" placeholder="reception@clinic.com" /></label>
      <label>Address <input name="address" /></label>
      <label>Profile Photo
        <input name="photoFile" type="file" accept="image/*" />
      </label>
      <div id="doctor-photo-preview" class="feedback" style="display:none"></div>
      <div class="modal-form-actions">
        <button type="submit" class="btn btn-secondary btn-action-edit">${editId ? "Update" : "Add"}</button>
        <button type="button" class="btn btn-action-delete" onclick="window.closeDoctorForm()">Cancel</button>
      </div>
    </form>
  `;
  window.closeDoctorForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("doctor-form");
  enforcePhoneInputs(form);
  if (editId) {
    apiRequest(`${API_BASE}/doctors/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.firstName.value = data.firstName || "";
        form.lastName.value = data.lastName || "";
        form.email.value = data.email || "";
        form.specialty.value = data.specialty || "";
        form.bio.value = data.bio || "";
        form.availabilityText.value =
          data.availabilityText ||
          (Array.isArray(data.availability)
            ? data.availability
              .map((slot) =>
                slot.timeRange
                  ? `${slot.day || ""} ${slot.timeRange}`.trim()
                  : `${slot.day || ""} ${slot.startTime || ""}-${slot.endTime || ""}`.trim()
              )
              .join("\n")
            : "");
        form.room.value = data.room || "";
        form.affiliatedClinics.value =
          data.affiliatedClinics || "";
        form.phone.value = data.phone || "";
        form.receptionistName.value = data.receptionistName || "";
        form.receptionistPhone.value = data.receptionistPhone || "";
        form.receptionistEmail.value = data.receptionistEmail || "";
        form.address.value = data.address || "";
        if (data.photoUrl) {
          const preview = document.getElementById("doctor-photo-preview");
          preview.style.display = "block";
          preview.className = "feedback";
          preview.innerHTML = `<img src="${escapeHtml(data.photoUrl)}" alt="Current photo" class="doctor-avatar" /> Current profile photo`;
        }
      });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const doctor = Object.fromEntries(new FormData(form));
    const photoFile = form.photoFile?.files?.[0];
    if (photoFile) {
      doctor.photoFileData = await fileToDataUrl(photoFile);
    }
    const availability = (doctor.availabilityText || "")
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const match = row.match(/^(.+?)\s+(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})$/);
        if (match) {
          return {
            day: match[1].trim(),
            timeRange: match[2].replace(/\s+/g, ""),
            startTime: match[2].split("-")[0].trim(),
            endTime: match[2].split("-")[1].trim(),
            location: { clinicName: doctor.affiliatedClinics || "" },
          };
        }
        return {
          day: row,
          timeRange: "",
          startTime: "",
          endTime: "",
          location: { clinicName: doctor.affiliatedClinics || "" },
        };
      });
    const doctorPayload = {
      ...doctor,
      availability,
    };
    try {
      const res = await apiRequest(
        `${API_BASE}/doctors${editId ? "/" + editId : ""}`,
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(doctorPayload),
        }
      );
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Failed to save doctor"));
      }
      modal.style.display = "none";
      renderDoctors();
    } catch (err) {
      showToast(err.message, "error");
    }
  };
}

function editDoctor(id) {
  showDoctorForm(id);
}
async function deleteDoctor(id) {
  if (!(await showDangerConfirm("Delete this doctor?"))) return;
  try {
    const res = await apiRequest(`${API_BASE}/doctors/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete doctor");
    renderDoctors();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// --- Appointments ---
async function renderAppointments() {
  setPageTone("appointments");
  mainContent.innerHTML =
    '<h2 class="page-title page-title-appointments">Appointments</h2><div class="feedback">Loading...</div>';
  try {
    const [res, doctorRes, patientRes] = await Promise.all([
      apiRequest(`${API_BASE}/appointments`),
      apiRequest(`${API_BASE}/doctors`),
      apiRequest(`${API_BASE}/patients`),
    ]);
    if (!res.ok) throw new Error("Failed to fetch appointments");
    const appointments = await res.json();
    const doctors = doctorRes.ok ? await doctorRes.json() : [];
    const patients = patientRes.ok ? await patientRes.json() : [];
    const doctorLookup = new Map(
      doctors.map((doctor) => [
        String(doctor._id),
        `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim(),
      ])
    );
    const patientLookup = new Map(
      patients.map((patient) => [
        String(patient._id),
        `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
      ])
    );
    mainContent.innerHTML = `
      <h2 class="page-title page-title-appointments">Appointments</h2>
      <button class="cta-primary" onclick="window.showAppointmentForm()">Add Appointment</button>
      <hr class="section-divider" />
      <div class="list-filters">
        <input type="search" id="appt-filter-doctor" placeholder="Filter by doctor" />
        <input type="search" id="appt-filter-patient" placeholder="Filter by patient" />
        <input type="search" id="appt-filter-date" placeholder="Filter by date (YYYY-MM-DD)" />
        <input type="search" id="appt-filter-time" placeholder="Filter by time" />
        <input type="search" id="appt-filter-status" placeholder="Filter by status" />
      </div>
      <table>
        <thead><tr><th>Doctor</th><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="appointments-table-body"></tbody>
      </table>
      <div id="appointment-form-modal" style="display:none"></div>
    `;
    const bodyEl = document.getElementById("appointments-table-body");
    const renderRows = (list) => {
      bodyEl.innerHTML = list
        .map(
          (a) => `
            <tr>
              <td>${doctorLookup.get(String(a.doctor?._id || a.doctor)) || a.doctor || ""}</td>
              <td>${patientLookup.get(String(a.patient?._id || a.patient)) || a.patient || ""}</td>
              <td>${formatDateDisplay(a.date) || ""}</td>
              <td>${a.time || ""}</td>
              <td>${a.status || ""}</td>
              <td>
                <button class="btn btn-secondary btn-action-edit" onclick="window.editAppointment('${a._id
            }')">Edit</button>
                <button class="btn btn-action-delete" onclick="window.deleteAppointment('${a._id
            }')">Delete</button>
              </td>
            </tr>
          `
        )
        .join("");
    };
    const applyAppointmentFilters = () => {
      const doctorQ = String(document.getElementById("appt-filter-doctor")?.value || "").toLowerCase().trim();
      const patientQ = String(document.getElementById("appt-filter-patient")?.value || "").toLowerCase().trim();
      const dateQ = String(document.getElementById("appt-filter-date")?.value || "").toLowerCase().trim();
      const timeQ = String(document.getElementById("appt-filter-time")?.value || "").toLowerCase().trim();
      const statusQ = String(document.getElementById("appt-filter-status")?.value || "").toLowerCase().trim();
      const filtered = appointments.filter((a) => {
        const doctor = String(doctorLookup.get(String(a.doctor?._id || a.doctor)) || a.doctor || "").toLowerCase();
        const patient = String(patientLookup.get(String(a.patient?._id || a.patient)) || a.patient || "").toLowerCase();
        const date = formatDateForInput(a.date).toLowerCase();
        const time = String(a.time || "").toLowerCase();
        const status = String(a.status || "").toLowerCase();
        return (
          (!doctorQ || doctor.includes(doctorQ)) &&
          (!patientQ || patient.includes(patientQ)) &&
          (!dateQ || date.includes(dateQ)) &&
          (!timeQ || time.includes(timeQ)) &&
          (!statusQ || status.includes(statusQ))
        );
      });
      renderRows(filtered);
    };
    ["appt-filter-doctor", "appt-filter-patient", "appt-filter-date", "appt-filter-time", "appt-filter-status"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", applyAppointmentFilters);
    });
    renderRows(appointments);
    window.showAppointmentForm = showAppointmentForm;
    window.editAppointment = editAppointment;
    window.deleteAppointment = deleteAppointment;
  } catch (err) {
    mainContent.innerHTML = `<h2>Appointments</h2><div class="feedback error">${err.message}</div>`;
  }
}

async function showAppointmentForm(editId = null) {
  const modal = document.getElementById("appointment-form-modal");
  modal.style.display = "block";
  modal.innerHTML = `<div class="feedback">Loading form...</div>`;
  let doctors = [];
  let patients = [];
  try {
    const [doctorRes, patientRes] = await Promise.all([
      apiRequest(`${API_BASE}/doctors`),
      apiRequest(`${API_BASE}/patients`),
    ]);
    doctors = doctorRes.ok ? await doctorRes.json() : [];
    patients = patientRes.ok ? await patientRes.json() : [];
  } catch (error) {
    modal.innerHTML = `<div class="feedback error">Failed to load doctors and patients.</div>`;
    return;
  }

  const doctorOptions = doctors
    .map((doctor) => {
      const fullName = `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim();
      const specialty = doctor.specialty || "No specialty";
      const availability = buildDoctorAvailabilityLabel(doctor);
      return `<option value="${doctor._id}">${fullName} - ${specialty} (${availability})</option>`;
    })
    .join("");

  const patientOptions = patients
    .map((patient) => {
      const fullName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
      return `<option value="${patient._id}">${fullName} (${patient.email || "No email"})</option>`;
    })
    .join("");

  modal.innerHTML = `
    <form id="appointment-form">
      <h3>${editId ? "Edit" : "Add"} Appointment</h3>
      <label>Doctor
        <select name="doctor" required>
          <option value="">Select doctor</option>
          ${doctorOptions}
        </select>
      </label>
      <label>Patient
        <select name="patient" required>
          <option value="">Select patient</option>
          ${patientOptions}
        </select>
      </label>
      <label>Date <input name="date" type="date" required /></label>
      <label>Time <input name="time" type="time" required /></label>
      <label>Status
        <select name="status">
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <label>Notes <textarea name="notes"></textarea></label>
      <div class="modal-form-actions">
        <button type="submit" class="btn btn-secondary btn-action-edit">${editId ? "Update" : "Add"}</button>
        <button type="button" class="btn btn-action-delete" onclick="window.closeAppointmentForm()">Cancel</button>
      </div>
    </form>
  `;
  window.closeAppointmentForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("appointment-form");
  if (editId) {
    try {
      const res = await apiRequest(`${API_BASE}/appointments/${editId}`);
      const data = await res.json();
      form.doctor.value = data.doctor?._id || data.doctor || "";
      form.patient.value = data.patient?._id || data.patient || "";
      form.date.value = formatDateForInput(data.date);
      form.time.value = data.time || "";
      form.status.value = data.status || "pending";
      form.notes.value = data.notes || data.reason || "";
    } catch (error) {
      console.error(error);
    }
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const appointment = Object.fromEntries(new FormData(form));
    try {
      const res = await apiRequest(
        `${API_BASE}/appointments${editId ? "/" + editId : ""}`,
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appointment),
        }
      );
      if (!res.ok) throw new Error("Failed to save appointment");
      modal.style.display = "none";
      renderAppointments();
    } catch (err) {
      showToast(err.message, "error");
    }
  };
}

function editAppointment(id) {
  showAppointmentForm(id);
}
async function deleteAppointment(id) {
  if (!(await showDangerConfirm("Delete this appointment?"))) return;
  try {
    const res = await apiRequest(`${API_BASE}/appointments/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete appointment");
    renderAppointments();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// --- Users ---
async function renderUsers() {
  setPageTone("users");
  mainContent.innerHTML =
    '<h2 class="page-title page-title-users">Users</h2><div class="feedback">Loading...</div>';
  try {
    const role = getCurrentUserRole();
    const currentUserId = getCurrentUserId();
    let users = [];
    if (role === "patient" && currentUserId) {
      const ownRes = await apiRequest(`${API_BASE}/users/${currentUserId}`);
      if (!ownRes.ok) throw new Error("Failed to fetch active profile");
      const ownUser = await ownRes.json();
      users = ownUser ? [ownUser] : [];
    } else {
      const res = await apiRequest(`${API_BASE}/users`);
      if (!res.ok) throw new Error("Failed to fetch users");
      users = await res.json();
    }
    mainContent.innerHTML = `
      <h2 class="page-title page-title-users">Users</h2>
      <button class="cta-primary" onclick="window.showUserForm()">Add User</button>
      <hr class="section-divider" />
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Actions</th></tr></thead>
        <tbody>
          ${users
        .map(
          (u) => `
            <tr>
              <td>${u.title ? `${u.title} ` : ""}${u.firstName} ${u.lastName}</td>
              <td>${u.email || ""}</td>
              <td>${u.role || ""}</td>
              <td>${u.phone || ""}</td>
              <td>
                <button class="btn btn-secondary btn-action-edit" onclick="window.editUser('${u._id}')">Edit</button>
                <button class="btn btn-action-delete" onclick="window.deleteUser('${u._id}')">Delete</button>
              </td>
            </tr>
          `
        )
        .join("")}
        </tbody>
      </table>
      <div id="user-form-modal" style="display:none"></div>
    `;
    window.showUserForm = showUserForm;
    window.editUser = editUser;
    window.deleteUser = deleteUser;
  } catch (err) {
    mainContent.innerHTML = `<h2>Users</h2><div class="feedback error">${err.message}</div>`;
  }
}

function showUserForm(editId = null) {
  const modal = document.getElementById("user-form-modal");
  modal.style.display = "block";
  modal.innerHTML = `
    <form id="user-form">
      <h3>${editId ? "Edit" : "Add"} User</h3>
      <label>First Name <input name="firstName" required /></label>
      <label>Last Name <input name="lastName" required /></label>
      <label>Email <input name="email" type="email" required /></label>
      <label>Title
        <select name="title">
          <option value="">(blank)</option>
          <option value="Mr.">Mr.</option>
          <option value="Ms.">Ms.</option>
          <option value="Mrs.">Mrs.</option>
          <option value="Dr.">Dr.</option>
          <option value="Dra.">Dra.</option>
        </select>
      </label>
      <label>Role
        <select name="role" required>
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="receptionist">Receptionist</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label id="user-specialty-wrap">Specialty <input name="specialty" list="doctor-specialties-user" placeholder="Used when role is doctor" /></label>
      <datalist id="doctor-specialties-user">
        ${[...new Set(DOCTOR_SPECIALTIES)].map((s) => `<option value="${s}"></option>`).join("")}
      </datalist>
      <label>Phone
        <input name="phone" inputmode="numeric" pattern="[0-9]{10,11}" maxlength="11" title="Use 10 or 11 digits" placeholder="e.g. 09171234567" />
        <small>Digits only, 10-11 numbers.</small>
      </label>
      <label>Address <input name="address" /></label>
      <div class="modal-form-actions">
        <button type="submit" class="btn btn-secondary btn-action-edit">${editId ? "Update" : "Add"}</button>
        <button type="button" class="btn btn-action-delete" onclick="window.closeUserForm()">Cancel</button>
      </div>
    </form>
  `;
  window.closeUserForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("user-form");
  enforcePhoneInputs(form);
  const specialtyWrap = form.querySelector("#user-specialty-wrap");
  const roleSelect = form.querySelector('select[name="role"]');
  const syncSpecialtyVisibility = () => {
    const isDoctorRole = String(roleSelect?.value || "").toLowerCase() === "doctor";
    specialtyWrap.style.display = isDoctorRole ? "" : "none";
  };
  roleSelect?.addEventListener("change", syncSpecialtyVisibility);
  if (editId) {
    apiRequest(`${API_BASE}/users/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.firstName.value = data.firstName || "";
        form.lastName.value = data.lastName || "";
        form.email.value = data.email || "";
        form.title.value = data.title || "";
        form.role.value = data.role || "patient";
        form.specialty.value = data.specialty || "";
        form.phone.value = data.phone || "";
        form.address.value = data.address || "";
        syncSpecialtyVisibility();
      });
  } else {
    syncSpecialtyVisibility();
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const user = Object.fromEntries(new FormData(form));
    try {
      const res = await apiRequest(
        `${API_BASE}/users${editId ? "/" + editId : ""}`,
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        }
      );
      if (!res.ok) throw new Error("Failed to save user");
      modal.style.display = "none";
      renderUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  };
}

function editUser(id) {
  showUserForm(id);
}
async function deleteUser(id) {
  if (!(await showDangerConfirm("Delete this user?"))) return;
  try {
    const res = await apiRequest(`${API_BASE}/users/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete user");
    renderUsers();
  } catch (err) {
    showToast(err.message, "error");
  }
}
