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

function formatRoleBadge(r) {
  const roleStr = String(r || "").toLowerCase();
  switch (roleStr) {
    case "super_admin":
      return '<span class="status-badge badge-super-admin" style="background:#4f46e5; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">SUPER ADMIN</span>';
    case "hospital_admin":
    case "admin":
      return '<span class="status-badge badge-hospital-admin" style="background:#0284c7; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">HOSPITAL ADMIN</span>';
    case "doctor":
      return '<span class="status-badge" style="background:#059669; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">DOCTOR</span>';
    case "nurse":
      return '<span class="status-badge" style="background:#0d9488; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">NURSE</span>';
    case "billing_specialist":
      return '<span class="status-badge" style="background:#d97706; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">BILLING SPECIALIST</span>';
    case "receptionist":
      return '<span class="status-badge" style="background:#65a30d; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">RECEPTIONIST</span>';
    case "lab_technician":
      return '<span class="status-badge" style="background:#7c3aed; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">LAB TECHNICIAN</span>';
    case "pharmacist":
      return '<span class="status-badge" style="background:#db2777; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">PHARMACIST</span>';
    default:
      return '<span class="status-badge" style="background:#64748b; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">PATIENT</span>';
  }
}

function formatPlanBadge(plan) {
  const p = String(plan || "starter").toLowerCase();
  if (p === "enterprise") {
    return '<span class="status-badge" style="background:#7c3aed; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">ENTERPRISE</span>';
  }
  if (p === "pro") {
    return '<span class="status-badge" style="background:#0284c7; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">CLINIC PRO</span>';
  }
  return '<span class="status-badge" style="background:#64748b; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.75rem;">FREE</span>';
}

// --- Users ---
export async function renderUsers() {
  const el = mainContent || document.getElementById("main-content");
  if (!el) return;

  if (setPageTone) setPageTone("users");
  el.innerHTML =
    '<h2 class="page-title page-title-users">Users</h2><div class="feedback">Loading...</div>';
  try {
    const role = String(getCurrentUserRole() || "").toLowerCase();
    const isSuperAdmin = role === "super_admin";
    const isHospitalAdmin = role === "hospital_admin" || role === "admin";
    const isDoctor = role === "doctor";
    const isReceptionist = role === "receptionist";
    const canManageUsers = isSuperAdmin || isHospitalAdmin;

    if (!canManageUsers && !isDoctor && !isReceptionist) {
      el.innerHTML = `<h2 class="page-title page-title-users">Users</h2><div class="feedback error">The Users directory is available to administrators and authorized staff accounts.</div>`;
      return;
    }

    const res = await apiRequest(`${API_BASE}/users`);
    if (!res.ok) throw new Error("Failed to fetch users");
    const users = await res.json();
    el.innerHTML = `
      <h2 class="page-title page-title-users">Users</h2>
      <div class="appointments-toolbar">
        <button type="button" class="btn btn-secondary" id="users-refresh-btn">Refresh</button>
        ${canManageUsers ? '<button class="cta-primary" onclick="window.showUserForm()">Add User</button>' : ''}
      </div>
      <hr class="section-divider" />
      <div class="list-filters" style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem;">
        <div class="relative w-full max-w-xl" style="position: relative; flex: 1; min-width: 280px; max-width: 36rem; display: flex; align-items: center;">
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">🔍</span>
          <input 
            type="text" 
            id="users-unified-search" 
            placeholder="Search users by name, email, role, phone, or plan..." 
            class="search-input-unified"
            style="width: 100%; padding: 8px 36px 8px 48px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem;"
          />
          <button 
            type="button" 
            id="users-search-clear"
            class="search-clear-btn hidden"
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <select id="user-sort-name" style="padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.875rem;">
          <option value="az">Sort Name A-Z</option>
          <option value="za">Sort Name Z-A</option>
        </select>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th>${isSuperAdmin ? "<th>Plan / Tier</th>" : ""}<th>Phone</th><th>Actions</th></tr></thead>
        <tbody id="users-table-body">
          ${users
        .map(
          (u) => `
            <tr>
              <td>${u.title ? `${u.title} ` : ""}${u.firstName} ${u.lastName}</td>
              <td>${u.email || ""}</td>
              <td>${formatRoleBadge(u.role)}</td>
              ${isSuperAdmin ? `<td>${formatPlanBadge(u.subscriptionPlan)}</td>` : ""}
              <td>${u.phone || ""}</td>
              <td>
                ${canManageUsers
              ? `<button type="button" class="btn btn-secondary btn-action-edit" onclick="window.editUser('${u._id}')">Edit</button><button type="button" class="btn btn-action-delete" onclick="window.deleteUser('${u._id}')">Delete</button>`
              : "—"
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
              <td>${formatRoleBadge(u.role)}</td>
              ${isSuperAdmin ? `<td>${formatPlanBadge(u.subscriptionPlan)}</td>` : ""}
              <td>${u.phone || ""}</td>
              <td>
                ${canManageUsers
              ? `<button type="button" class="btn btn-secondary btn-action-edit" onclick="window.editUser('${u._id}')">Edit</button><button type="button" class="btn btn-action-delete" onclick="window.deleteUser('${u._id}')">Delete</button>`
              : "—"
            }
              </td>
            </tr>
          `,
        )
        .join("");
    };
    const userSearchInput = document.getElementById("users-unified-search");
    const userSearchClear = document.getElementById("users-search-clear");
    const applyUserFilters = () => {
      const q = String(userSearchInput?.value || "").toLowerCase().trim();
      if (userSearchClear) {
        userSearchClear.style.display = q.length > 0 ? "block" : "none";
      }
      const sortQ = String(document.getElementById("user-sort-name")?.value || "az");
      const filtered = users
        .filter((u) => {
          const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
          const email = String(u.email || "").toLowerCase();
          const roleStr = String(u.role || "").toLowerCase();
          const phone = String(u.phone || "").toLowerCase();
          const plan = String(u.subscriptionPlan || "").toLowerCase();
          return (
            !q ||
            name.includes(q) ||
            email.includes(q) ||
            roleStr.includes(q) ||
            phone.includes(q) ||
            plan.includes(q)
          );
        })
        .sort((a, b) => {
          const nameA = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
          const nameB = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
          return sortQ === "za" ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
        });
      renderUserRows(filtered);
    };
    userSearchInput?.addEventListener("input", applyUserFilters);
    userSearchClear?.addEventListener("click", () => {
      if (userSearchInput) userSearchInput.value = "";
      applyUserFilters();
    });
    document.getElementById("user-sort-name")?.addEventListener("change", applyUserFilters);
    document.getElementById("users-refresh-btn")?.addEventListener("click", renderUsers);
    
    window.showUserForm = showUserForm;
    window.editUser = (id) => showUserForm(id);
    window.deleteUser = async (id) => {
      if (!showDangerConfirm) {
        if (!confirm("Are you sure you want to delete this user?")) return;
      } else {
        const ok = await showDangerConfirm("Delete User", "Are you sure you want to delete this user?");
        if (!ok) return;
      }
      try {
        const res = await apiRequest(`${API_BASE}/users/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete user");
        if (showToast) showToast("User deleted successfully.");
        renderUsers();
      } catch (err) {
        alert(err.message);
      }
    };
  } catch (err) {
    el.innerHTML = `<h2 class="page-title page-title-users">Users</h2><div class="feedback error">${escapeHtml(err.message)}</div>`;
  }
}

