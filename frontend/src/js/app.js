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
const commandPaletteTrigger = document.getElementById(
  "command-palette-trigger",
);
const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const API_ORIGIN = isLocalHost
  ? "http://localhost:3001"
  : "https://drmeet-wqws.onrender.com";
const API_BASE = `${API_ORIGIN}/api`;
const DASHBOARD_STATE_KEY = "drmeet-dashboard-state";
const USER_CACHE_KEY = "drmeet-user-cache";
const THEME_KEY = "drmeet-theme";
const DOCTOR_OVERVIEW_CACHE_KEY = "drmeet-doctor-overview";
const DOCTOR_OVERVIEW_TTL_MS = 45000;
const DASH_TAG_HOME = "home";
const DASH_TAG_FLOAT = "float";
const MESSAGES_API = `${API_BASE}/messages`;
const DEFAULT_AVATAR_URL = "images/user-line.svg";
/** Chat composer file-picker icon (matches sidebar asset path). */
const CHAT_UPLOAD_ICON_SRC = "images/chat-upload-line.svg";
const CHAT_SEND_ICON_SRC = "images/send-plane-2-line.svg";

/** Mirrors backend `payments.json` so Clinical billing dropdowns work offline or if the API fails. */
const PAYMENT_METHOD_CATEGORIES_FALLBACK = [
  {
    category: "cash",
    methods: ["Cash (Philippine Peso)", "Cash Deposit (Bank Counter)"],
  },
  {
    category: "card",
    methods: [
      "Credit Card - Visa",
      "Credit Card - Mastercard",
      "Credit Card - JCB",
      "Credit Card - American Express",
      "Debit Card - Visa",
      "Debit Card - Mastercard",
      "Contactless Card (Tap to Pay / NFC)",
    ],
  },
  {
    category: "ewallet",
    methods: ["GCash", "Maya (PayMaya)", "GrabPay", "ShopeePay", "GoTyme Pay"],
  },
  {
    category: "qr",
    methods: ["QR Ph (National Standard)", "Bank QR", "GCash QR", "Maya QR"],
  },
  {
    category: "bank_transfer",
    methods: [
      "InstaPay",
      "PESONet",
      "Bank Transfer",
      "BPI Transfer",
      "BDO Transfer",
      "Metrobank Transfer",
      "UnionBank Transfer",
      "Security Bank Transfer",
      "RCBC Transfer",
      "LandBank Transfer",
    ],
  },
  {
    category: "payment_gateway",
    methods: [
      "PayMongo",
      "Xendit",
      "DragonPay",
      "HitPay",
      "Payment Link (Email/SMS Invoice)",
    ],
  },
  {
    category: "insurance",
    methods: [
      "HMO Coverage",
      "PhilHealth",
      "Private Health Insurance",
      "Guarantee Letter (GL)",
      "HMO Co-pay",
    ],
  },
  {
    category: "financing",
    methods: ["Home Credit", "BillEase", "SPayLater", "LazPayLater"],
  },
  {
    category: "government_assistance",
    methods: ["PCSO Assistance", "LGU Medical Assistance"],
  },
];

/** When billing payment method is one of these, show the HMO / insurance fields. */
const CLINICAL_HMO_PAYMENT_METHODS = new Set(["HMO Coverage", "HMO Co-pay"]);
const dashboardSubscribers = [];
const dashboardState = {
  conversations: [],
  activeConversationId: "",
  messages: [],
  typingByConversation: {},
  websocketActive: false,
  socketReconnecting: false,
  socketAwaitingFirstConnect: true,
  conversationSearchFilter: "",
};

let authSessionExpired = false;

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
  "Family Medicine",
  "Fam Med",
  "General Practice",
  "GP",
  "Internal Medicine",
  "IM",
  "Internist",
  "Pediatrics",
  "Pedia",
  "Emergency Medicine",
  "ER",
  "Geriatric Medicine",
  "Geriatrics",
  "Cardiology",
  "Cardio",
  "Endocrinology, Diabetes & Metabolism",
  "Endocrinology",
  "Gastroenterology",
  "GI",
  "Hepatology",
  "Liver Specialist",
  "Infectious Diseases",
  "ID",
  "Nephrology",
  "Kidney Specialist",
  "Pulmonology",
  "Pulmo",
  "Rheumatology",
  "Rheuma",
  "Allergy & Immunology",
  "Allergist",
  "Hematology",
  "Hema",
  "Medical Oncology",
  "Onco",
  "Clinical Pharmacology",
  "General Surgery",
  "GS",
  "Colorectal Surgery",
  "Hepatobiliary & Pancreatic Surgery",
  "HPB Surgery",
  "Breast Surgery",
  "Minimally Invasive / Laparoscopic Surgery",
  "MIS",
  "Orthopedic Surgery",
  "Ortho",
  "Neurosurgery",
  "Neuro Surgery",
  "Cardiothoracic Surgery",
  "CTS",
  "Vascular Surgery",
  "Plastic & Reconstructive Surgery",
  "Plastic Surgery",
  "Hand Surgery",
  "Urology",
  "Uro",
  "Obstetrics and Gynecology",
  "OB-GYN",
  "OB",
  "Maternal-Fetal Medicine",
  "High-Risk Pregnancy",
  "Reproductive Endocrinology & Infertility",
  "Fertility Specialist",
  "Gynecologic Oncology",
  "Gyne Onco",
  "Urogynecology",
  "Neonatology",
  "NICU",
  "Pediatric Cardiology",
  "Pediatric Pulmonology",
  "Pediatric Nephrology",
  "Pediatric Gastroenterology",
  "Pediatric Endocrinology",
  "Pediatric Hematology-Oncology",
  "Pedia Onco",
  "Pediatric Infectious Diseases",
  "Pediatric Neurology",
  "Developmental & Behavioral Pediatrics",
  "Dev Peds",
  "Neurology",
  "Neuro",
  "Psychiatry",
  "Psych",
  "Child & Adolescent Psychiatry",
  "Addiction Medicine",
  "Ophthalmology",
  "Eye Specialist",
  "Otolaryngology – Head and Neck Surgery",
  "ENT",
  "Dermatology",
  "Derma",
  "Cosmetic Dermatology / Aesthetic Medicine",
  "Aesthetic",
  "Radiology",
  "Diagnostic Radiology",
  "Interventional Radiology",
  "IR",
  "Pathology",
  "Lab Medicine",
  "Nuclear Medicine",
  "Anesthesiology",
  "Anesthesia",
  "Physical Medicine & Rehabilitation",
  "Physiatry",
  "Rehab Med",
  "Pain Medicine",
  "Pain Management",
  "Palliative Medicine",
  "Hospice Care",
  "Occupational Medicine",
  "Occ Med",
  "Sports Medicine",
  "Lifestyle Medicine",
  "Preventive Medicine",
  "Physical Therapy",
  "PT",
  "Occupational Therapy",
  "OT",
  "Speech-Language Pathology",
  "Speech Therapy",
  "Clinical Psychology",
  "Nutrition & Dietetics",
  "Dietitian",
  "Respiratory Therapy",
  "RT",
];

function normalizeFetchErrorMessage(err, fallbackMessage) {
  const message = String(err?.message || "");
  if (
    message.toLowerCase().includes("failed to fetch") ||
    err instanceof TypeError
  ) {
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
    googleAuthState.feedbackEl.className = isError
      ? "feedback error"
      : "feedback";
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
    session_error:
      "Google login failed while creating your session. Please try again.",
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

function parseDoctorDashboardTab() {
  const raw = window.location.hash || "";
  const qIdx = raw.indexOf("?");
  const qs = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
  const params = new URLSearchParams(qs);
  const tab = String(params.get("tab") || "overview").toLowerCase();
  const allowed = new Set([
    "overview",
    "patients",
    "appointments",
    "documents",
    "settings",
    "billing",
  ]);
  return allowed.has(tab) ? tab : "overview";
}

function setDoctorDashboardHashTab(tab) {
  window.location.hash = `#doctor-dashboard?tab=${encodeURIComponent(tab)}`;
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
  dashboardState.typingByConversation = {};
}

function buildHeaders(baseHeaders = {}) {
  const token = localStorage.getItem("token");
  return token
    ? { ...baseHeaders, Authorization: `Bearer ${token}` }
    : { ...baseHeaders };
}

function showSessionExpiredBanner() {
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
      authSessionExpired = false;
      el.hidden = true;
      el.innerHTML = "";
      resetMessagingSocket();
      updateAuthNav();
    },
  );
}

function clearSessionExpiredState() {
  authSessionExpired = false;
  const el = document.getElementById("session-expired-banner");
  if (el) {
    el.hidden = true;
    el.innerHTML = "";
  }
}

