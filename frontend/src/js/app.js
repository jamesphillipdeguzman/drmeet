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
const dashboardSubscribers = [];
const dashboardState = {
  messageBoard: [],
  smsFeed: [
    { from: "Maria T.", message: "I can do tomorrow morning.", status: "pending" },
    { from: "James K.", message: "Confirmed for 3:00 PM.", status: "confirmed" },
  ],
};

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

function formatDateForInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
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
    if (Array.isArray(parsed.messageBoard)) {
      dashboardState.messageBoard = parsed.messageBoard;
    }
    if (Array.isArray(parsed.smsFeed) && parsed.smsFeed.length) {
      dashboardState.smsFeed = parsed.smsFeed;
    }
  } catch (error) {
    console.warn("Unable to load dashboard state", error);
  }
}

function persistDashboardState() {
  localStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify(dashboardState));
}

function subscribeDashboard(listener) {
  dashboardSubscribers.push(listener);
}

function notifyDashboardSubscribers() {
  dashboardSubscribers.forEach((listener) => listener(dashboardState));
}

async function checkAuthStatus() {
  try {
    const res = await fetch(`${API_ORIGIN}/auth/status`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const data = await res.json();
    if (data?.authenticated) {
      updateAuthNav();
    }
  } catch (error) {
    console.warn("Auth status check failed:", error);
  }
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
    default:
      renderHome();
  }
}