export async function showUserForm(editId = null) {
  await ensureDoctorSpecialtiesLoaded();
  const modal = document.getElementById("user-form-modal");
  if (!modal) return;
  const currentUserId = String(getCurrentUserId() || "");
  const isPlatformSuperAdmin = String(getCurrentUserRole() || "").toLowerCase() === "super_admin";
  const isSelfEdit = Boolean(editId && String(editId) === currentUserId);
  const canEditRoleAndPlan = isPlatformSuperAdmin && !isSelfEdit;

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
        <select name="role" ${canEditRoleAndPlan ? "required" : "disabled"} style="${!canEditRoleAndPlan ? "background:#f1f5f9; cursor:not-allowed; opacity:0.8;" : ""}">
          <option value="hospital_admin">Hospital Admin</option>
          <option value="super_admin">Super Admin</option>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
          <option value="receptionist">Receptionist</option>
          <option value="billing_specialist">Billing Specialist</option>
          <option value="lab_technician">Lab Technician</option>
          <option value="pharmacist">Pharmacist</option>
          <option value="patient">Patient</option>
        </select>
        ${isSelfEdit
          ? `<small style="display:block; color:#64748b; margin-top:2px;">Self-editing of role or subscription plan is restricted to prevent accidental permission loss.</small>`
          : (!isPlatformSuperAdmin
            ? `<small style="display:block; color:#dc2626; margin-top:2px;">Only Super Admin can modify user roles or subscription tiers.</small>`
            : ""
          )
        }
      </label>
      <label>Subscription Tier / Plan
        <select name="subscriptionPlan" ${canEditRoleAndPlan ? "required" : "disabled"} style="${!canEditRoleAndPlan ? "background:#f1f5f9; cursor:not-allowed; opacity:0.8;" : ""}">
          <option value="starter">Free (Starter)</option>
          <option value="pro">Clinic Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        ${isSelfEdit
          ? `<small style="display:block; color:#64748b; margin-top:2px;">Self-editing of subscription tier is restricted.</small>`
          : (!isPlatformSuperAdmin
            ? `<small style="display:block; color:#dc2626; margin-top:2px;">Only Super Admin can modify user roles or subscription tiers.</small>`
            : ""
          )
        }
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
    try {
      const res = await apiRequest(`${API_BASE}/users/${editId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to fetch user details.");
      }
      const data = await res.json();
      form.firstName.value = data.firstName || "";
      form.lastName.value = data.lastName || "";
      form.email.value = data.email || "";
      form.title.value = data.title || "";
      if (form.role) form.role.value = data.role || "patient";
      if (form.subscriptionPlan) {
        form.subscriptionPlan.value = data.subscriptionPlan || "starter";
      }
      if (form.receptionistType) form.receptionistType.value = data.receptionistType || "";
      if (form.specialty) form.specialty.value = data.specialty || "";
      form.phone.value = data.phone || "";
      form.address.value = data.address || "";
      syncSpecialtyVisibility();
    } catch (err) {
      if (typeof showToast === "function") {
        showToast(err.message || "Failed to load target user details.", "error");
      }
    }
  } else {
    syncSpecialtyVisibility();
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const user = Object.fromEntries(new FormData(form));
    if (!canEditRoleAndPlan) {
      delete user.role;
      delete user.subscriptionPlan;
    }
    try {
      const res = await apiRequest(
        `${API_BASE}/users${editId ? "/" + editId : ""}`,
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        },
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to save user");
      }
      modal.style.display = "none";
      renderUsers();
    } catch (err) {
      if (typeof showToast === "function") {
        showToast(err.message, "error");
      } else {
        alert(err.message);
      }
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
