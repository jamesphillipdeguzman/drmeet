/**
 * frontend/src/js/modules/users.js
 * User Directory & Profile Management Module
 */

import { API_BASE } from "../config/api.js";
import { escapeHtml, attachClearButtons, enforcePhoneInputs } from "../core/ui.js";
import { ensureDoctorSpecialtiesLoaded, getDoctorSpecialties } from "./doctors.js";

// Global environment handlers injected from app.js
let apiRequest = null;
let getCurrentUserRole = null;
let showToast = null;
let showDangerConfirm = null;
let mainContent = null;
let setPageTone = null;

export function initUsersModule(config = {}) {
  apiRequest = config.apiRequest || null;
  getCurrentUserRole = config.getCurrentUserRole || null;
  showToast = config.showToast || null;
  showDangerConfirm = config.showDangerConfirm || null;
  mainContent = config.mainContent || document.getElementById("main-content");
  setPageTone = config.setPageTone || null;
}

// --- Users ---
export async function renderUsers() {
  const el = mainContent || document.getElementById("main-content");
  if (!el) return;

  if (setPageTone) setPageTone("users");
  el.innerHTML =
    '<h2 class="page-title page-title-users">Users</h2><div class="feedback">Loading...</div>';
  try {
    const role = getCurrentUserRole();
    if (!["doctor", "receptionist", "admin"].includes(String(role || ""))) {
      el.innerHTML = `<h2 class="page-title page-title-users">Users</h2><div class="feedback error">The Users directory is available to doctor, receptionist, and admin accounts.</div>`;
      return;
    }
    const isAdminUser = role === "admin";
    const isReceptionist = role === "receptionist";
    const res = await apiRequest(`${API_BASE}/users`);
    if (!res.ok) throw new Error("Failed to fetch users");
    const users = await res.json();
    el.innerHTML = `
      <h2 class="page-title page-title-users">Users</h2>
      <div class="appointments-toolbar">
        <button type="button" class="btn btn-secondary" id="users-refresh-btn">Refresh</button>
        ${isReceptionist ? "" : '<button class="cta-primary" onclick="window.showUserForm()">Add User</button>'}
      </div>
      <hr class="section-divider" />
      <div class="list-filters">
        <input type="search" id="user-filter-name" placeholder="Filter by name" />
        <input type="search" id="user-filter-email" placeholder="Filter by email" />
        <input type="search" id="user-filter-role" placeholder="Filter by role" />
        <input type="search" id="user-filter-phone" placeholder="Filter by phone" />
        <select id="user-sort-name">
          <option value="az">Sort Name A-Z</option>
          <option value="za">Sort Name Z-A</option>
        </select>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Actions</th></tr></thead>
        <tbody id="users-table-body">
          ${users
        .map(
          (u) => `
            <tr>
              <td>${u.title ? `${u.title} ` : ""}${u.firstName} ${u.lastName}</td>
              <td>${u.email || ""}</td>
              <td>${u.role || ""}</td>
              <td>${u.phone || ""}</td>
              <td>
                ${isReceptionist
              ? "—"
              : `<button type="button" class="btn btn-secondary btn-action-edit" onclick="window.editUser('${u._id}')">Edit</button>${isAdminUser
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
    const userBody = document.getElementById("users-table-body");
    const renderUserRows = (list) => {
      userBody.innerHTML = list
        .map(
          (u) => `
            <tr>
              <td>${u.title ? `${u.title} ` : ""}${u.firstName} ${u.lastName}</td>
              <td>${u.email || ""}</td>
              <td>${u.role || ""}</td>
              <td>${u.phone || ""}</td>
              <td>
                ${isReceptionist
              ? "—"
              : `<button type="button" class="btn btn-secondary btn-action-edit" onclick="window.editUser('${u._id}')">Edit</button>${isAdminUser
                ? `<button type="button" class="btn btn-action-delete" onclick="window.deleteUser('${u._id}')">Delete</button>`
                : ""
              }`
            }
              </td>
            </tr>
          `,
        )
        .join("");
    };
    const applyUserFilters = () => {
      const nameQ = String(document.getElementById("user-filter-name")?.value || "").toLowerCase().trim();
      const emailQ = String(document.getElementById("user-filter-email")?.value || "").toLowerCase().trim();
      const roleQ = String(document.getElementById("user-filter-role")?.value || "").toLowerCase().trim();
      const phoneQ = String(document.getElementById("user-filter-phone")?.value || "").toLowerCase().trim();
      const sortQ = String(document.getElementById("user-sort-name")?.value || "az");
      const filtered = users
        .filter((u) => {
          const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
          const email = String(u.email || "").toLowerCase();
          const roleStr = String(u.role || "").toLowerCase();
          const phone = String(u.phone || "").toLowerCase();
          return (
            (!nameQ || name.includes(nameQ)) &&
            (!emailQ || email.includes(emailQ)) &&
            (!roleQ || roleStr.includes(roleQ)) &&
            (!phoneQ || phone.includes(phoneQ))
          );
        })
        .sort((a, b) => {
          const left = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
          const right = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
          return sortQ === "za" ? right.localeCompare(left) : left.localeCompare(right);
        });
      renderUserRows(filtered);
    };
    ["user-filter-name", "user-filter-email", "user-filter-role", "user-filter-phone", "user-sort-name"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", applyUserFilters);
      document.getElementById(id)?.addEventListener("change", applyUserFilters);
    });
    document.getElementById("users-refresh-btn")?.addEventListener("click", () => {
      void renderUsers();
    });
    applyUserFilters();
    window.showUserForm = showUserForm;
    window.editUser = editUser;
    window.deleteUser = deleteUser;
  } catch (err) {
    el.innerHTML = `<h2>Users</h2><div class="feedback error">${err.message}</div>`;
  }
}

export async function showUserForm(editId = null) {
  await ensureDoctorSpecialtiesLoaded();
  const modal = document.getElementById("user-form-modal");
  if (!modal) return;
  modal.style.display = "block";
  modal.innerHTML = `
    <div class="modal-sheet card">
    <button type="button" class="modal-close-x" aria-label="Close" onclick="window.closeUserForm()">&times;</button>
    <form id="user-form">
      <h3>${editId ? "Edit" : "Add"} User</h3>
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
      <label id="user-receptionist-type-wrap">Receptionist Type
        <select name="receptionistType">
          <option value="">Select type</option>
          <option value="small_clinic">Small Clinic</option>
          <option value="hospital">Hospital</option>
        </select>
      </label>
      <label id="user-specialty-wrap">Specialty <input name="specialty" list="doctor-specialties-user" placeholder="Used when role is doctor" /></label>
      <datalist id="doctor-specialties-user">
        ${[...new Set(getDoctorSpecialties())].map((s) => `<option value="${s}"></option>`).join("")}
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

export function editUser(id) {
  showUserForm(id);
}

export async function deleteUser(id) {
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