async function apiRequest(url, options = {}) {
  const urlStr = typeof url === "string" ? url : "";
  const skipAuthBlock =
    /\/auth\/(login|signup|status)/.test(urlStr) ||
    urlStr.includes("/auth/google");
  if (authSessionExpired && !skipAuthBlock) {
    return new Response(JSON.stringify({ error: "Session expired.", code: "TOKEN_EXPIRED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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
        authSessionExpired = true;
        showSessionExpiredBanner();
      }
    } catch (e) {
      /* ignore */
    }
  }
  return res;
}

async function getApiErrorMessage(res, fallbackMessage) {
  try {
    const payload = await res.json();
    if (payload?.error) return payload.error;
    if (Array.isArray(payload?.missingFields) && payload.missingFields.length) {
      return `Missing required fields: ${payload.missingFields.join(", ")}`;
    }
    if (Array.isArray(payload?.errors) && payload.errors.length) {
      return payload.errors
        .map((item) => item.msg || item.message)
        .filter(Boolean)
        .join(", ");
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
        : `${slot.day || "Day"} ${slot.startTime || "--:--"}-${slot.endTime || "--:--"}`,
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
  window.addEventListener("message", handleGoogleAuthMessage);
});

function setupShellInteractions() {
  if (!sidebarToggle || !sidebar) return;
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
  sidebarUserTrigger?.addEventListener("click", () => {});
  sidebarLogoutBtn?.addEventListener("click", () => {
    if (window.__drmeetMessagePoll) {
      clearInterval(window.__drmeetMessagePoll);
      window.__drmeetMessagePoll = null;
    }
    localStorage.removeItem("token");
    localStorage.removeItem(USER_CACHE_KEY);
    clearSessionExpiredState();
    resetMessagingSocket();
    updateAuthNav();
    if (sidebarUserPopover) sidebarUserPopover.classList.remove("hidden");
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
    if (
      event.key === "Escape" &&
      !commandPalette.classList.contains("hidden")
    ) {
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
      {
        id: "book",
        label: "Book a visit (patients)",
        action: () => navigateTo("#book"),
      },
    ];
  }
  const staticCommands = [
    { id: "home", label: "Go to Home", action: () => navigateTo("#home") },
    {
      id: "book",
      label: "Book a visit (patients)",
      action: () => navigateTo("#book"),
    },
    {
      id: "patients",
      label: "Go to Patients",
      action: () => navigateTo("#patients"),
    },
    {
      id: "doctors",
      label: "Go to Doctors",
      action: () => navigateTo("#doctors"),
    },
    {
      id: "appointments",
      label: "Go to Appointments",
      action: () => navigateTo("#appointments"),
    },
    { id: "users", label: "Go to Users", action: () => navigateTo("#users") },
    {
      id: "settings",
      label: "Go to Settings",
      action: () => navigateTo("#settings"),
    },
  ];
  if (getCurrentUserRole() === "doctor") {
    staticCommands.splice(1, 0, {
      id: "doctor-dashboard",
      label: "Clinical dashboard",
      action: () => navigateTo("#doctor-dashboard"),
    });
  }
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
    item.label.toLowerCase().includes(query),
  );
  commandResults.innerHTML =
    matches
      .map(
        (item) =>
          `<li><button type="button" data-command-id="${item.id}" class="command-item">${item.label}</button></li>`,
      )
      .join("") || '<li class="empty">No matches found.</li>';
  commandResults.querySelectorAll("[data-command-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = matches.find(
        (entry) => entry.id === button.dataset.commandId,
      );
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
    { hash: "#doctor-dashboard", label: "Clinical" },
    { hash: "#book", label: "Book" },
    { hash: "#patients", label: "Patients" },
    { hash: "#doctors", label: "Doctors" },
    { hash: "#appointments", label: "Appointments" },
    { hash: "#users", label: "Users" },
    { hash: "#settings", label: "Settings" },
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
    const parsed = JSON.parse(
      localStorage.getItem(DASHBOARD_STATE_KEY) || "{}",
    );
    if (Array.isArray(parsed.conversations))
      dashboardState.conversations = parsed.conversations;
    if (typeof parsed.activeConversationId === "string")
      dashboardState.activeConversationId = parsed.activeConversationId;
    if (Array.isArray(parsed.messages))
      dashboardState.messages = parsed.messages;
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

function pruneDashboardSubscribers(tag) {
  for (let i = dashboardSubscribers.length - 1; i >= 0; i--) {
    if (dashboardSubscribers[i]._dashTag === tag) {
      dashboardSubscribers.splice(i, 1);
    }
  }
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

function sortPatientsByCreated(list, order) {
  const arr = [...list];
  arr.sort((a, b) => {
    const ta = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return order === "oldest" ? ta - tb : tb - ta;
  });
  return arr;
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
      receptionistType: payload?.receptionistType || "",
      cachedAt: Date.now(),
    }),
  );
}

function getCurrentReceptionistType() {
  try {
    const cached = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "{}");
    return String(cached?.receptionistType || "").toLowerCase();
  } catch (error) {
    return "";
  }
}

async function refreshCurrentUserCacheFromApi() {
  const id = getCurrentUserId();
  if (!id) return;
  try {
    const res = await apiRequest(`${API_BASE}/users/${id}`);
    if (!res.ok) return;
    const user = await res.json();
    localStorage.setItem(
      USER_CACHE_KEY,
      JSON.stringify({
        _id: user?._id || id,
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        role: user?.role || "",
        linkedDoctorId: user?.linkedDoctorId || "",
        receptionistType: user?.receptionistType || "",
        cachedAt: Date.now(),
      }),
    );
  } catch (error) {
    // non-blocking
  }
}

function rowsToCsv(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const body = rows
    .map((row) => headers.map((h) => escape(row[h])).join(","))
    .join("\n");
  return `${headers.join(",")}\n${body}`;
}

function downloadCsv(filename, rows = []) {
  const csv = rowsToCsv(rows);
  if (!csv) {
    showToast("No rows to export.", "error");
    return;
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
  if (sidebarAvatarCircle)
    sidebarAvatarCircle.textContent = signedIn ? initial : "U";
  if (sidebarAvatarName)
    sidebarAvatarName.textContent = signedIn
      ? fullName || "My Account"
      : "My Account";
  if (sidebarAccountMeta) {
    sidebarAccountMeta.innerHTML = signedIn
      ? `<strong>${escapeHtml(fullName || "User")}</strong>
     <span class="role-label">${escapeHtml(roleLabel)}</span>`
      : "Not signed in";
  }
}

function participantAvatarUrl(participant) {
  const raw = String(
    participant?.avatarUrl || participant?.picture || "",
  ).trim();
  return raw || DEFAULT_AVATAR_URL;
}

function participantDisplayName(participant) {
  return participant
    ? `${participant.firstName || ""} ${participant.lastName || ""}`.trim()
    : "Conversation";
}

function conversationTypingLabel(conversationId, currentUserId) {
  const typingSet =
    dashboardState.typingByConversation?.[String(conversationId)];
  if (!typingSet || !(typingSet instanceof Set) || !typingSet.size) return "";
  const othersTyping = [...typingSet].some(
    (id) => String(id) !== String(currentUserId || ""),
  );
  return othersTyping ? "Typing..." : "";
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
      <div class="card danger-modal modal-card-with-close">
        <button type="button" class="modal-close-x" aria-label="Close" id="danger-confirm-close">&times;</button>
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
    modal
      .querySelector("#danger-confirm-ok")
      ?.addEventListener("click", () => close(true));
    modal
      .querySelector("#danger-confirm-cancel")
      ?.addEventListener("click", () => close(false));
    modal
      .querySelector("#danger-confirm-close")
      ?.addEventListener("click", () => close(false));
  });
}

function enforcePhoneInputs(scope = document) {
  const inputs = scope.querySelectorAll(
    'input[name="phone"], input[name="receptionistPhone"]',
  );
  inputs.forEach((input) => {
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("maxlength", "11");
    input.setAttribute("pattern", "[0-9]{10,11}");
    input.addEventListener("input", () => {
      const cleaned = String(input.value || "")
        .replace(/\D+/g, "")
        .slice(0, 11);
      input.value = cleaned;
    });
  });
}

function addInlineTooltips(scope = document) {
  scope.querySelectorAll("[data-tooltip]").forEach((node) => {
    if (node.querySelector(".info-tooltip-trigger")) return;
    const content = String(node.getAttribute("data-tooltip") || "").trim();
    if (!content) return;
    const trigger = document.createElement("span");
    trigger.className = "info-tooltip-trigger";
    trigger.tabIndex = 0;
    trigger.setAttribute("title", content);
    trigger.setAttribute("aria-label", `Info: ${content}`);
    trigger.innerHTML = `
      <img src="images/info-i.svg" alt="" class="info-tooltip-icon" role="presentation" />
      <span class="info-tooltip-bubble" role="tooltip">${escapeHtml(content)}</span>
    `;
    node.appendChild(trigger);
  });
}