function renderHome() {
  mainContent.innerHTML = `
    <section class="dashboard-intro card">
      <h1>Welcome to DrMeet</h1>
      <p>Premium clinic command center for care teams. Use the command palette (Ctrl/Cmd+K) to quickly navigate.</p>
    </section>
    <section class="dashboard-grid">
      <article class="card board-card">
        <div class="card-header">
          <h3>Message Board</h3>
          <button class="btn" id="add-board-message">Add Message</button>
        </div>
        <div id="message-board-list" class="masonry-grid"></div>
      </article>
      <article class="card sms-card">
        <div class="card-header">
          <h3>SMS Feed</h3>
        </div>
        <div id="sms-feed-list" class="chat-thread"></div>
      </article>
    </section>
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

  boardContainer.innerHTML = createSkeletonRows(2);
  smsContainer.innerHTML = createSkeletonRows(3);
  setTimeout(() => {
    renderMessageBoard(boardContainer);
    renderSmsFeed(smsContainer);
  }, 350);

  addButton?.addEventListener("click", () => {
    const note = prompt("Add dashboard message");
    if (!note) return;
    dashboardState.messageBoard.unshift({
      id: `msg-${Date.now()}`,
      title: "Team update",
      body: note,
      tags: ["NDIS", "Urgent", "Physio"].slice(0, 1 + (Date.now() % 3)),
      createdAt: new Date().toISOString(),
    });
    persistDashboardState();
    notifyDashboardSubscribers();
  });

  dashboardSubscribers.length = 0;
  subscribeDashboard(() => {
    renderMessageBoard(boardContainer);
    renderSmsFeed(smsContainer);
  });
}

function renderMessageBoard(container) {
  const posts = dashboardState.messageBoard.length
    ? dashboardState.messageBoard
    : [
        {
          id: "seed-1",
          title: "Follow-up queue",
          body: "Prioritize respiratory reviews before 3pm handover.",
          tags: ["Urgent", "Physio"],
          createdAt: new Date().toISOString(),
        },
      ];
  container.innerHTML = posts
    .map(
      (post) => `
      <article class="message-card">
        <div class="message-meta">
          ${(post.tags || []).map((tag) => `<span class="chip">#${tag}</span>`).join("")}
        </div>
        <h4>${post.title}</h4>
        <p>${post.body}</p>
        <div class="quick-actions">
          <button type="button">Reply</button>
          <button type="button">Archive</button>
          <button type="button">Pin</button>
        </div>
      </article>
    `
    )
    .join("");
}

function renderSmsFeed(container) {
  container.innerHTML = dashboardState.smsFeed
    .map(
      (sms) => `
      <div class="chat-bubble">
        <div class="chat-head">
          <strong>${sms.from}</strong>
          <span class="status-dot ${sms.status === "confirmed" ? "green" : "yellow"}"></span>
        </div>
        <p>${sms.message}</p>
      </div>
    `
    )
    .join("");
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
      <button type="submit">Login</button>
    </form>
    <button id="google-login-btn" type="button" class="btn" style="background:#ea4335;margin-top:1rem;">Login with Google</button>
    <div id="login-feedback"></div>
  `;
  document.getElementById('google-login-btn').onclick = googleLogin;
  const form = document.getElementById('login-form');
  const feedback = document.getElementById('login-feedback');
  form.onsubmit = async e => {
    e.preventDefault();
    feedback.textContent = 'Logging in...';
    const creds = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch(`${API_ORIGIN}/api/login`, {
        method: 'POST',
        credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const data = await res.json();
      if (data.token) {
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
    <h2>Signup</h2>
    <form id="signup-form">
      <label>First Name <input name="firstName" required /></label>
      <label>Last Name <input name="lastName" required /></label>
      <label>Email <input name="email" type="email" required /></label>
      <label>Password <input name="password" type="password" required /></label>
      <label>Phone <input name="phone" /></label>
      <label>Address <input name="address" /></label>
      <label>Role
        <select name="role">
          <option value="user">User</option>
          <option value="doctor">Doctor</option>
          <option value="patient">Patient</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button type="submit">Signup</button>
    </form>
    <button id="google-signup-btn" type="button" class="btn" style="background:#ea4335;margin-top:1rem;">Signup with Google</button>
    <div id="signup-feedback"></div>
  `;
  document.getElementById('google-signup-btn').onclick = googleLogin;
  const form = document.getElementById('signup-form');
  const feedback = document.getElementById('signup-feedback');
  form.onsubmit = async e => {
    e.preventDefault();
    feedback.textContent = 'Signing up...';
    const user = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch(`${API_ORIGIN}/api/login/auth/signup`, {
        method: 'POST',
        credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (!res.ok) throw new Error('Signup failed');
      const data = await res.json();
      if (data.token) {
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

function googleLogin() {
  const popup = window.open(
    `${API_ORIGIN}/auth/google`,
    'googleLogin',
    'width=500,height=600'
  );
}

function handleGoogleAuthMessage(event) {
  if (!event.data || event.data.type !== 'GOOGLE_AUTH_SUCCESS') return;
  if (event.data.token) {
    localStorage.setItem('token', event.data.token);
    updateAuthNav();
    window.location.hash = '#home';
    renderHome();
  }
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
              <td>${p.dateOfBirth || ""}</td>
              <td>
                <button onclick="window.editPatient('${p._id}')">Edit</button>
                <button onclick="window.deletePatient('${p._id
            }')">Delete</button>
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
      <label>Date of Birth <input name="dateOfBirth" type="date" /></label>
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
      <div style="margin-top:1rem;">
        <button type="submit">${editId ? "Update" : "Add"}</button>
        <button type="button" onclick="window.closePatientForm()">Cancel</button>
      </div>
    </form>
  `;
  window.closePatientForm = () => {
    modal.style.display = "none";
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
        form.dateOfBirth.value = formatDateForInput(data.dateOfBirth || data.birthdate);
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
      if (!res.ok) throw new Error("Failed to save patient");
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
    mainContent.innerHTML = `
      <h2>Doctors</h2>
      <button onclick="window.showDoctorForm()">Add Doctor</button>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Specialization</th><th>Availability</th><th>Phone</th><th>Actions</th></tr></thead>
        <tbody>
          ${doctors
        .map(
          (d) => `
            <tr>
              <td>${d.firstName} ${d.lastName}</td>
              <td>${d.email || ""}</td>
              <td>${d.specialization || ""}</td>
              <td>${buildDoctorAvailabilityLabel(d)}</td>
              <td>${d.phone || ""}</td>
              <td>
                <button onclick="window.editDoctor('${d._id}')">Edit</button>
                <button onclick="window.deleteDoctor('${d._id
            }')">Delete</button>
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
      <label>Specialization <input name="specialization" required /></label>
      <label>Bio <textarea name="bio" placeholder="Short profile"></textarea></label>
      <label>Availability Rules (one per line)
        <textarea name="availabilityText" placeholder="Monday - Friday 10:00-15:00&#10;Saturday 09:00-12:00"></textarea>
      </label>
      <label>Room <input name="room" placeholder="e.g. Room 204" /></label>
      <label>Affiliated Hospitals / Clinics <input name="affiliatedClinics" placeholder="Clinic A, Hospital B" /></label>
      <label>Phone <input name="phone" /></label>
      <label>Address <input name="address" /></label>
      <div style="margin-top:1rem;">
        <button type="submit">${editId ? "Update" : "Add"}</button>
        <button type="button" onclick="window.closeDoctorForm()">Cancel</button>
      </div>
    </form>
  `;
  window.closeDoctorForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("doctor-form");
  if (editId) {
    apiRequest(`${API_BASE}/doctors/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.firstName.value = data.firstName || "";
        form.lastName.value = data.lastName || "";
        form.email.value = data.email || "";
        form.specialization.value = data.specialization || "";
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
      if (!res.ok) throw new Error("Failed to save doctor");
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
              <td>${a.date || ""}</td>
              <td>${a.time || ""}</td>
              <td>${a.status || ""}</td>
              <td>
                <button onclick="window.editAppointment('${a._id
            }')">Edit</button>
                <button onclick="window.deleteAppointment('${a._id
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
      const specialty = doctor.specialization || doctor.specialty || "No specialty";
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
      <div style="margin-top:1rem;">
        <button type="submit">${editId ? "Update" : "Add"}</button>
        <button type="button" onclick="window.closeAppointmentForm()">Cancel</button>
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
    const res = await apiRequest(`${API_BASE}/users`);
    if (!res.ok) throw new Error("Failed to fetch users");
    const users = await res.json();
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
                <button onclick="window.editUser('${u._id}')">Edit</button>
                <button onclick="window.deleteUser('${u._id}')">Delete</button>
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
        <select name="role">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label>Phone <input name="phone" /></label>
      <label>Address <input name="address" /></label>
      <div style="margin-top:1rem;">
        <button type="submit">${editId ? "Update" : "Add"}</button>
        <button type="button" onclick="window.closeUserForm()">Cancel</button>
      </div>
    </form>
  `;
  window.closeUserForm = () => {
    modal.style.display = "none";
  };
  const form = document.getElementById("user-form");
  if (editId) {
    apiRequest(`${API_BASE}/users/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.firstName.value = data.firstName || "";
        form.lastName.value = data.lastName || "";
        form.email.value = data.email || "";
        form.role.value = data.role || "user";
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
