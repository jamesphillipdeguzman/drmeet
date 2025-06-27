// SPA navigation and dynamic content rendering
const mainContent = document.getElementById("main-content");
const navLinks = document.querySelectorAll(".nav-link");
const API_BASE = "https://drmeet-api.onrender.com/api";

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
  updateAuthNav();
  renderPage();
});

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
    default:
      renderHome();
  }
}

function renderHome() {
  mainContent.innerHTML = `
    <h1>Welcome to DrMeet</h1>
    <p>Your modern clinic management system. Use the navigation above to manage patients, doctors, appointments, and users.</p>
  `;
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
    <div id="login-feedback"></div>
  `;
  const form = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
  form.onsubmit = async (e) => {
    e.preventDefault();
    feedback.textContent = "Logging in...";
    const creds = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch(`${API_BASE}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
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
      feedback.textContent = err.message;
      feedback.className = "feedback error";
    }
  };
}

// --- Patients ---
async function renderPatients() {
  mainContent.innerHTML =
    '<h2>Patients</h2><div class="feedback">Loading...</div>';
  try {
    const res = await fetch(`${API_BASE}/patients`);
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
      <label>Address <input name="address" /></label>
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
    fetch(`${API_BASE}/patients/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.firstName.value = data.firstName || "";
        form.lastName.value = data.lastName || "";
        form.email.value = data.email || "";
        form.phone.value = data.phone || "";
        form.dateOfBirth.value = data.dateOfBirth || "";
        form.address.value = data.address || "";
      });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const patient = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch(
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
    const res = await fetch(`${API_BASE}/patients/${id}`, { method: "DELETE" });
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
    const res = await fetch(`${API_BASE}/doctors`);
    if (!res.ok) throw new Error("Failed to fetch doctors");
    const doctors = await res.json();
    mainContent.innerHTML = `
      <h2>Doctors</h2>
      <button onclick="window.showDoctorForm()">Add Doctor</button>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Specialization</th><th>Phone</th><th>Actions</th></tr></thead>
        <tbody>
          ${doctors
        .map(
          (d) => `
            <tr>
              <td>${d.firstName} ${d.lastName}</td>
              <td>${d.email || ""}</td>
              <td>${d.specialization || ""}</td>
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
    fetch(`${API_BASE}/doctors/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.firstName.value = data.firstName || "";
        form.lastName.value = data.lastName || "";
        form.email.value = data.email || "";
        form.specialization.value = data.specialization || "";
        form.phone.value = data.phone || "";
        form.address.value = data.address || "";
      });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const doctor = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch(
        `${API_BASE}/doctors${editId ? "/" + editId : ""}`,
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(doctor),
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
    const res = await fetch(`${API_BASE}/doctors/${id}`, { method: "DELETE" });
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
    const res = await fetch(`${API_BASE}/appointments`);
    if (!res.ok) throw new Error("Failed to fetch appointments");
    const appointments = await res.json();
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
              <td>${a.doctor || ""}</td>
              <td>${a.patient || ""}</td>
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

function showAppointmentForm(editId = null) {
  const modal = document.getElementById("appointment-form-modal");
  modal.style.display = "block";
  modal.innerHTML = `
    <form id="appointment-form">
      <h3>${editId ? "Edit" : "Add"} Appointment</h3>
      <label>Doctor <input name="doctor" required /></label>
      <label>Patient <input name="patient" required /></label>
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
    fetch(`${API_BASE}/appointments/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.doctor.value = data.doctor || "";
        form.patient.value = data.patient || "";
        form.date.value = data.date || "";
        form.time.value = data.time || "";
        form.status.value = data.status || "pending";
        form.notes.value = data.notes || "";
      });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const appointment = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch(
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
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
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
    const res = await fetch(`${API_BASE}/users`);
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
    fetch(`${API_BASE}/users/${editId}`)
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
      const res = await fetch(
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
    const res = await fetch(`${API_BASE}/users/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete user");
    renderUsers();
  } catch (err) {
    alert(err.message);
  }
}