function attachClearButtons(scope = document) {
  const fields = scope.querySelectorAll(
    'input[type="text"], input[type="email"], input[type="search"], input[type="password"], input[type="date"], input[type="time"], textarea, select',
  );
  fields.forEach((field) => {
    if (field.closest(".field-input-wrap")) return;
    const wrap = document.createElement("span");
    wrap.className = "field-input-wrap";
    field.parentNode.insertBefore(wrap, field);
    wrap.appendChild(field);
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "field-clear-btn";
    clearBtn.setAttribute("aria-label", `Clear ${field.name || "field"}`);
    clearBtn.textContent = "×";
    wrap.appendChild(clearBtn);

    const syncVisibility = () => {
      const hasValue = String(field.value || "").trim().length > 0;
      clearBtn.classList.toggle("visible", hasValue);
    };
    clearBtn.addEventListener("click", () => {
      if (field.tagName === "SELECT") {
        field.selectedIndex = 0;
      } else {
        field.value = "";
      }
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      syncVisibility();
      field.focus();
    });
    field.addEventListener("input", syncVisibility);
    field.addEventListener("change", syncVisibility);
    syncVisibility();
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

async function sendDocumentMessage({
  conversationId = "",
  patientId = "",
  doctorId = "",
  text = "",
  file,
}) {
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
  const needle = String(q || "")
    .trim()
    .toLowerCase();
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
    dashboardState.conversations = Array.isArray(data?.conversations)
      ? data.conversations
      : [];

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
    dashboardState.messages = Array.isArray(data?.messages)
      ? data.messages
      : [];

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
    },
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
  let conversationId =
    options.conversationId || dashboardState.activeConversationId;

  const userId = getCurrentUserId();
  const role = getCurrentUserRole();

  if (!userId) {
    throw new Error("You must be logged in to send a message.");
  }

  if (!conversationId) {
    if (role !== "patient" && !(options.patientId && options.doctorId)) {
      throw new Error("Select a conversation before sending a message.");
    }
    const doctorId =
      options.doctorId || (await resolveDoctorIdForPatientMessaging());
    const patientId = options.patientId || userId;
    if (!doctorId) {
      throw new Error(
        "No assigned doctor found. Book an appointment first so messaging can be enabled.",
      );
    }
    const createdConversationId = await createOrGetConversation(
      patientId,
      doctorId,
    );

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
    data?.conversationId || conversationId,
  );

  if (data?.message) {
    dashboardState.messages = [...dashboardState.messages, data.message];
  }

  const idx = dashboardState.conversations.findIndex(
    (c) => String(c._id) === String(conversationId),
  );

  if (idx !== -1 && data?.conversation) {
    dashboardState.conversations[idx] = data.conversation;
  }

  persistDashboardState();
  notifyDashboardSubscribers();

  const cid = dashboardState.activeConversationId;
  if (cid) {
    await loadMessages(cid);
  }
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
    const isActive =
      String(dashboardState.activeConversationId) === conversationId;
    const typingSet = dashboardState.typingByConversation?.[conversationId];
    if (typingSet instanceof Set) typingSet.clear();

    // Update conversation preview (last message + sorting).
    const idx = dashboardState.conversations.findIndex(
      (c) => String(c._id) === conversationId,
    );
    if (idx !== -1) {
      dashboardState.conversations[idx] = {
        ...dashboardState.conversations[idx],
        lastMessage:
          msg?.message || dashboardState.conversations[idx].lastMessage,
        lastMessageAt:
          msg?.createdAt || dashboardState.conversations[idx].lastMessageAt,
      };
    }

    if (isActive) {
      // Avoid duplicates by message id when possible.
      const incomingId = msg?._id || msg?.id;
      const alreadyExists =
        incomingId &&
        dashboardState.messages.some(
          (m) => String(m._id || m.id) === String(incomingId),
        );
      if (!alreadyExists)
        dashboardState.messages = [...dashboardState.messages, msg];

      // Keep read receipts current for open conversations.
      try {
        await apiRequest(
          `${MESSAGES_API}/conversations/${conversationId}/read`,
          { method: "POST" },
        );
      } catch (e) {
        // ignore
      }
    }

    persistDashboardState();
    notifyDashboardSubscribers();
  });

  socket.on("typing:update", (payload = {}) => {
    const conversationId = String(payload.conversationId || "");
    const fromUserId = String(payload.userId || "");
    if (!conversationId || !fromUserId) return;
    if (!dashboardState.typingByConversation[conversationId]) {
      dashboardState.typingByConversation[conversationId] = new Set();
    }
    const set = dashboardState.typingByConversation[conversationId];
    if (payload.typing) set.add(fromUserId);
    else set.delete(fromUserId);
    notifyDashboardSubscribers();
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
  panel.innerHTML = `<p class="feedback clinical-loading">Loading…</p>`;

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
      document.getElementById("clinical-refresh-overview")?.addEventListener("click", async () => {
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
      const url = new URL(`${API_BASE}/doctors/me/patients`, window.location.origin);
      if (q) url.searchParams.set("q", q);
      const res = await apiRequest(url.toString());
      if (!res.ok)
        throw new Error(await getApiErrorMessage(res, "Unable to load patients."));
      const payload = await res.json();
      const rows = Array.isArray(payload.patients) ? payload.patients : [];
      panel.innerHTML = `
        <label class="clinical-search-label">Search patients
          <input type="search" id="clinical-patient-search" class="clinical-search-input" placeholder="Name or email" value="${escapeHtml(q)}" />
        </label>
        <ul class="clinical-patient-list">
          ${rows.length ? rows.map((p) => `
            <li class="clinical-patient-row card">
              <div>
                <strong>${escapeHtml(`${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient")}</strong>
                <p class="clinical-muted">${escapeHtml(p.email || "")} · ${escapeHtml(p.phone || "")}</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm clinical-patient-quick" data-patient-quick="${escapeHtml(String(p._id))}">Quick view</button>
            </li>`).join("") : `<li class="feedback">No patients match your assignment yet.</li>`}
        </ul>
      `;
      const search = document.getElementById("clinical-patient-search");
      search?.addEventListener("change", () => {
        void showClinicalTab("patients");
      });
      search?.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          void showClinicalTab("patients");
        }
      });
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
      const res = await apiRequest(`${API_BASE}/doctors/me/appointments?scope=all`);
      if (!res.ok)
        throw new Error(await getApiErrorMessage(res, "Unable to load appointments."));
      const payload = await res.json();
      const upcoming = Array.isArray(payload.upcoming) ? payload.upcoming : [];
      const past = Array.isArray(payload.past) ? payload.past : [];

      const renderApptRow = (a) => {
        const pname =
          typeof a.patientId === "object" && a.patientId?.name
            ? a.patientId.name
            : "";
        const dt = a.date ? new Date(a.date).toLocaleString() : "";
        const statusOpts = ["pending", "confirmed", "completed", "cancelled"]
          .map(
            (st) =>
              `<option value="${st}" ${String(a.status) === st ? "selected" : ""}>${st}</option>`,
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
              throw new Error(await getApiErrorMessage(resAp, "Update failed."));
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
        throw new Error(await getApiErrorMessage(res, "Unable to load documents."));
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
          const label = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient";
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
          ${docs.length ? docs.map((d) => `
            <li class="card clinical-doc-row">
              <div>
                <strong>${escapeHtml(d.name || "Document")}</strong>
                <p class="clinical-muted">${escapeHtml(d.source === "patient" ? "Patient chart" : d.source === "clinic" ? "Clinic library" : d.source || "—")}${d.patientName ? ` · ${escapeHtml(d.patientName)}` : ""}</p>
                <p class="clinical-muted">${d.uploadedAt ? escapeHtml(new Date(d.uploadedAt).toLocaleString()) : ""}</p>
              </div>
              <a class="btn btn-secondary btn-sm" href="${escapeHtml(d.fileUrl || d.url || "#")}" target="_blank" rel="noopener noreferrer">Open</a>
            </li>`).join("") : `<li class="feedback">No documents yet.</li>`}
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

      document.getElementById("clinical-doc-upload")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const form = ev.target;
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
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result?.split?.(",")?.[1];
            if (!base64) throw new Error("Unable to read file.");
            const body = {
              scope,
              patientId: scope === "patient" ? patientId : "",
              documentName: fd.get("documentName"),
              documentFileData: base64,
            };
            const resUp = await apiRequest(`${API_BASE}/doctors/me/documents`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!resUp.ok)
              throw new Error(await getApiErrorMessage(resUp, "Upload failed."));
            showToast("Document uploaded.");
            sessionStorage.removeItem(DOCTOR_OVERVIEW_CACHE_KEY);
            await showClinicalTab("documents");
          } catch (err) {
            showToast(err?.message || "Upload failed.", "error");
          }
        };
        reader.readAsDataURL(file);
      });
      doctorDashUI.loaded.documents = true;
      return;
    }

    if (tab === "settings") {
      const res = await apiRequest(`${API_BASE}/doctors/me/overview`);
      if (!res.ok)
        throw new Error(await getApiErrorMessage(res, "Unable to load settings."));
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
      document.getElementById("clinical-save-prefs")?.addEventListener("click", async () => {
        const emailAppointments = document.getElementById("clinical-pref-appt")?.checked ?? true;
        const emailMessages = document.getElementById("clinical-pref-msg")?.checked ?? true;
        try {
          const resP = await apiRequest(`${API_BASE}/doctors/me/notification-prefs`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailAppointments, emailMessages }),
          });
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
      const res = await apiRequest(`${API_BASE}/doctors/me/appointments?scope=all`);
      if (!res.ok)
        throw new Error(await getApiErrorMessage(res, "Unable to load visits."));
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
        typeof a.patientId === "object" && a.patientId?.name
          ? a.patientId.name
          : "Patient";

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
                ${rows.length ? rows.map((a) => {
                  const b = a.billing || {};
                  const dt = a.date ? escapeHtml(new Date(a.date).toLocaleString()) : "—";
                  return `<tr>
                    <td>${dt}</td>
                    <td>${escapeHtml(pname(a))}</td>
                    <td>${escapeHtml(String(b.consultationFee ?? 0))}</td>
                    <td>${escapeHtml(String(b.totalAmount ?? 0))}</td>
                    <td>${escapeHtml(String(b.paymentStatus || "unpaid"))}</td>
                    <td>${escapeHtml(String(b.hmoProvider || "—"))}</td>
                    <td>${escapeHtml(String(b.hmoCoverageStatus || "—"))}</td>
                    <td>${escapeHtml(String(b.hmoClaimStatus || "—"))}</td>
                    <td><button type="button" class="btn btn-secondary btn-sm clinical-billing-edit" data-appt-id="${escapeHtml(String(a._id))}">Edit</button></td>
                  </tr>`;
                }).join("") : `<tr><td colspan="9" class="clinical-muted">No appointments yet.</td></tr>`}
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
          hmoOptions = list.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
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
            : [{ description: "", amount: 0 }, { description: "", amount: 0 }];
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
          paymentCategories.find((c) => c.category === initialCat) || paymentCategories[0] || {};
        const methodsList = Array.isArray(activeGroup.methods) ? activeGroup.methods : [];
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
            <form id="clinical-billing-form" class="clinical-billing-form">
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
                <input type="file" data-billing-doc-kind accept=".pdf,.png,.jpg,.jpeg,.webp" />
              </label>
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
            ...methods.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`),
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

        dlg.querySelector("[data-billing-doc-kind]")?.addEventListener("change", async (ev) => {
          const input = ev.target;
          const file = input.files?.[0];
          if (!file) return;
          const kind = String(
            dlg.querySelector("#clinical-billing-doc-kind-sel")?.value || "claim",
          ).toLowerCase();
          if (!["soa", "invoice", "claim"].includes(kind)) {
            showToast("Invalid document type.", "error");
            input.value = "";
            return;
          }
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64 = reader.result?.split?.(",")?.[1];
              if (!base64) throw new Error("Unable to read file.");
              const resUp = await apiRequest(
                `${API_BASE}/doctors/me/appointments/${appt._id}/billing/documents`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    kind,
                    documentName: file.name,
                    documentFileData: base64,
                  }),
                },
              );
              if (!resUp.ok)
                throw new Error(await getApiErrorMessage(resUp, "Upload failed."));
              showToast("Document uploaded.");
              dlg.close();
              await showClinicalTab("billing");
            } catch (err) {
              showToast(err?.message || "Upload failed.", "error");
            }
          };
          reader.readAsDataURL(file);
          input.value = "";
        });

        dlg.querySelector("#clinical-billing-form")?.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const serviceLines = [];
          for (let i = 0; i < 4; i++) {
            const d = String(fd.get(`svc_desc_${i}`) || "").trim();
            const amt = Number(fd.get(`svc_amt_${i}`)) || 0;
            if (d || amt) serviceLines.push({ description: d, amount: amt });
          }
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
          try {
            const resP = await apiRequest(
              `${API_BASE}/doctors/me/appointments/${appt._id}/billing`,
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

  mainContent.querySelector(".clinical-dashboard")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-clinical-tab]");
    if (!btn) return;
    const next = btn.getAttribute("data-clinical-tab");
    if (!next || next === parseDoctorDashboardTab()) return;
    setDoctorDashboardHashTab(next);
  });

  void showClinicalTab(parseDoctorDashboardTab());
}

