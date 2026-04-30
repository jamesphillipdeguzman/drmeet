// SPA navigation and dynamic content rendering
const mainContent = document.getElementById("main-content");
const navLinks = document.querySelectorAll(".nav-link");
const sidebar = document.getElementById("app-sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const commandPalette = document.getElementById("command-palette");
const commandInput = document.getElementById("command-input");
const commandResults = document.getElementById("command-results");
const commandPaletteTrigger = document.getElementById("command-palette-trigger");
const API_BASE = "https://drmeet-wqws.onrender.com/api";
const API_ORIGIN = API_BASE.replace("/api", "");
const DASHBOARD_STATE_KEY = "drmeet-dashboard-state";
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
  commandPalette.addEventListener("click", (event) => {
    if (event.target === commandPalette) closeCommandPalette();
  });
}

function getSearchableCommands() {
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

async function resolveDoctorIdForPatientMessaging() {
  const res = await apiRequest(`${API_BASE}/appointments`);
  if (res.ok) {
    const list = await res.json();
    if (Array.isArray(list) && list.length) {
      const row = list.find((a) => a.doctor);
      if (row?.doctor) return String(row.doctor);
    }
  }
  const docRes = await apiRequest(`${API_BASE}/doctors`);
  if (!docRes.ok) return null;
  const doctors = await docRes.json();
  if (Array.isArray(doctors) && doctors[0]?._id) return String(doctors[0]._id);
  return null;
}

async function fetchMyPatientRecord() {
  const res = await apiRequest(`${API_BASE}/patients`);
  if (!res.ok) return null;
  const list = await res.json();
  return Array.isArray(list) && list.length ? list[0] : null;
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

async function sendMessage(text) {
  let conversationId = dashboardState.activeConversationId;

  const userId = getCurrentUserId();
  const role = getCurrentUserRole();

  if (!userId) {
    throw new Error("You must be logged in to send a message.");
  }

  if (!conversationId) {
    if (role !== "patient") {
      throw new Error("Select a conversation before sending a message.");
    }
    const doctorId = await resolveDoctorIdForPatientMessaging();
    if (!doctorId) {
      throw new Error(
        "No assigned doctor found. Book an appointment first so messaging can be enabled.",
      );
    }
    const createdConversationId = await createOrGetConversation(userId, doctorId);

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
  const hash = window.location.hash || "#home";
  setActiveNav(hash);
  switch (hash) {
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

function renderHome() {
  const bookCta =
    getCurrentUserRole() === "patient"
      ? `<p class="dashboard-book-teaser"><a href="#book" class="btn btn-primary">Book a visit</a> <span class="dashboard-book-hint">Search for a doctor and request an appointment.</span></p>`
      : "";
  mainContent.innerHTML = `
    <section class="dashboard-intro card">
      <h1>Welcome to DrMeet</h1>
      <p>Unified Inbox for patient communication. Use the command palette (Ctrl/Cmd+K) to quickly navigate.</p>
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
    <section class="dashboard-grid">
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
    <aside id="thread-drawer" class="thread-drawer hidden"></aside>
  `;
  mountDashboardWidgets();
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

function mountDashboardWidgets() {
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
    const note = prompt("Add dashboard message");
    if (!note) return;
    try {
      if (dashboardState.conversations.length > 0) {
        dashboardState.activeConversationId = String(dashboardState.conversations[0]._id);
        await loadMessages(dashboardState.activeConversationId);
      } else {
        dashboardState.activeConversationId = "";
        dashboardState.messages = [];
      }
      await sendMessage(note);
    } catch (err) {
      alert(err?.message || "Unable to send message");
    }
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

                return `
                  <div class="thread-item ${roleClass}">
                    <div class="thread-item-header">
                      <strong>${displayName}</strong>
                      <small>${msg.createdAt ? formatRelativeTime(msg.createdAt) : ""}</small>
                    </div>
                    <p>${msg.message || ""}</p>
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
    const content = input?.value?.trim();
    if (!content || !conversationId) return;
    if (String(dashboardState.activeConversationId) !== String(conversationId)) {
      dashboardState.activeConversationId = String(conversationId);
    }
    try {
      await sendMessage(content);
      if (input) input.value = "";
    } catch (err) {
      alert(err?.message || "Unable to send message");
    }
  });
}

// --- Authentication ---
function isLoggedIn() {
  return !!localStorage.getItem("token");
}

function updateAuthNav() {
  const loginLink = document.getElementById("login-link");
  if (!loginLink) return;
  if (isLoggedIn()) {
    loginLink.textContent = "Logout";
    loginLink.onclick = (e) => {
      e.preventDefault();
      localStorage.removeItem("token");
      resetMessagingSocket();
      updateAuthNav();
      window.location.hash = "#login";
      renderLogin();
    };
  } else {
    loginLink.textContent = "Login";
    loginLink.onclick = null;
  }
}

function renderLogin() {
  if (isLoggedIn()) {
    mainContent.innerHTML = `
      <div class="feedback success">You are logged in.</div>
      <button onclick="window.logoutUser()">Logout</button>
    `;
    window.logoutUser = () => {
      localStorage.removeItem("token");
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
      feedback.textContent = err.message;
      feedback.className = 'feedback error';
    }
  };
}

function renderSignup() {
  if (isLoggedIn()) {
    mainContent.innerHTML = `<div class="feedback success">You are already logged in.</div>`;
    return;
  }
  mainContent.innerHTML = `
    <h2>Create your patient account</h2>
    <p class="signup-lead">New accounts are registered as patients so you can book visits and message your care team.</p>
    <form id="signup-form">
      <label>First Name <input name="firstName" required /></label>
      <label>Last Name <input name="lastName" required /></label>
      <label>Email <input name="email" type="email" required /></label>
      <label>Password <input name="password" type="password" required /></label>
      <label>Phone <input name="phone" /></label>
      <label>Address <input name="address" /></label>
      <button type="submit" class="btn btn-primary">Create account</button>
    </form>
    <button id="google-signup-btn" type="button" class="btn btn-google" style="margin-top:1rem;">Continue with Google</button>
    <div id="signup-feedback"></div>
  `;
  const googleSignupBtn = document.getElementById('google-signup-btn');
  const form = document.getElementById('signup-form');
  const feedback = document.getElementById('signup-feedback');
  const oauthError = consumeOauthErrorFromHash();
  if (oauthError) {
    clearGoogleAuthLoading(oauthError, true);
    feedback.textContent = oauthError;
    feedback.className = "feedback error";
  }
  googleSignupBtn.onclick = () =>
    googleLogin({ feedbackEl: feedback, buttonEl: googleSignupBtn });
  form.onsubmit = async e => {
    e.preventDefault();
    feedback.textContent = 'Signing up...';
    const user = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch(`${API_ORIGIN}/auth/signup`, {
        method: 'POST',
        credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (!res.ok) throw new Error('Signup failed');
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
      feedback.textContent = err.message;
      feedback.className = 'feedback error';
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

  const popup = window.open(
    `${API_ORIGIN}/auth/google`,
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
      clearGoogleAuthLoading("Google login was closed before completion.", true);
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
  if (!isLoggedIn()) {
    mainContent.innerHTML = `
      <section class="patient-booking-page">
        <div class="patient-booking-hero card">
          <h1>Book a visit</h1>
          <p class="patient-booking-lead">Sign in to search for a doctor and request an appointment.</p>
          <div class="patient-booking-cta-row">
            <a href="#login" class="btn btn-primary">Sign in</a>
            <a href="#signup" class="btn btn-secondary">Create an account</a>
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
  document.getElementById("patient-booking-backdrop").onclick = closeDrawer;

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
  mainContent.innerHTML =
    '<h2>Patients</h2><div class="feedback">Loading...</div>';
  try {
    const res = await apiRequest(`${API_BASE}/patients`);
    if (!res.ok) throw new Error("Failed to fetch patients");
    const patients = await res.json();
    mainContent.innerHTML = `
      <h2>Patients</h2>
      <button onclick="window.showPatientForm()">Add Patient</button>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Date of Birth</th><th>Actions</th></tr></thead>
        <tbody>
          ${patients
        .map(
          (p) => `
            <tr>
              <td>${p.firstName} ${p.lastName}</td>
              <td>${p.email || ""}</td>
              <td>${p.phone || ""}</td>
              <td>${formatDateDisplay(p.birthdate) || ""}</td>
              <td>
                <button class="btn btn-secondary btn-action-edit" onclick="window.editPatient('${p._id}')">Edit</button>
                <button class="btn btn-action-delete" onclick="window.deletePatient('${p._id}')">Delete</button>
              </td>
            </tr>
          `
        )
        .join("")}
        </tbody>
      </table>
      <div id="patient-form-modal" style="display:none"></div>
    `;
    window.showPatientForm = showPatientForm;
    window.editPatient = editPatient;
    window.deletePatient = deletePatient;
  } catch (err) {
    mainContent.innerHTML = `<h2>Patients</h2><div class="feedback error">${err.message}</div>`;
  }
}

function showPatientForm(editId = null) {
  const modal = document.getElementById("patient-form-modal");
  modal.style.display = "block";
  modal.innerHTML = `
    <form id="patient-form">
      <h3>${editId ? "Edit" : "Add"} Patient</h3>
      <label>First Name <input name="firstName" required /></label>
      <label>Last Name <input name="lastName" required /></label>
      <label>Email <input name="email" type="email" required /></label>
      <label>Phone <input name="phone" /></label>
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
      <label>Notes <textarea name="notes" placeholder="Medical notes or reminders"></textarea></label>
      <div class="modal-form-actions">
        <button type="submit" class="btn btn-secondary btn-action-edit">${editId ? "Update" : "Add"}</button>
        <button type="button" class="btn btn-action-delete" onclick="window.closePatientForm()">Cancel</button>
      </div>
    </form>
  `;
  window.closePatientForm = () => {
    modal.style.display = "none";
  };
  modal.onclick = (event) => {
    if (event.target === modal) window.closePatientForm();
  };
  const form = document.getElementById("patient-form");
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
      });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const patient = Object.fromEntries(new FormData(form));
    try {
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
      alert(err.message);
    }
  };
}

function editPatient(id) {
  showPatientForm(id);
}
async function deletePatient(id) {
  if (!confirm("Delete this patient?")) return;
  try {
    const res = await apiRequest(`${API_BASE}/patients/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete patient");
    renderPatients();
  } catch (err) {
    alert(err.message);
  }
}

// --- Doctors ---
async function renderDoctors() {
  mainContent.innerHTML =
    '<h2>Doctors</h2><div class="feedback">Loading...</div>';
  try {
    const res = await apiRequest(`${API_BASE}/doctors`);
    if (!res.ok) throw new Error("Failed to fetch doctors");
    const doctors = await res.json();
    const role = getCurrentUserRole();
    const isAdmin = role === "admin";
    mainContent.innerHTML = `
      <h2>Doctors</h2>
      ${isAdmin ? '<button onclick="window.showDoctorForm()">Add Doctor</button>' : ""}
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Specialty</th><th>Availability</th><th>Phone</th><th>Receptionist</th><th>Actions</th></tr></thead>
        <tbody>
          ${doctors
        .map(
          (d) => `
            <tr>
              <td>${d.firstName} ${d.lastName}</td>
              <td>${d.email || ""}</td>
              <td>${d.specialty || ""}</td>
              <td>${buildDoctorAvailabilityLabel(d)}</td>
              <td>${d.phone || ""}</td>
              <td>
                <div>${d.receptionistName || "—"}</div>
                <div>${d.receptionistPhone || ""}</div>
                <div>${d.receptionistEmail || ""}</div>
              </td>
              <td>
                ${
                  isAdmin
                    ? `<button class="btn btn-secondary btn-action-edit" onclick="window.editDoctor('${d._id}')">Edit</button>
                <button class="btn btn-action-delete" onclick="window.deleteDoctor('${d._id}')">Delete</button>`
                    : `<button class="btn btn-primary btn-action-edit" onclick="window.bookDoctorFromDoctorsTab()">Book an Appointment</button>`
                }
              </td>
            </tr>
          `
        )
        .join("")}
        </tbody>
      </table>
      <div id="doctor-form-modal" style="display:none"></div>
    `;
    window.showDoctorForm = showDoctorForm;
    window.editDoctor = editDoctor;
    window.deleteDoctor = deleteDoctor;
    window.bookDoctorFromDoctorsTab = () => {
      window.location.hash = "#book";
      renderPatientBooking();
    };
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
      <label>Specialty <input name="specialty" required /></label>
      <label>Bio <textarea name="bio" placeholder="Short profile"></textarea></label>
      <label>Availability Rules (one per line)
        <textarea name="availabilityText" placeholder="Monday - Friday 10:00-15:00&#10;Saturday 09:00-12:00"></textarea>
      </label>
      <label>Room <input name="room" placeholder="e.g. Room 204" /></label>
      <label>Affiliated Hospitals / Clinics <input name="affiliatedClinics" placeholder="Clinic A, Hospital B" /></label>
      <label>Phone <input name="phone" /></label>
      <label>Receptionist Name <input name="receptionistName" placeholder="Front desk contact name" /></label>
      <label>Receptionist Phone <input name="receptionistPhone" placeholder="Reception contact number" /></label>
      <label>Receptionist Email <input name="receptionistEmail" type="email" placeholder="reception@clinic.com" /></label>
      <label>Address <input name="address" /></label>
      <div class="modal-form-actions">
        <button type="submit" class="btn btn-secondary btn-action-edit">${editId ? "Update" : "Add"}</button>
        <button type="button" class="btn btn-action-delete" onclick="window.closeDoctorForm()">Cancel</button>
      </div>
    </form>
  `;
  window.closeDoctorForm = () => {
    modal.style.display = "none";
  };
  modal.onclick = (event) => {
    if (event.target === modal) window.closeDoctorForm();
  };
  const form = document.getElementById("doctor-form");
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
      });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const doctor = Object.fromEntries(new FormData(form));
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
      alert(err.message);
    }
  };
}

function editDoctor(id) {
  showDoctorForm(id);
}
async function deleteDoctor(id) {
  if (!confirm("Delete this doctor?")) return;
  try {
    const res = await apiRequest(`${API_BASE}/doctors/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete doctor");
    renderDoctors();
  } catch (err) {
    alert(err.message);
  }
}

// --- Appointments ---
async function renderAppointments() {
  mainContent.innerHTML =
    '<h2>Appointments</h2><div class="feedback">Loading...</div>';
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
      <h2>Appointments</h2>
      <button onclick="window.showAppointmentForm()">Add Appointment</button>
      <table>
        <thead><tr><th>Doctor</th><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${appointments
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
        .join("")}
        </tbody>
      </table>
      <div id="appointment-form-modal" style="display:none"></div>
    `;
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
  modal.onclick = (event) => {
    if (event.target === modal) window.closeAppointmentForm();
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
      alert(err.message);
    }
  };
}

function editAppointment(id) {
  showAppointmentForm(id);
}
async function deleteAppointment(id) {
  if (!confirm("Delete this appointment?")) return;
  try {
    const res = await apiRequest(`${API_BASE}/appointments/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete appointment");
    renderAppointments();
  } catch (err) {
    alert(err.message);
  }
}

// --- Users ---
async function renderUsers() {
  mainContent.innerHTML =
    '<h2>Users</h2><div class="feedback">Loading...</div>';
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
      <h2>Users</h2>
      <button onclick="window.showUserForm()">Add User</button>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Actions</th></tr></thead>
        <tbody>
          ${users
        .map(
          (u) => `
            <tr>
              <td>${u.firstName} ${u.lastName}</td>
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
      <label>Role
        <select name="role" required>
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="receptionist">Receptionist</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label>Phone <input name="phone" /></label>
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
  modal.onclick = (event) => {
    if (event.target === modal) window.closeUserForm();
  };
  const form = document.getElementById("user-form");
  if (editId) {
    apiRequest(`${API_BASE}/users/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.firstName.value = data.firstName || "";
        form.lastName.value = data.lastName || "";
        form.email.value = data.email || "";
        form.role.value = data.role || "patient";
        form.phone.value = data.phone || "";
        form.address.value = data.address || "";
      });
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
      alert(err.message);
    }
  };
}

function editUser(id) {
  showUserForm(id);
}
async function deleteUser(id) {
  if (!confirm("Delete this user?")) return;
  try {
    const res = await apiRequest(`${API_BASE}/users/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete user");
    renderUsers();
  } catch (err) {
    alert(err.message);
  }
}