function renderPage() {
  const route = getHashRoute();
  setActiveNav(route);
  renderTopbarBreadcrumbs();
  switch (route) {
    case "#doctor-dashboard":
      renderDoctorDashboard();
      break;
    case "#settings":
      renderSettings();
      break;
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
  mainContent.classList.remove(
    "page-tone-patients",
    "page-tone-doctors",
    "page-tone-appointments",
    "page-tone-users",
  );
  if (kind) mainContent.classList.add(`page-tone-${kind}`);
}

function renderSettings() {
  setPageTone("");
  if (!isLoggedIn()) {
    mainContent.innerHTML = `<div class="feedback error">Please log in to view settings.</div>`;
    return;
  }
  let cache = {};
  try {
    cache = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "{}");
  } catch (e) {
    cache = {};
  }
  const theme = localStorage.getItem(THEME_KEY) || "light";
  mainContent.innerHTML = `
    <h2 class="page-title">Settings</h2>
    <section class="card">
      <h3>Profile</h3>
      <p><strong>Name:</strong> ${escapeHtml(`${cache.firstName || ""} ${cache.lastName || ""}`.trim() || "—")}</p>
      <p><strong>Role:</strong> ${escapeHtml(String(cache.role || "—"))}</p>
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
  `;
  const sel = document.getElementById("settings-theme");
  if (sel) {
    sel.value = theme === "dark" ? "dark" : "light";
    sel.addEventListener("change", () => {
      applyTheme(sel.value);
      renderTopbarBreadcrumbs();
    });
  }
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
      <h1 class="home-hero-title">Welcome to DrMeet</h1>
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
        <h3 class="home-section-title">Why Choose DrMeet</h3>
        <p>DrMeet centralizes patient records, visit workflows, and secure messaging in one modern workspace. Teams collaborate faster while patients get clearer updates.</p>
        <p>Smart routing, role-based access, and real-time communication keep every handoff accurate and accountable.</p>
      </div>
      <img class="why-drmeet-media" src="images/drmeet-pic1.webp" alt="DrMeet technology in action" />
    </section>
    <section class="role-select card role-select-highlight">
      <h3 class="home-cta-title">Please select your profile type below</h3>
      <div class="role-select-grid">
        <button type="button" class="role-card role-card-doctor" id="role-select-doctor">
          <span class="role-card-label">I am a Provider</span>
          <span class="role-card-hint">Register as a Doctor to manage your practice.
            <span class="info-tooltip-trigger" tabindex="0">
              <img src="images/info-i.svg" alt="Info" class="info-tooltip-icon" />
              <span class="info-tooltip-bubble">Register as a Doctor to manage your practice.</span>
            </span>
          </span>
        </button>
        <button type="button" class="role-card role-card-patient" id="role-select-patient">
          <span class="role-card-label">I am a Patient</span>
          <span class="role-card-hint">Create an account to find care and book appointments.
            <span class="info-tooltip-trigger" tabindex="0">
              <img src="images/info-i.svg" alt="Info" class="info-tooltip-icon" />
              <span class="info-tooltip-bubble">Create an account to find care and book appointments.</span>
            </span>
          </span>
        </button>
      </div>
    </section>
    ${
      signedIn
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
        renderSignup();
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
        renderSignup();
        return;
      }
      window.location.hash = "#book";
      renderPatientBooking();
    });
}

function createSkeletonRows(total = 3) {
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

function showComposeMessageModal(onSubmit) {
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

function messengerUi(rootEl) {
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

function wireMessengerShell(rootEl) {
  if (!rootEl || rootEl.dataset.messengerShellWired) return;
  rootEl.dataset.messengerShellWired = "1";
  rootEl.querySelector("[data-messenger-search]")?.addEventListener("input", (e) => {
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
          "😀","😁","😂","🤣","😊","😍","😘","😎",
          "😅","😉","🙂","🤔","😴","😷","🤒","🤕",
          "👍","🙏","👏","💪","🙌","🤝","✅","❌",
          "❤️","💛","💙","💚","✨","🔥","🎉","📎",
        ]
          .map((e) => `<button type="button" class="emoji-item" data-emoji="${e}" aria-label="${e}">${e}</button>`)
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
        left = Math.max(margin, Math.min(left, window.innerWidth - margin - menuW));

        // Prefer above the button; if not enough space, drop below.
        let top = Math.round(rect.top - menuH - 10);
        if (top < margin) top = Math.round(rect.bottom + 10);
        top = Math.max(margin, Math.min(top, window.innerHeight - margin - menuH));

        m.style.left = `${left}px`;
        m.style.top = `${top}px`;
      });

      textarea?.focus();
      return;
    }

    if (emojiItem) {
      ev.preventDefault();
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
  rootEl.querySelector("[data-messenger-clear]")?.addEventListener("click", clearThread);
}

function buildThreadMessagesHtml(messages, currentUserId) {
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
      const bubbleClass = isYou ? "thread-bubble--outgoing" : "thread-bubble--incoming";
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

function renderMessengerConversationList(rootEl) {
  const ui = messengerUi(rootEl);
  if (!ui.list || !isLoggedIn()) return;
  const currentUserId = getCurrentUserId();
  const needle = String(dashboardState.conversationSearchFilter || "")
    .trim()
    .toLowerCase();
  const conversations = Array.isArray(dashboardState.conversations)
    ? dashboardState.conversations
    : [];
  const sorted = [...conversations].sort((a, b) => {
    const left = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const right = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return right - left;
  });
  const filtered = sorted.filter((conv) => {
    if (!needle) return true;
    const participants = Array.isArray(conv.participants) ? conv.participants : [];
    const other =
      participants.find((p) => String(p._id) !== String(currentUserId)) ||
      participants[0] ||
      null;
    const name = participantDisplayName(other).toLowerCase();
    const last = String(conv.lastMessage || "").toLowerCase();
    return name.includes(needle) || last.includes(needle);
  });

  ui.list.innerHTML = filtered.length
    ? filtered
        .map((conv) => {
          const participants = Array.isArray(conv.participants) ? conv.participants : [];
          const other =
            participants.find((p) => String(p._id) !== String(currentUserId)) ||
            participants[0] ||
            null;
          const otherName = participantDisplayName(other);
          const otherAvatar = participantAvatarUrl(other);
          const lastMsg = conv.lastMessage || "";
          const typingLabel = conversationTypingLabel(conv._id, currentUserId);
          const active =
            String(dashboardState.activeConversationId) === String(conv._id);
          return `
            <button type="button" class="messenger-conv-row ${active ? "messenger-conv-row--active" : ""}" data-select-conversation="${conv._id}">
              <img class="person-avatar" src="${escapeHtml(otherAvatar)}" alt="" />
              <div class="messenger-conv-meta">
                <span class="messenger-conv-name">${escapeHtml(otherName)}</span>
                <span class="messenger-conv-preview">${escapeHtml(typingLabel || lastMsg || "No messages yet")}</span>
              </div>
            </button>`;
        })
        .join("")
    : `<div class="feedback messenger-empty-inbox">No conversations match.</div>`;

  ui.list.querySelectorAll("[data-select-conversation]").forEach((row) => {
    row.addEventListener("click", async () => {
      const conversationId = row.getAttribute("data-select-conversation");
      if (!conversationId) return;
      dashboardState.activeConversationId = String(conversationId);
      ui.layout?.classList.add("messenger-show-thread");
      await loadMessages(conversationId);
      notifyDashboardSubscribers();
    });
  });
}

function isNearBottom(el, threshold = 100) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

function renderMessengerThread(rootEl) {
  if (!rootEl || !isLoggedIn()) return;
  wireMessengerShell(rootEl);
  const ui = messengerUi(rootEl);
  const conversationId = dashboardState.activeConversationId;

  if (!conversationId) {
    ui.layout?.classList.remove("messenger-show-thread");
    ui.active?.classList.add("hidden");
    ui.empty?.classList.remove("hidden");
    return;
  }

  const conv = dashboardState.conversations.find(
    (c) => String(c._id) === String(conversationId),
  );
  const participants = Array.isArray(conv?.participants) ? conv.participants : [];
  const currentUserId = getCurrentUserId();
  const other =
    participants.find((p) => String(p._id) !== String(currentUserId)) ||
    participants[0] ||
    null;
  const otherName = participantDisplayName(other);
  const otherAvatar = participantAvatarUrl(other);
  const typingLabel = conversationTypingLabel(conversationId, currentUserId);

  ui.empty?.classList.add("hidden");
  ui.active?.classList.remove("hidden");
  ui.layout?.classList.add("messenger-show-thread");
  if (ui.peerAvatar) {
    ui.peerAvatar.src = otherAvatar;
    ui.peerAvatar.alt = `${otherName} avatar`;
  }
  if (ui.peerName) ui.peerName.textContent = otherName;
  if (ui.typing) ui.typing.textContent = typingLabel || "";

  if (ui.scroll) {
    ui.scroll.innerHTML = buildThreadMessagesHtml(
      dashboardState.messages,
      currentUserId,
    );
  
    if (isNearBottom(ui.scroll)) {
      ui.scroll.scrollTop = ui.scroll.scrollHeight;
    } else {
      showNewMessageBadge();
    }
  }

  const conversationIdRef = String(conversationId);
  let typingStopTimer = null;
  const emitTypingStart = () => {
    if (!socket || !conversationIdRef) return;
    socket.emit("typing:start", { conversationId: conversationIdRef });
  };
  const emitTypingStop = () => {
    if (!socket || !conversationIdRef) return;
    socket.emit("typing:stop", { conversationId: conversationIdRef });
  };

  const textarea = rootEl.querySelector("[data-messenger-reply-text]");
  const sendBtn = rootEl.querySelector("[data-messenger-send]");
  const fileInput = rootEl.querySelector("[data-messenger-file-input]");

  if (textarea) {
    textarea.oninput = () => {
      const hasText = String(textarea.value || "").trim().length > 0;
      if (!hasText) {
        emitTypingStop();
        return;
      }
      emitTypingStart();
      if (typingStopTimer) clearTimeout(typingStopTimer);
      typingStopTimer = setTimeout(() => emitTypingStop(), 900);
    };
    textarea.onblur = () => {
      if (typingStopTimer) clearTimeout(typingStopTimer);
      emitTypingStop();
    };
  }

  const sendAction = async () => {
    const content = String(textarea?.value || "").trim();
    const file = fileInput?.files?.[0];
    if ((!content && !file) || !conversationIdRef) return;
    dashboardState.activeConversationId = conversationIdRef;
    try {
      if (file) {
        await sendDocumentMessage({
          conversationId: conversationIdRef,
          text: content,
          file,
        });
      } else {
        await sendMessage(content);
      }
      if (textarea) textarea.value = "";
      if (fileInput) fileInput.value = "";
      if (typingStopTimer) clearTimeout(typingStopTimer);
      emitTypingStop();
      // Keep the latest message visible.
      const ui = messengerUi(rootEl);
      if (ui.scroll) ui.scroll.scrollTop = ui.scroll.scrollHeight;
    } catch (err) {
      showToast(err?.message || "Unable to send message", "error");
    }
  };

  if (sendBtn) sendBtn.onclick = sendAction;
}

function mountFloatingChatWidget() {
  if (!isLoggedIn()) return;
  const root = document.getElementById("floating-chat-widget");
  const panel = document.getElementById("floating-chat-panel");
  const toggleBtn = document.getElementById("floating-chat-toggle");
  const closeBtn = document.getElementById("floating-chat-close");
  const shellRoot = document.getElementById("floating-messenger-root");
  if (!root || !panel || !shellRoot) return;

  root.classList.remove("hidden");
  root.setAttribute("aria-hidden", "false");

  setupSocket();

  const updateLiveBadgeOnly = () => {
    const liveBadge = document.querySelector(".live-badge");
    if (liveBadge)
      liveBadge.classList.toggle("active", dashboardState.websocketActive);
  };

  pruneDashboardSubscribers(DASH_TAG_FLOAT);
  const floatListener = () => {
    renderMessengerConversationList(shellRoot);
    renderMessengerThread(shellRoot);
  };
  floatListener._dashTag = DASH_TAG_FLOAT;
  subscribeDashboard(floatListener);

  pruneDashboardSubscribers(DASH_TAG_HOME);
  const homeListener = () => updateLiveBadgeOnly();
  homeListener._dashTag = DASH_TAG_HOME;
  subscribeDashboard(homeListener);
  updateLiveBadgeOnly();

  wireMessengerShell(shellRoot);
  const ui = messengerUi(shellRoot);
  if (ui.list) ui.list.innerHTML = createSkeletonRows(3);
  renderMessengerConversationList(shellRoot);
  renderMessengerThread(shellRoot);

  if (!window.__drmeetMessagePoll) {
    window.__drmeetMessagePoll = setInterval(async () => {
      if (!isLoggedIn() || authSessionExpired) return;
      const cid = dashboardState.activeConversationId;
      try {
        if (cid) await loadMessages(cid);
        await loadConversations();
      } catch (e) {
        /* ignore */
      }
    }, 2800);
  }

  if (!root.dataset.drmeetFloatReady) {
    root.dataset.drmeetFloatReady = "1";
    toggleBtn?.addEventListener("click", () => {
      panel.classList.toggle("hidden");
      const visible = !panel.classList.contains("hidden");
      if (visible) {
        loadConversations().then(() => {
          renderMessengerConversationList(shellRoot);
          renderMessengerThread(shellRoot);
        });
      }
      toggleBtn?.setAttribute("aria-expanded", visible ? "true" : "false");
    });
    closeBtn?.addEventListener("click", () => {
      panel.classList.add("hidden");
      toggleBtn?.setAttribute("aria-expanded", "false");
    });
    shellRoot.querySelector("[data-messenger-compose]")?.addEventListener("click", () => {
      showComposeMessageModal(async (note) => {
        try {
          // Do not auto-open/select a conversation; just send into the currently active one.
          await sendMessage(note);
          showToast("Message sent.");
          renderMessengerConversationList(shellRoot);
          renderMessengerThread(shellRoot);
        } catch (err) {
          showToast(err?.message || "Unable to send message", "error");
        }
      });
    });
  }

  loadConversations().then(() => {
    renderMessengerConversationList(shellRoot);
    renderMessengerThread(shellRoot);
  });
}

function hideFloatingChatWidget() {
  const root = document.getElementById("floating-chat-widget");
  const panel = document.getElementById("floating-chat-panel");
  const toggleBtn = document.getElementById("floating-chat-toggle");
  document
    .getElementById("floating-messenger-root")
    ?.removeAttribute("data-messenger-shell-wired");
  if (window.__drmeetMessagePoll) {
    clearInterval(window.__drmeetMessagePoll);
    window.__drmeetMessagePoll = null;
  }
  if (root) {
    root.classList.add("hidden");
    root.setAttribute("aria-hidden", "true");
  }
  panel?.classList.add("hidden");
  toggleBtn?.setAttribute("aria-expanded", "false");
  pruneDashboardSubscribers(DASH_TAG_FLOAT);
  pruneDashboardSubscribers(DASH_TAG_HOME);
}

// --- Authentication ---
function isLoggedIn() {
  return !!localStorage.getItem("token");
}

function updateAuthNav() {
  const loginLink = document.getElementById("login-link");
  const signedIn = isLoggedIn();
  const role = getCurrentUserRole();
  const doctorDashLi = document.querySelector(".nav-li-doctor-dash");
  if (doctorDashLi) {
    doctorDashLi.style.display =
      signedIn && role === "doctor" ? "" : "none";
  }
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
    sidebarUserPopover.classList.remove("hidden");
  }
  if (sidebarUserTrigger) {
    sidebarUserTrigger.style.display = signedIn ? "none" : "";
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
      <label><span class="label-text-row">Password</span><input name="password" type="password" required autocomplete="current-password" /></label>
      <button type="submit" class="btn btn-primary">Sign in</button>
    </form>
    <button id="google-login-btn" type="button" class="btn btn-google" style="margin-top:1rem;">Continue with Google</button>
    <div id="login-feedback"></div>
  `;
  const googleLoginBtn = document.getElementById("google-login-btn");
  const form = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
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
    feedback.textContent = oauthError;
    feedback.className = "feedback error";
  }
  googleLoginBtn.onclick = () =>
    googleLogin({ feedbackEl: feedback, buttonEl: googleLoginBtn });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    feedback.textContent = "Logging in...";
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
        clearSessionExpiredState();
        feedback.textContent = "Login successful!";
        updateAuthNav();
        setTimeout(() => {
          window.location.hash = "#home";
          renderHome();
        }, 800);
      } else {
        throw new Error("No token received");
      }
    } catch (err) {
      feedback.textContent = normalizeFetchErrorMessage(err, "Login failed.");
      feedback.className = "feedback error";
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
      <label>Password <input name="password" type="password" required /></label>
      <label>Phone
        <input name="phone" inputmode="numeric" pattern="[0-9]{10,11}" maxlength="11" title="Use 10 or 11 digits" placeholder="e.g. 09171234567" />
        <small>Digits only, 10-11 numbers.</small>
      </label>
      <label>Address <input name="address" /></label>
      ${
        selectedRole === "doctor"
          ? `<label><span class="label-text-row" data-tooltip="Set the primary board-certified specialty used for profile matching.">Primary Specialty</span><input name="specialty" list="doctor-specialties-signup" required placeholder="e.g. Cardiology" /></label>
             <datalist id="doctor-specialties-signup">
               ${[...new Set(DOCTOR_SPECIALTIES)].map((s) => `<option value="${s}"></option>`).join("")}
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
  addInlineTooltips(form);
  enforcePhoneInputs(form);
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
    feedback.textContent = oauthError;
    feedback.className = "feedback error";
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    feedback.textContent = "Signing up...";
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
        feedback.textContent = "Signup successful!";
        updateAuthNav();
        setTimeout(() => {
          window.location.hash = "#home";
          renderHome();
        }, 800);
      } else {
        throw new Error("No token received");
      }
    } catch (err) {
      feedback.textContent = normalizeFetchErrorMessage(err, "Signup failed.");
      feedback.className = "feedback error";
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };
  document.getElementById("signup-start-over")?.addEventListener("click", () => {
    form.reset();
    feedback.textContent = "";
    feedback.className = "";
  });
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

function handleGoogleAuthMessage(event) {
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
    document.getElementById("patient-booking-doctor-title").textContent =
      `Book with ${displayName}`;
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
      .map(
        (p) =>
          `<option value="${p._id}">${p.firstName || ""} ${p.lastName || ""}</option>`,
      )
      .join("");
    const isDoctor = role === "doctor";
    let canReceptionistSendDocs = false;
    if (isReceptionist) {
      try {
        const docsRes = await apiRequest(`${API_BASE}/doctors`);
        if (docsRes.ok) {
          const doctorRows = await docsRes.json();
          const linkedDoctorId = getCurrentLinkedDoctorId();
          const linked = doctorRows.find(
            (d) => String(d._id) === String(linkedDoctorId),
          );
          canReceptionistSendDocs = Boolean(
            linked?.allowReceptionistSendDocuments,
          );
        }
      } catch (e) {
        canReceptionistSendDocs = false;
      }
    }
    const isAdminUser = role === "admin";
    let clinicDoctors = [];
    if (isPatient) {
      try {
        const dr = await apiRequest(`${API_BASE}/doctors`);
        if (dr.ok) clinicDoctors = await dr.json();
      } catch (e) {
        clinicDoctors = [];
      }
    }
    const doctorOptionsForSend = (Array.isArray(clinicDoctors) ? clinicDoctors : [])
      .filter((d) => d?.userId)
      .map(
        (d) =>
          `<option value="${d.userId}">${escapeHtml(formatDoctorDisplayName(d))}</option>`,
      )
      .join("");
    mainContent.innerHTML = `
      <h2 class="page-title page-title-patients">Patients</h2>
      <div class="patients-toolbar">
        <button type="button" class="cta-primary btn-secondary" id="patients-refresh-btn" title="Reload list">Refresh</button>
        <button class="cta-primary" onclick="window.showPatientForm()">Add Patient</button>
        ${isPatient ? '<button class="cta-primary" onclick="window.showFamilyMemberForm()">Register Family Member</button>' : ""}
        ${isAdminUser ? '<button class="cta-primary btn-secondary" id="export-patients-csv">Export CSV</button>' : ""}
      </div>
      ${
        isPatient && doctorOptionsForSend
          ? `<section class="card patient-send-doc-card">
        <h3>Send document to clinic</h3>
        <p class="signup-lead">Choose a doctor, attach an image or PDF, and upload. Your clinic receives it in messaging.</p>
        <label>Doctor / clinic
          <select id="patient-send-doc-doctor">${doctorOptionsForSend}</select>
        </label>
        <label>File
          <input type="file" id="patient-send-doc-file" accept="image/*,.pdf,.doc,.docx,.txt" />
        </label>
        <button type="button" class="cta-primary" id="patient-send-doc-btn">Upload</button>
      </section>`
          : ""
      }
      ${
        isPatient && patients.length
          ? `
      <div class="list-filters">
        <label>Switch Profile
          <select id="patient-switch-profile">
            <option value="">All linked profiles</option>
            ${patientOptions}
          </select>
        </label>
      </div>`
          : ""
      }
      <hr class="section-divider" />
      <div class="list-filters patients-list-controls">
        <label>Sort by date added
          <select id="patient-sort-order">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <input type="search" id="patient-filter-name" placeholder="Filter by name" />
        <input type="search" id="patient-filter-email" placeholder="Filter by email" />
        <input type="search" id="patient-filter-phone" placeholder="Filter by phone" />
        <input type="search" id="patient-filter-dob" placeholder="Filter by DOB (YYYY-MM-DD)" />
      </div>
      <table>
        <thead><tr><th>Name</th><th>Profile Type</th><th>Email</th><th>Phone</th><th>Date of Birth</th><th>Added</th><th>Records</th><th>Actions</th></tr></thead>
        <tbody id="patients-table-body"></tbody>
      </table>
      <div id="patient-form-modal" class="patient-form-modal-host" style="display:none"></div>
    `;
    const bodyEl = document.getElementById("patients-table-body");
    const renderRows = (list) => {
      bodyEl.innerHTML = list
        .map(
          (p) => {
            const docs = Array.isArray(p.documents) ? p.documents : [];
            const docLinks = docs
              .map((d) => {
                const u = String(d.fileUrl || d.url || "").trim();
                if (!u) return "";
                const nm = escapeHtml(String(d.name || "Open file"));
                return `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${nm}</a>`;
              })
              .filter(Boolean)
              .join("<br/>");
            const addedRel = p.createdAt
              ? formatRelativeTime(p.createdAt)
              : "—";
            const deleteBtn = isAdminUser
              ? `<button type="button" class="btn btn-action-delete" onclick="window.deletePatient('${p._id}')">Delete</button>`
              : "";
            return `
            <tr>
              <td><img src="${escapeHtml(String(p.photoUrl || DEFAULT_AVATAR_URL))}" alt="Patient avatar" class="doctor-avatar" />${p.firstName} ${p.lastName}</td>
              <td>${p.familyHeadName ? `Family Head: ${p.familyHeadName}` : p.relationshipToAccountHolder ? `Dependent: ${p.relationshipToAccountHolder}` : "Primary"}${p.isCareTeamLinked ? ' <span class="pill-tag">Attached</span>' : ""}</td>
              <td>${p.email || ""}</td>
              <td>${p.phone || ""}</td>
              <td>${formatDateDisplay(p.birthdate) || ""}</td>
              <td><span title="${escapeHtml(String(p.createdAt || ""))}">${addedRel}</span></td>
              <td class="patient-docs-cell">${docLinks || "—"}</td>
              <td>
                <button type="button" class="btn btn-secondary btn-action-edit" onclick="window.editPatient('${p._id}')">Edit</button>
                ${deleteBtn}
                ${isDoctor || (isReceptionist && canReceptionistSendDocs) ? `<button type="button" class="btn btn-primary btn-action-edit" onclick="window.sendPatientDocumentFromDoctor('${p._id}')">Send Document</button>` : ""}
              </td>
            </tr>
          `;
          },
        )
        .join("");
    };
    const applyPatientFilters = () => {
      const nameQ = String(
        document.getElementById("patient-filter-name")?.value || "",
      )
        .toLowerCase()
        .trim();
      const emailQ = String(
        document.getElementById("patient-filter-email")?.value || "",
      )
        .toLowerCase()
        .trim();
      const phoneQ = String(
        document.getElementById("patient-filter-phone")?.value || "",
      )
        .toLowerCase()
        .trim();
      const dobQ = String(
        document.getElementById("patient-filter-dob")?.value || "",
      )
        .toLowerCase()
        .trim();
      const order =
        document.getElementById("patient-sort-order")?.value || "newest";
      const sorted = sortPatientsByCreated(patients, order);
      const filtered = sorted.filter((p) => {
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
    [
      "patient-filter-name",
      "patient-filter-email",
      "patient-filter-phone",
      "patient-filter-dob",
    ].forEach((id) => {
      document
        .getElementById(id)
        ?.addEventListener("input", applyPatientFilters);
    });
    document
      .getElementById("patient-sort-order")
      ?.addEventListener("change", applyPatientFilters);
    document.getElementById("patients-refresh-btn")?.addEventListener("click", () => {
      renderPatients();
    });
    document
      .getElementById("patient-switch-profile")
      ?.addEventListener("change", (event) => {
        const selectedId = String(event.target.value || "");
        if (!selectedId) {
          applyPatientFilters();
          return;
        }
        const order =
          document.getElementById("patient-sort-order")?.value || "newest";
        const sorted = sortPatientsByCreated(patients, order);
        const picked = sorted.filter((p) => String(p._id) === selectedId);
        renderRows(picked);
      });
    applyPatientFilters();
    document
      .getElementById("export-patients-csv")
      ?.addEventListener("click", () => {
        downloadCsv(
          `patients-${Date.now()}.csv`,
          patients.map((p) => ({
            name: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
            email: p.email || "",
            phone: p.phone || "",
            dob: formatDateForInput(p.birthdate),
          })),
        );
      });
    document.getElementById("patient-send-doc-btn")?.addEventListener(
      "click",
      async () => {
        const doctorUserId = String(
          document.getElementById("patient-send-doc-doctor")?.value || "",
        );
        const fileInput = document.getElementById("patient-send-doc-file");
        const file = fileInput?.files?.[0];
        if (!doctorUserId) {
          showToast("Select a doctor or clinic contact.", "error");
          return;
        }
        if (!file) {
          showToast("Choose a file to upload.", "error");
          return;
        }
        const selectedId = String(
          document.getElementById("patient-switch-profile")?.value || "",
        );
        const patientProfile = selectedId
          ? patients.find((p) => String(p._id) === selectedId)
          : patients.find((p) => !p.relationshipToAccountHolder) || patients[0];
        if (!patientProfile?.userId) {
          showToast(
            "No messaging profile found for the selected patient.",
            "error",
          );
          return;
        }
        try {
          await sendDocumentMessage({
            patientId: String(patientProfile.userId),
            doctorId: doctorUserId,
            text: "Patient document for clinic review.",
            file,
          });
          showToast("Document sent to clinic.");
          fileInput.value = "";
        } catch (error) {
          showToast(error?.message || "Unable to send document.", "error");
        }
      },
    );
    window.showPatientForm = showPatientForm;
    window.showFamilyMemberForm = () => showPatientForm(null, true);
    window.editPatient = editPatient;
    window.deletePatient = deletePatient;
    window.sendMyDocumentToClinic = () => {
      document
        .querySelector(".patient-send-doc-card")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    window.sendPatientDocumentFromDoctor = async (patientId) => {
      const patient = patients.find((p) => String(p._id) === String(patientId));
      const recipientId = await resolvePatientMessageRecipient(patient);
      if (!recipientId) {
        showToast(
          "Patient must have a linked app account or matching user email to receive documents.",
          "error",
        );
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
            patientId: String(recipientId),
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
  const canAttachExisting =
    !editId && (role === "doctor" || role === "receptionist");
  modal.style.display = "block";
  const staffRole =
    role === "doctor" || role === "receptionist" || role === "admin";
  modal.innerHTML = `
    <div class="modal-sheet card patient-modal-sheet">
      <button type="button" class="modal-close-x" aria-label="Close" onclick="window.closePatientForm()">&times;</button>
      <form id="patient-form">
      <h3>${editId ? "Edit" : familyMode ? "Register Family Member" : "Add"} Patient</h3>
      ${
        canAttachExisting
          ? `
      <section class="card" style="padding:0.75rem;">
        <h4 style="margin:0 0 0.45rem;">Search Existing Patient</h4>
        <label>Search by name, email, or phone
          <input type="search" id="patient-existing-search" placeholder="Type at least 2 characters" />
        </label>
        <div id="patient-existing-results" class="feedback" style="display:none"></div>
      </section>
      `
          : ""
      }
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
      ${
        staffRole
          ? `<label><span class="label-text-row" data-tooltip="Used with email and date of birth to prevent duplicate registrations at this site.">Registration facility</span>
        <input name="registrationFacility" required placeholder="Clinic or branch name" /></label>`
          : `<label><span class="label-text-row" data-tooltip="Include if instructed by your clinic — combined with email and DOB prevents duplicates.">Registration facility</span>
        <input name="registrationFacility" placeholder="Optional" /></label>`
      }
      <label><input type="checkbox" name="isInsured" id="patient-is-insured" value="true" /> Has HMO / insured</label>
      <label id="patient-hmo-wrap" style="display:none">HMO provider (required if insured)
        <select name="hmoProvider" id="patient-hmo-select"></select>
      </label>
      <label>Profile Photo
        <input name="profilePhotoFile" type="file" accept="image/*" />
      </label>
      ${familyMode ? `<label>Relationship to Account Holder <input name="relationshipToAccountHolder" required placeholder="e.g. Son, Daughter, Spouse" /></label>` : ""}
      <label>Notes <textarea name="notes" placeholder="Medical notes or reminders"></textarea></label>
      <label>Medical History
        <textarea name="medicalHistory" placeholder="One item per line"></textarea>
      </label>
      <label><span class="label-text-row" data-tooltip="Accepted formats: PDF, DOCX, JPG, PNG. Images and PDFs upload to secure storage.">Upload Records</span>
        <input name="documentFile" type="file" accept="image/*,.pdf,.doc,.docx,.txt" />
      </label>
      <div class="modal-form-actions">
        <button type="submit" class="btn btn-secondary btn-action-edit">${editId ? "Update" : "Add"}</button>
        <button type="button" class="btn btn-action-delete" onclick="window.closePatientForm()">Cancel</button>
      </div>
    </form>
    </div>
  `;
  window.closePatientForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("patient-form");
  addInlineTooltips(form);
  attachClearButtons(form);
  enforcePhoneInputs(form);
  const insuredCb = document.getElementById("patient-is-insured");
  const hmoWrap = document.getElementById("patient-hmo-wrap");
  const hmoSelect = document.getElementById("patient-hmo-select");
  const syncInsured = () => {
    const on = Boolean(insuredCb?.checked);
    if (hmoWrap) hmoWrap.style.display = on ? "" : "none";
    if (hmoSelect) hmoSelect.required = on;
  };
  insuredCb?.addEventListener("change", syncInsured);
  syncInsured();
  (async () => {
    try {
      const hr = await apiRequest(`${API_BASE}/patients/constants/hmo-providers`);
      if (!hr.ok || !hmoSelect) return;
      const data = await hr.json();
      const list = Array.isArray(data?.providers) ? data.providers : [];
      hmoSelect.innerHTML = `<option value="">Select HMO</option>${list
        .map(
          (p) =>
            `<option value="${escapeHtml(String(p))}">${escapeHtml(String(p))}</option>`,
        )
        .join("")}`;
    } catch (e) {
      if (hmoSelect)
        hmoSelect.innerHTML = `<option value="">Could not load HMO list</option>`;
    }
  })();
  if (canAttachExisting) {
    const searchInput = document.getElementById("patient-existing-search");
    const resultEl = document.getElementById("patient-existing-results");
    let pickedExistingPatientId = "";
    searchInput?.addEventListener("input", async () => {
      const q = String(searchInput.value || "").trim();
      resultEl.style.display = "none";
      if (q.length < 2) return;
      try {
        const res = await apiRequest(
          `${API_BASE}/patients/search?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) throw new Error("Search failed");
        const matches = await res.json();
        if (!matches.length) {
          resultEl.style.display = "block";
          resultEl.className = "feedback";
          resultEl.textContent =
            "No duplicate match found. You may create a new patient record.";
          return;
        }
        resultEl.style.display = "block";
        resultEl.className = "feedback error";
        resultEl.innerHTML = matches
          .map(
            (m) => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
              <span>${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)} (${escapeHtml(m.email || m.phone || "No contact")})</span>
              <button type="button" class="btn btn-secondary btn-sm" data-attach-patient="${m._id}">Add Existing</button>
            </div>
          `,
          )
          .join("");
        resultEl.querySelectorAll("[data-attach-patient]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            pickedExistingPatientId = btn.getAttribute("data-attach-patient");
            try {
              const attachRes = await apiRequest(
                `${API_BASE}/patients/${pickedExistingPatientId}/attach`,
                { method: "POST" },
              );
              if (!attachRes.ok)
                throw new Error(
                  await getApiErrorMessage(
                    attachRes,
                    "Failed to attach patient",
                  ),
                );
              modal.style.display = "none";
              renderPatients();
              showToast("Existing patient was added to your Patients tab.");
            } catch (error) {
              showToast(
                error.message || "Unable to attach existing patient.",
                "error",
              );
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
        form.medicalHistory.value = Array.isArray(data.medicalHistory)
          ? data.medicalHistory.join("\n")
          : "";
        if (form.registrationFacility)
          form.registrationFacility.value = data.registrationFacility || "";
        if (insuredCb) insuredCb.checked = Boolean(data.isInsured);
        if (hmoSelect && data.hmoProvider)
          hmoSelect.value = String(data.hmoProvider || "");
        syncInsured();
      });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const patient = Object.fromEntries(new FormData(form));
    patient.isInsured = Boolean(document.getElementById("patient-is-insured")?.checked);
    if (!patient.isInsured) patient.hmoProvider = "";
    const docFile = form.documentFile?.files?.[0];
    if (docFile) {
      patient.documentFileData = await fileToDataUrl(docFile);
      patient.documentName = docFile.name || "Patient attachment";
    }
    const profilePhotoFile = form.profilePhotoFile?.files?.[0];
    if (profilePhotoFile) {
      patient.photoFileData = await fileToDataUrl(profilePhotoFile);
    }
    if (familyMode) {
      patient.relationshipToAccountHolder = String(
        patient.relationshipToAccountHolder || "",
      ).trim();
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
            throw new Error(
              "Possible duplicate exists. Use 'Search Existing Patient' and click Add Existing.",
            );
          }
        }
      }
      const res = await apiRequest(
        `${API_BASE}/patients${editId ? "/" + editId : ""}`,
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patient),
        },
      );
      if (!res.ok) {
        throw new Error(
          await getApiErrorMessage(res, "Failed to save patient"),
        );
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
    const res = await apiRequest(`${API_BASE}/patients/${id}`, {
      method: "DELETE",
    });
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
    const isReceptionist = role === "receptionist";
    const receptionistType = getCurrentReceptionistType();
    const hideDoctorFilters =
      isDoctor || (isReceptionist && receptionistType === "small_clinic");
    const currentUserId = getCurrentUserId();
    const doctors = isDoctor
      ? allDoctors.filter(
          (d) => String(d.userId || "") === String(currentUserId || ""),
        )
      : allDoctors;
    mainContent.innerHTML = `
      <h2 class="page-title page-title-doctors">Doctors</h2>
      ${isAdmin ? '<button class="cta-primary" onclick="window.showDoctorForm()">Add Doctor</button>' : ""}
      ${isAdmin ? '<button class="cta-primary btn-secondary" id="export-doctors-csv">Export CSV</button>' : ""}
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
      ${
        hideDoctorFilters
          ? ""
          : `<div class="list-filters">
        <input type="search" id="doctor-filter-name" placeholder="Filter by name" />
        <input type="search" id="doctor-filter-email" placeholder="Filter by email" />
        <input type="search" id="doctor-filter-specialty" placeholder="Filter by specialty" />
        <input type="search" id="doctor-filter-availability" placeholder="Filter by availability" />
        <input type="search" id="doctor-filter-phone" placeholder="Filter by phone" />
        <input type="search" id="doctor-filter-receptionist" placeholder="Filter by receptionist" />
        <input type="search" id="doctor-filter-clinic" placeholder="Filter by clinic" />
      </div>`
      }
      <div id="doctors-specialty-groups" class="full-width-groups"></div>
      <div id="doctor-form-modal" style="display:none"></div>
    `;
    const groupsEl = document.getElementById("doctors-specialty-groups");
    const renderRows = (list) => {
      const grouped = list.reduce((acc, d) => {
        const specialty = String(d.specialty || "General").trim() || "General";
        if (!acc[specialty]) acc[specialty] = [];
        acc[specialty].push(d);
        return acc;
      }, {});
      groupsEl.innerHTML = Object.entries(grouped)
        .filter(([, items]) => Array.isArray(items) && items.length)
        .map(
          ([specialty, items]) => `
            <section class="doctor-specialty-group">
              <h3 class="doctor-specialty-heading">${escapeHtml(specialty)}</h3>
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Clinic</th><th>Availability</th><th>Phone</th><th>Receptionist</th><th>Actions</th></tr></thead>
                <tbody>
                  ${items
                    .map(
                      (d) => `
                        <tr>
                          <td>${d.photoUrl ? `<img src="${escapeHtml(d.photoUrl)}" alt="Doctor avatar" class="doctor-avatar" />` : `<span class="doctor-avatar"></span>`}${d.firstName} ${d.lastName}${d.subSpecialization || d.subSpecialty ? `<span class="pill-tag">${escapeHtml(d.subSpecialization || d.subSpecialty)}</span>` : ""}</td>
                          <td>${d.email || ""}</td>
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
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </section>
          `,
        )
        .join("");
    };
    const applyDoctorFilters = () => {
      const nameQ = String(
        document.getElementById("doctor-filter-name")?.value || "",
      )
        .toLowerCase()
        .trim();
      const emailQ = String(
        document.getElementById("doctor-filter-email")?.value || "",
      )
        .toLowerCase()
        .trim();
      const specialtyQ = String(
        document.getElementById("doctor-filter-specialty")?.value || "",
      )
        .toLowerCase()
        .trim();
      const availabilityQ = String(
        document.getElementById("doctor-filter-availability")?.value || "",
      )
        .toLowerCase()
        .trim();
      const phoneQ = String(
        document.getElementById("doctor-filter-phone")?.value || "",
      )
        .toLowerCase()
        .trim();
      const receptionistQ = String(
        document.getElementById("doctor-filter-receptionist")?.value || "",
      )
        .toLowerCase()
        .trim();
      const clinicQ = String(
        document.getElementById("doctor-filter-clinic")?.value || "",
      )
        .toLowerCase()
        .trim();
      const filtered = doctors.filter((d) => {
        const name = `${d.firstName || ""} ${d.lastName || ""}`.toLowerCase();
        const email = String(d.email || "").toLowerCase();
        const specialty = String(d.specialty || "").toLowerCase();
        const availability = String(
          buildDoctorAvailabilityLabel(d) || "",
        ).toLowerCase();
        const phone = String(d.phone || "").toLowerCase();
        const receptionist =
          `${d.receptionistName || ""} ${d.receptionistPhone || ""} ${d.receptionistEmail || ""}`.toLowerCase();
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
    if (!hideDoctorFilters) {
      [
        "doctor-filter-name",
        "doctor-filter-email",
        "doctor-filter-specialty",
        "doctor-filter-availability",
        "doctor-filter-phone",
        "doctor-filter-receptionist",
        "doctor-filter-clinic",
      ].forEach((id) => {
        document
          .getElementById(id)
          ?.addEventListener("input", applyDoctorFilters);
      });
    }
    renderRows(doctors);
    document
      .getElementById("export-doctors-csv")
      ?.addEventListener("click", () => {
        downloadCsv(
          `doctors-${Date.now()}.csv`,
          doctors.map((d) => ({
            name: `${d.firstName || ""} ${d.lastName || ""}`.trim(),
            email: d.email || "",
            specialty: d.specialty || "",
            clinic: d.affiliatedClinics || "",
            receptionist: d.receptionistName || "",
          })),
        );
      });
    window.showDoctorForm = showDoctorForm;
    window.editDoctor = editDoctor;
    window.deleteDoctor = deleteDoctor;
    window.bookDoctorFromDoctorsTab = () => {
      window.location.hash = "#book";
      renderPatientBooking();
    };
    document
      .getElementById("invite-receptionist-form")
      ?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const feedback = document.getElementById(
          "invite-receptionist-feedback",
        );
        const email = String(new FormData(form).get("email") || "").trim();
        if (!email) return;
        feedback.style.display = "block";
        feedback.className = "feedback";
        feedback.textContent = "Inviting receptionist...";
        try {
          const inviteRes = await apiRequest(
            `${API_BASE}/doctors/clinic-staff/invite`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            },
          );
          if (!inviteRes.ok) {
            throw new Error(
              await getApiErrorMessage(
                inviteRes,
                "Failed to invite receptionist",
              ),
            );
          }
          feedback.className = "feedback success";
          const data = await inviteRes.json();

          feedback.className = "feedback success";
          feedback.textContent =
            data.message +
            (data.emailStatus === "failed"
              ? " (Email failed to send)"
              : " (Invitation email sent)");
          form.reset();
        } catch (error) {
          feedback.className = "feedback error";
          feedback.textContent =
            error.message || "Failed to invite receptionist.";
        }
      });
    if (isDoctor && doctors[0]) {
      const toggle = document.getElementById("doctor-allow-receptionist-docs");
      if (toggle) {
        toggle.checked = Boolean(doctors[0].allowReceptionistSendDocuments);
        toggle.addEventListener("change", async () => {
          try {
            const upRes = await apiRequest(
              `${API_BASE}/doctors/${doctors[0]._id}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  allowReceptionistSendDocuments: toggle.checked,
                }),
              },
            );
            if (!upRes.ok)
              throw new Error(
                await getApiErrorMessage(upRes, "Failed to update permission"),
              );
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
    <div class="modal-sheet card">
    <button type="button" class="modal-close-x" aria-label="Close" onclick="window.closeDoctorForm()">&times;</button>
    <form id="doctor-form">
      <h3>${editId ? "Edit" : "Add"} Doctor</h3>
      <label>Title
        <select name="title">
          <option value="">(blank)</option>
          <option value="Dr.">Dr.</option>
          <option value="Dra.">Dra.</option>
          <option value="MD">MD</option>
          <option value="DO">DO</option>
          <option value="Consultant">Consultant</option>
        </select>
      </label>
      <label>First Name <input name="firstName" required /></label>
      <label>Last Name <input name="lastName" required /></label>
      <label>Email <input name="email" type="email" required /></label>
      <label><span class="label-text-row" data-tooltip="Set the primary board-certified specialty used for grouping and scheduling.">Primary Specialty</span><input name="specialty" list="doctor-specialties" required /></label>
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
    </div>
  `;
  window.closeDoctorForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("doctor-form");
  addInlineTooltips(form);
  attachClearButtons(form);
  enforcePhoneInputs(form);
  if (editId) {
    apiRequest(`${API_BASE}/doctors/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.title.value = data.title || "";
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
                    : `${slot.day || ""} ${slot.startTime || ""}-${slot.endTime || ""}`.trim(),
                )
                .join("\n")
            : "");
        form.room.value = data.room || "";
        form.affiliatedClinics.value = data.affiliatedClinics || "";
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
        const match = row.match(
          /^(.+?)\s+(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})$/,
        );
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
        },
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
    const res = await apiRequest(`${API_BASE}/doctors/${id}`, {
      method: "DELETE",
    });
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
      ]),
    );
    const patientLookup = new Map(
      patients.map((patient) => [
        String(patient._id),
        `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
      ]),
    );
    mainContent.innerHTML = `
      <h2 class="page-title page-title-appointments">Appointments</h2>
      <button class="cta-primary" onclick="window.showAppointmentForm()">Add Appointment</button>
      ${getCurrentUserRole() === "admin" ? '<button class="cta-primary btn-secondary" id="export-appointments-csv">Export CSV</button>' : ""}
      <hr class="section-divider" />
      <div class="list-filters">
        ${getCurrentUserRole() === "receptionist" ? "" : '<input type="search" id="appt-filter-doctor" placeholder="Filter by doctor" />'}
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
            <tr class="${String(a.status || "").toLowerCase() === "cancelled" ? "row-cancelled" : ""}">
              <td>${doctorLookup.get(String(a.doctor?._id || a.doctor)) || a.doctor || ""}</td>
              <td>${a.patientId?.name || patientLookup.get(String(a.patient?._id || a.patient)) || "Unknown Patient"}${a.patientId?.title ? ` (${a.patientId.title})` : ""}</td>
              <td>${formatDateDisplay(a.date) || ""}</td>
              <td>${a.time || ""}</td>
              <td><span class="status-pill status-${String(a.status || "pending").toLowerCase()}">${a.status || ""}</span></td>
              <td>
                <button class="btn btn-secondary btn-action-edit" onclick="window.editAppointment('${
                  a._id
                }')">Edit</button>
                <button class="btn btn-action-delete" onclick="window.deleteAppointment('${
                  a._id
                }')">Delete</button>
              </td>
            </tr>
          `,
        )
        .join("");
    };
    const applyAppointmentFilters = () => {
      const doctorQ = String(
        document.getElementById("appt-filter-doctor")?.value || "",
      )
        .toLowerCase()
        .trim();
      const patientQ = String(
        document.getElementById("appt-filter-patient")?.value || "",
      )
        .toLowerCase()
        .trim();
      const dateQ = String(
        document.getElementById("appt-filter-date")?.value || "",
      )
        .toLowerCase()
        .trim();
      const timeQ = String(
        document.getElementById("appt-filter-time")?.value || "",
      )
        .toLowerCase()
        .trim();
      const statusQ = String(
        document.getElementById("appt-filter-status")?.value || "",
      )
        .toLowerCase()
        .trim();
      const filtered = appointments.filter((a) => {
        const doctor = String(
          doctorLookup.get(String(a.doctor?._id || a.doctor)) || a.doctor || "",
        ).toLowerCase();
        const patient = String(
          patientLookup.get(String(a.patient?._id || a.patient)) ||
            a.patient ||
            "",
        ).toLowerCase();
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
    [
      "appt-filter-doctor",
      "appt-filter-patient",
      "appt-filter-date",
      "appt-filter-time",
      "appt-filter-status",
    ].forEach((id) => {
      document
        .getElementById(id)
        ?.addEventListener("input", applyAppointmentFilters);
    });
    renderRows(appointments);
    document
      .getElementById("export-appointments-csv")
      ?.addEventListener("click", () => {
        downloadCsv(
          `appointments-${Date.now()}.csv`,
          appointments.map((a) => ({
            doctor:
              doctorLookup.get(String(a.doctor?._id || a.doctor)) ||
              a.doctor ||
              "",
            patient:
              a.patientId?.name ||
              patientLookup.get(String(a.patient?._id || a.patient)) ||
              "Unknown Patient",
            date: formatDateForInput(a.date),
            time: a.time || "",
            status: a.status || "",
          })),
        );
      });
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
    window.closeAppointmentForm = () => {
      modal.style.display = "none";
    };
    modal.innerHTML = `
      <div class="modal-sheet card">
        <button type="button" class="modal-close-x" aria-label="Close" onclick="window.closeAppointmentForm()">&times;</button>
        <div class="feedback error">Failed to load doctors and patients.</div>
      </div>`;
    return;
  }

  const doctorOptions = doctors
    .map((doctor) => {
      const fullName =
        `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim();
      const specialty = doctor.specialty || "No specialty";
      const availability = buildDoctorAvailabilityLabel(doctor);
      return `<option value="${doctor._id}">${fullName} - ${specialty} (${availability})</option>`;
    })
    .join("");

  const patientOptions = patients
    .map((patient) => {
      const fullName =
        `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
      return `<option value="${patient._id}">${fullName} (${patient.email || "No email"})</option>`;
    })
    .join("");

  modal.innerHTML = `
    <div class="modal-sheet card">
    <button type="button" class="modal-close-x" aria-label="Close" onclick="window.closeAppointmentForm()">&times;</button>
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
    </div>
  `;
  window.closeAppointmentForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("appointment-form");
  attachClearButtons(form);
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
        },
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
    const isAdminUser = role === "admin";
    const isReceptionist = role === "receptionist";
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
      ${isReceptionist ? "" : '<button class="cta-primary" onclick="window.showUserForm()">Add User</button>'}
      <hr class="section-divider" />
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Receptionist Type</th><th>Specialty</th><th>Phone</th><th>Actions</th></tr></thead>
        <tbody>
          ${users
            .map(
              (u) => `
            <tr>
              <td>${u.title ? `${u.title} ` : ""}${u.firstName} ${u.lastName}</td>
              <td>${u.email || ""}</td>
              <td>${u.role || ""}</td>
              <td>${u.receptionistType === "small_clinic" ? "Small Clinic" : u.receptionistType === "hospital" ? "Hospital" : "—"}</td>
              <td>${u.specialty || "—"}</td>
              <td>${u.phone || ""}</td>
              <td>
                ${
                  isReceptionist
                    ? "—"
                    : `<button type="button" class="btn btn-secondary btn-action-edit" onclick="window.editUser('${u._id}')">Edit</button>${
                        isAdminUser
                          ? `<button type="button" class="btn btn-action-delete" onclick="window.deleteUser('${u._id}')">Delete</button>`
                          : ""
                      }`
                }
              </td>
            </tr>
          `,
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
    <div class="modal-sheet card">
    <button type="button" class="modal-close-x" aria-label="Close" onclick="window.closeUserForm()">&times;</button>
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
      <label id="user-receptionist-type-wrap">Receptionist Type
        <select name="receptionistType">
          <option value="">Select type</option>
          <option value="small_clinic">Small Clinic</option>
          <option value="hospital">Hospital</option>
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
    </div>
  `;
  window.closeUserForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("user-form");
  attachClearButtons(form);
  enforcePhoneInputs(form);
  const specialtyWrap = form.querySelector("#user-specialty-wrap");
  const receptionistTypeWrap = form.querySelector(
    "#user-receptionist-type-wrap",
  );
  const roleSelect = form.querySelector('select[name="role"]');
  const syncSpecialtyVisibility = () => {
    const isDoctorRole =
      String(roleSelect?.value || "").toLowerCase() === "doctor";
    const isReceptionistRole =
      String(roleSelect?.value || "").toLowerCase() === "receptionist";
    specialtyWrap.style.display = isDoctorRole ? "" : "none";
    receptionistTypeWrap.style.display = isReceptionistRole ? "" : "none";
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
        form.receptionistType.value = data.receptionistType || "";
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
        },
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
    const res = await apiRequest(`${API_BASE}/users/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete user");
    renderUsers();
  } catch (err) {
    showToast(err.message, "error");
  }
}
