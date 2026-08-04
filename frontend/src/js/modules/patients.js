/**
 * frontend/src/js/modules/patients.js
 * Patient Lifecycle & Management Module
 */

import {
  API_BASE,
  CLEAR_SEND_DOC_DOCTOR_KEY,
  DEFAULT_AVATAR_URL,
} from "../config/api.js";

import {
  escapeHtml,
  fileToDataUrl,
  showToast,
} from "../core/ui.js";

// Global environment handlers injected from app.js
let apiRequest = null;
let getApiErrorMessage = null;
let getCurrentUserRole = null;
let getCurrentUserId = null;
let getCurrentLinkedDoctorId = null;
let getCurrentReceptionistType = null;
let formatRelativeTime = null;
let formatDateDisplay = null;
let formatDateForInput = null;
let sendDocumentMessage = null;
let resolvePatientMessageRecipient = null;
let downloadCsv = null;
let loadFacilities = null;
let renderFacilityDatalist = null;
let attachFacilityInputBehavior = null;
let loadHmoProviders = null;
let isAllowedPresetImageUrl = null;
let buildAvatarPresetGridHtml = null;
let wireAvatarPresetGrid = null;
let showDangerConfirm = null;
let ensureAvatarPresetsLoaded = null;
let applyUserRecordToLocalCache = null;
let refreshCurrentUserCacheFromApi = null;
let updateSidebarAccountInfoAndPlan = null;

export function initPatientsModule(handlers = {}) {
  apiRequest = handlers.apiRequest || null;
  getApiErrorMessage = handlers.getApiErrorMessage || null;
  getCurrentUserRole = handlers.getCurrentUserRole || null;
  getCurrentUserId = handlers.getCurrentUserId || null;
  getCurrentLinkedDoctorId = handlers.getCurrentLinkedDoctorId || null;
  getCurrentReceptionistType = handlers.getCurrentReceptionistType || null;
  formatRelativeTime = handlers.formatRelativeTime || null;
  formatDateDisplay = handlers.formatDateDisplay || null;
  formatDateForInput = handlers.formatDateForInput || null;
  sendDocumentMessage = handlers.sendDocumentMessage || null;
  resolvePatientMessageRecipient = handlers.resolvePatientMessageRecipient || null;
  downloadCsv = handlers.downloadCsv || null;
  loadFacilities = handlers.loadFacilities || null;
  renderFacilityDatalist = handlers.renderFacilityDatalist || null;
  attachFacilityInputBehavior = handlers.attachFacilityInputBehavior || null;
  loadHmoProviders = handlers.loadHmoProviders || null;
  isAllowedPresetImageUrl = handlers.isAllowedPresetImageUrl || null;
  buildAvatarPresetGridHtml = handlers.buildAvatarPresetGridHtml || null;
  wireAvatarPresetGrid = handlers.wireAvatarPresetGrid || null;
  showDangerConfirm = handlers.showDangerConfirm || null;
  ensureAvatarPresetsLoaded = handlers.ensureAvatarPresetsLoaded || null;
  applyUserRecordToLocalCache = handlers.applyUserRecordToLocalCache || null;
  refreshCurrentUserCacheFromApi = handlers.refreshCurrentUserCacheFromApi || null;
  updateSidebarAccountInfoAndPlan = handlers.updateSidebarAccountInfoAndPlan || null;
}

// Helpers
export function formatPatientDisplayName(p) {
  if (!p) return "";
  const t = String(p.title || "").trim();
  const nameFromParts = `${p.firstName || ""} ${p.lastName || ""}`.trim();
  const name = nameFromParts || String(p.name || "").trim();
  return `${t ? `${t} ` : ""}${name}`.trim();
}

export function formatPatientFullNameOnly(p) {
  if (!p) return "";
  const fromParts = `${p.firstName || ""} ${p.lastName || ""}`.trim();
  return fromParts || String(p.name || "").trim();
}

export function formatPatientAddress(addr) {
  if (!addr) return "—";
  if (typeof addr === "string") return addr.trim() || "—";
  const a = addr;
  const line = [
    a.address1,
    a.address2,
    a.city,
    a.province,
    a.postcode,
    a.country,
  ]
    .filter(Boolean)
    .join(", ");
  return line || "—";
}

export function sortPatientsByCreated(list, order) {
  const arr = [...list];
  arr.sort((a, b) => {
    const ta = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return order === "oldest" ? ta - tb : tb - ta;
  });
  return arr;
}

// State variable
export let doctorOptionsForSend = "";

// Helper for UI tone setting
function setPageTone(tone) {
  document.body.className = document.body.className
    .split(" ")
    .filter((c) => !c.startsWith("tone-"))
    .join(" ");
  if (tone) document.body.classList.add(`tone-${tone}`);
}

// --- Patients ---
export async function renderPatients(targetContainer = null) {
  const mgmtContainer = document.getElementById("clinical-patients-mgmt-container");
  const container = targetContainer || mgmtContainer || document.getElementById("main-content");
  if (!container) return;

  const isInsideClinical = Boolean(targetContainer || mgmtContainer);
  if (!isInsideClinical && getCurrentUserRole() === "doctor") {
    window.location.hash = "#doctor-dashboard?tab=patients";
  }
  setPageTone("patients");
  container.innerHTML = '<div class="feedback">Loading patients...</div>';
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
          `<option value="${p._id}">${escapeHtml(formatPatientDisplayName(p))}</option>`,
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
    const clearDoctorDropdown =
      localStorage.getItem(CLEAR_SEND_DOC_DOCTOR_KEY) === "1";

    // Formatting helper locally mapped
    const formatDoctorDisplayName = (d) => {
      if (!d) return "";
      const t = String(d.title || "").trim() || "Dr.";
      const name = `${d.firstName || ""} ${d.lastName || ""}`.trim();
      return `${t} ${name}`.trim();
    };

    doctorOptionsForSend = clearDoctorDropdown
      ? ""
      : (
        Array.isArray(clinicDoctors) ? clinicDoctors : []
      )
        .filter((d) => d?.userId)
        .map(
          (d) =>
            `<option value="${d.userId}">${escapeHtml(formatDoctorDisplayName(d))}</option>`,
        )
        .join("");
    if (clearDoctorDropdown) {
      localStorage.removeItem(CLEAR_SEND_DOC_DOCTOR_KEY);
    }
    container.innerHTML = `
      <div class="patients-toolbar">
        <button type="button" class="cta-primary btn-secondary" id="patients-refresh-btn" title="Reload list">Refresh</button>
        <button class="cta-primary" onclick="window.showPatientForm()">Add Patient</button>
        ${isPatient ? '<button class="cta-primary" onclick="window.showFamilyMemberForm()">Register Family Member</button>' : ""}
        ${isAdminUser ? '<button class="cta-primary btn-secondary" id="export-patients-csv">Export CSV</button>' : ""}
      </div>
      ${isPatient
        ? `<section class="card patient-send-doc-card">
        <h3>Send document to clinic</h3>
        <p class="signup-lead">Choose a doctor, attach an image or PDF, and upload. Your clinic receives it in messaging.</p>
        <label>Doctor / clinic
          <select id="patient-send-doc-doctor">
            <option value="">${doctorOptionsForSend ? "Select a doctor" : "No doctor selected (new registration)"}</option>
            ${doctorOptionsForSend}
          </select>
        </label>
        <label>File
          <input type="file" id="patient-send-doc-file" accept="image/*,.pdf,.doc,.docx,.txt" />
        </label>
        <button type="button" class="cta-primary" id="patient-send-doc-btn">Upload</button>
      </section>`
        : ""
      }
      ${isPatient && patients.length
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
      <div class="list-filters" style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem;">
        <div class="relative w-full max-w-xl" style="position: relative; flex: 1; min-width: 280px; max-width: 36rem; display: flex; align-items: center;">
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">🔍</span>
          <input 
            type="text" 
            id="patients-unified-search" 
            placeholder="Search patients by name, email, relationship, or phone..." 
            class="search-input-unified"
            style="width: 100%; padding: 8px 36px 8px 48px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem;"
          />
          <button 
            type="button" 
            id="patients-search-clear"
            class="search-clear-btn hidden"
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <label style="display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">Sort by date added
          <select id="patient-sort-order" style="padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.875rem;">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select> 
        </label>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Profile Type</th><th>Email</th><th>Phone</th><th>Date of Birth</th><th>Added</th>${isClinicalStaff ? "<th>Records</th>" : ""}<th>Actions</th></tr></thead>
        <tbody id="patients-table-body"></tbody>
      </table>
      <div id="patient-form-modal" class="patient-form-modal-host" style="display:none"></div>
    `;
    const bodyEl = document.getElementById("patients-table-body");
    let userRoleById = new Map();
    try {
      const userRes = await apiRequest(`${API_BASE}/users`);
      if (userRes.ok) {
        const userRows = await userRes.json();
        userRoleById = new Map(
          (Array.isArray(userRows) ? userRows : []).map((u) => [
            String(u._id || ""),
            String(u.role || "").toLowerCase(),
          ]),
        );
      }
    } catch (error) {
      userRoleById = new Map();
    }
    const resolveDocumentSenderLabel = (doc) => {
      const fromRole = String(doc?.uploaderRole || "").toLowerCase();
      if (fromRole) return fromRole;
      const uploaderId = String(doc?.uploaderId || "").trim();
      if (!uploaderId) return "doctor";
      return userRoleById.get(uploaderId) || "doctor";
    };
    const formatCreatedDateHelper = (dateVal) => {
      if (typeof formatCreatedDate === "function") {
        return formatCreatedDate(dateVal);
      }
      if (window.formatCreatedDate) {
        return window.formatCreatedDate(dateVal);
      }
      if (!dateVal) return "—";
      const date = new Date(dateVal);
      if (isNaN(date.getTime())) return "—";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const getPatientInitials = (p) => {
      const f = String(p.firstName || "").trim().charAt(0).toUpperCase();
      const l = String(p.lastName || "").trim().charAt(0).toUpperCase();
      if (f || l) return `${f}${l}`;
      const name = String(p.name || "").trim();
      if (name) {
        const parts = name.split(/\s+/);
        if (parts.length >= 2) {
          return `${parts[0].charAt(0).toUpperCase()}${parts[1].charAt(0).toUpperCase()}`;
        }
        return name.substring(0, 2).toUpperCase();
      }
      return "P";
    };

    const renderPatientAvatarHtml = (p) => {
      const photoUrl = String(
        p.profilePhotoUrl ||
        p.avatarUrl ||
        p.photoUrl ||
        p.picture ||
        p.presetAvatarUrl ||
        p.presetAvatar ||
        p.avatarPreset ||
        ""
      ).trim();
      const displayName = escapeHtml(formatPatientDisplayName(p));
      const initials = getPatientInitials(p);

      if (photoUrl) {
        return `<img src="${escapeHtml(photoUrl)}" alt="${displayName}" class="patient-table-avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid #cbd5e1; flex-shrink: 0;" onerror="this.onerror=null; this.outerHTML='<div class=\\'patient-table-avatar-fallback\\' style=\\'width: 36px; height: 36px; border-radius: 50%; background-color: #3b82f6; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; flex-shrink: 0; border: 1px solid #2563eb;\\'>${initials}</div>';" />`;
      }
      return `<div class="patient-table-avatar-fallback" style="width: 36px; height: 36px; border-radius: 50%; background-color: #3b82f6; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; flex-shrink: 0; border: 1px solid #2563eb;" title="${displayName}">${initials}</div>`;
    };

    const renderRecordsCell = (p) => {
      const docs = Array.isArray(p.documents) ? p.documents : [];
      if (!docs.length) return "—";

      const renderSingleDoc = (d) => {
        const docId = d._id || d.id;
        const docName = escapeHtml(d.name || d.fileUrl || d.url || "Document");
        const senderRole = resolveDocumentSenderLabel(d);
        const senderBadge = senderRole === "patient"
          ? `<span class="patient-type-badge patient-type-badge-family" style="font-size:0.65rem; margin-left:4px;">Patient</span>`
          : `<span class="patient-type-badge patient-type-badge-primary" style="font-size:0.65rem; margin-left:4px;">Doctor</span>`;

        const fileUrl = d.fileUrl || d.url || "";
        if (fileUrl) {
          return `<div style="display:block; margin-bottom:4px;"><a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" download class="patient-doc-link text-blue-600 hover:underline" data-doc-id="${docId || ""}">${docName}</a>${senderBadge}</div>`;
        }
        return `<div style="display:block; margin-bottom:4px;"><a href="javascript:void(0);" class="patient-doc-link text-blue-600 hover:underline" data-doc-id="${docId || ""}">${docName}</a>${senderBadge}</div>`;
      };

      if (docs.length <= 2) {
        return docs.map(renderSingleDoc).join("");
      }

      const firstTwoHtml = docs.slice(0, 2).map(renderSingleDoc).join("");
      const remainingHtml = docs.slice(2).map(renderSingleDoc).join("");
      const patientId = String(p._id);

      return `
        <div class="patient-records-wrap" id="patient-records-wrap-${patientId}">
          <div class="patient-records-initial">${firstTwoHtml}</div>
          <div class="patient-records-expanded" id="patient-records-more-${patientId}" style="display:none;">${remainingHtml}</div>
          <button type="button" class="patient-records-toggle-btn text-xs font-semibold" style="background:none; border:none; padding:0; margin-top:2px; cursor:pointer; color:#2563eb;" data-toggle-patient="${patientId}">+ ${docs.length - 2} more</button>
        </div>
      `;
    };

    const renderRows = (list) => {
      if (!list || !list.length) {
        bodyEl.innerHTML = `<tr><td colspan="${isClinicalStaff ? 8 : 7}" class="feedback" style="text-align: center; padding: 1.5rem;">No patient records found.</td></tr>`;
        return;
      }
      bodyEl.innerHTML = list
        .map(
          (p) => `
            <tr>
              <td>
                <div class="patient-name-cell" style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: nowrap; white-space: nowrap;">
                  ${renderPatientAvatarHtml(p)}
                  <span class="patient-name-text" style="font-weight: 600; white-space: nowrap;">${escapeHtml(formatPatientDisplayName(p))}</span>
                </div>
              </td>
              <td>${(() => {
                const isPrimary = typeof p.isPrimaryProfile !== "undefined"
                  ? p.isPrimaryProfile
                  : (!p.relationshipToAccountHolder && (!p.accountOwnerId || String(p.userId || "") === String(p.accountOwnerId || "")));
                if (isPrimary) return "Account Owner";
                return p.relationshipToAccountHolder ? `Family Member (${escapeHtml(p.relationshipToAccountHolder)})` : "Family Member";
              })()}</td>
              <td>${p.email || ""}</td>
              <td>${p.phone || ""}</td>
              <td>${formatDateForInput(p.birthdate)}</td>
              <td>${formatCreatedDateHelper(p.createdAt || p.added)}</td>
              ${isClinicalStaff ? `<td>${renderRecordsCell(p)}</td>` : ""}
              <td>
                <button type="button" class="btn btn-secondary btn-action-edit" onclick="window.editPatient('${p._id}')">Edit</button>
                ${isAdminUser ? `<button type="button" class="btn btn-action-delete" onclick="window.deletePatient('${p._id}')">Delete</button>` : ""}
              </td>
            </tr>
          `,
        )
        .join("");

      bodyEl.querySelectorAll(".patient-records-toggle-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const pid = btn.getAttribute("data-toggle-patient");
          const moreEl = document.getElementById(`patient-records-more-${pid}`);
          if (!moreEl) return;
          const isHidden = moreEl.style.display === "none";
          if (isHidden) {
            moreEl.style.display = "block";
            btn.textContent = "See less";
          } else {
            moreEl.style.display = "none";
            const count = moreEl.querySelectorAll(".patient-doc-link").length;
            btn.textContent = `+ ${count} more`;
          }
        });
      });

      bodyEl.querySelectorAll(".patient-doc-link").forEach((link) => {
        link.addEventListener("click", (e) => {
          const href = link.getAttribute("href");
          if (!href || href === "#" || href.startsWith("javascript:")) {
            e.preventDefault();
          }
        });
      });
    };
    const patientSearchInput = document.getElementById("patients-unified-search");
    const patientSearchClear = document.getElementById("patients-search-clear");
    const applyPatientFilters = () => {
      const q = String(patientSearchInput?.value || "")
        .toLowerCase()
        .trim();
      if (patientSearchClear) {
        patientSearchClear.style.display = q.length > 0 ? "block" : "none";
      }
      const order =
        document.getElementById("patient-sort-order")?.value || "newest";
      const sorted = sortPatientsByCreated(patients, order);
      const filtered = sorted.filter((p) => {
        const name = formatPatientDisplayName(p).toLowerCase();
        const email = String(p.email || "").toLowerCase();
        const phone = String(p.phone || "").toLowerCase();
        const dob = formatDateForInput(p.birthdate).toLowerCase();
        const profileType = (p.isPrimaryProfile ? "account owner" : "family member").toLowerCase();
        const docs = Array.isArray(p.documents) ? p.documents : [];
        const recordsText = docs
          .map((d) => {
            const docName = String(d?.name || d?.fileUrl || d?.url || "");
            const sender = resolveDocumentSenderLabel(d);
            return `${docName} ${sender}`;
          })
          .join(" ")
          .toLowerCase();

        return (
          !q ||
          name.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          dob.includes(q) ||
          profileType.includes(q) ||
          recordsText.includes(q)
        );
      });
      renderRows(filtered);
    };
    patientSearchInput?.addEventListener("input", applyPatientFilters);
    patientSearchClear?.addEventListener("click", () => {
      if (patientSearchInput) {
        patientSearchInput.value = "";
        applyPatientFilters();
        patientSearchInput.focus();
      }
    });
    document
      .getElementById("patient-sort-order")
      ?.addEventListener("change", applyPatientFilters);
    document.getElementById("patients-refresh-btn")?.addEventListener("click", () => {
      void renderPatients(targetContainer);
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
            name: formatPatientDisplayName(p),
            email: p.email || "",
            phone: p.phone || "",
            dob: formatDateForInput(p.birthdate),
          })),
        );
      });
    document
      .getElementById("patient-send-doc-btn")
      ?.addEventListener("click", async () => {
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
      });
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
          await renderPatients();
        } catch (error) {
          showToast(error?.message || "Unable to send document.", "error");
        }
      };
      fileInput.click();
    };
  } catch (err) {
    container.innerHTML = `<h2 class="page-title page-title-patients">Patients</h2><div class="feedback error">${escapeHtml(err?.message || err)}</div>`;
  }
}

// Window actions
window.closePatientForm = function () {
  const modal = document.getElementById("patient-form-modal");
  if (modal) {
    modal.style.display = "none";
    modal.innerHTML = "";
  }
};

export async function showPatientForm(editId = null, familyMode = false) {
  const plan = localStorage.getItem("subscription_plan") || "starter";
  const role = getCurrentUserRole();

  if (!editId && plan === "starter" && ["doctor", "receptionist"].includes(role)) {
    try {
      const checkRes = await apiRequest(`${API_BASE}/patients`);
      if (checkRes.ok) {
        const currentList = await checkRes.json();
        if (Array.isArray(currentList) && currentList.length >= 10) {
          showToast(
            "Starter plan limit reached (10 active patients). Please upgrade to Clinic Pro to add more patients.",
            "error"
          );
          setTimeout(() => {
            window.location.hash = "#pricing";
          }, 1200);
          return;
        }
      }
    } catch (e) { }
  }

  let modal = document.getElementById("patient-form-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "patient-form-modal";
    modal.className = "patient-form-modal-host";
    document.body.appendChild(modal);
  }
  const canAttachExisting =
    !editId && (role === "doctor" || role === "receptionist");
  await ensureAvatarPresetsLoaded();
  modal.style.display = "block";
  const staffRole =
    role === "doctor" || role === "receptionist" || role === "admin";
  modal.innerHTML = `
    <div class="modal-sheet card patient-modal-sheet">
      <button type="button" class="modal-close-x" aria-label="Close" onclick="window.closePatientForm()">&times;</button>
      <form id="patient-form">
      <h3>${editId ? "Edit" : familyMode ? "Register Family Member" : "Add"} Patient</h3>
      ${canAttachExisting
      ? `
      <section class="card" style="padding:0.75rem;">
        <h4 style="margin:0 0 0.45rem;">Search Existing Patient</h4>
        <label>Search by name, email, or phone</label>
        <div class="relative w-full" style="position: relative; width: 100%; margin-top: 0.25rem; display: flex; align-items: center;">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">🔍</span>
            <input 
              type="text" 
              id="patient-existing-search" 
              placeholder="Type at least 2 characters..." 
              class="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-white"
              style="width: 100%; padding: 8px 36px 8px 36px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem;"
            />
            <button 
              type="button" 
              id="patient-existing-search-clear"
              class="search-clear-btn hidden"
              
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        <div id="patient-existing-results" class="feedback" style="display:none"></div>
      </section>
      `
      : ""
    }
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
      <label>Email <input name="email" type="email" ${editId || familyMode ? "" : "required"} placeholder="patient@example.com" /></label>
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
      ${staffRole
      ? `<label><span class="label-text-row" data-tooltip="Used with email and date of birth to prevent duplicate registrations at this site.">Registration facility</span>
        <input list="patient-reg-facility-datalist" name="registrationFacility" required placeholder="Clinic or branch name" autocomplete="off" />
        </label>`
      : `<label><span class="label-text-row" data-tooltip="Include if instructed by your clinic — combined with email and DOB prevents duplicates.">Registration facility</span>
        <input list="patient-reg-facility-datalist" name="registrationFacility" placeholder="Optional" autocomplete="off" /></label>`
    }
      <label class="patient-insured-inline"><input type="checkbox" name="isInsured" id="patient-is-insured" value="true" /><span>Has HMO / insured</span></label>
      <label id="patient-hmo-wrap" style="display:none">HMO provider (required if insured)
        <select name="hmoProvider" id="patient-hmo-select"></select>
      </label>
      <label>Profile Photo
        <input name="profilePhotoFile" type="file" accept="image/*" />
      </label>
      ${buildAvatarPresetGridHtml("patient")}
      <div id="patient-profile-type-badge-wrap" style="margin-bottom: 0.75rem; padding: 0.5rem 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.875rem;">
        <strong>Profile Type:</strong> <span id="patient-profile-type-text">${editId ? "Loading profile type..." : (familyMode ? "Family Member" : "Account Owner (Primary Profile)")}</span>
      </div>
      <div id="patient-relationship-wrap" style="${familyMode ? "display:block" : "display:none"}">
        <label>Relationship to Account Holder <input name="relationshipToAccountHolder" placeholder="e.g. Son, Daughter, Spouse" /></label>
      </div>
      <label>Notes <textarea name="notes" placeholder="Medical notes or reminders"></textarea></label>
      ${isClinicalStaff ? `
        <label>Medical History
          <textarea name="medicalHistory" placeholder="One item per line (e.g. Hypertension, Diabetes)"></textarea>
        </label>
        <div id="patient-existing-documents-container" style="margin-bottom: 0.75rem; display: none;">
          <label style="font-weight: 600; margin-bottom: 0.25rem; display: block;">Existing Records & Documents</label>
          <div id="patient-existing-documents-list" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
        </div>
        <label><span class="label-text-row" data-tooltip="Accepted formats: PDF, DOCX, JPG, PNG. Images and PDFs upload to secure storage.">Upload New Document Record</span>
          <input name="documentFile" type="file" accept="image/*,.pdf,.doc,.docx,.txt" />
        </label>
      ` : ""}
      <datalist id="patient-reg-facility-datalist"></datalist>
      <div class="modal-form-actions">
        <button type="submit" class="btn btn-secondary btn-action-edit">${editId ? "Update" : "Add"}</button>
        <button type="button" class="btn btn-action-delete" onclick="window.closePatientForm()">Cancel</button>
      </div>
    </form>
    </div>
  `;

  modal.querySelector(".modal-close-x")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.closePatientForm();
  });

  const form = document.getElementById("patient-form");
  wireAvatarPresetGrid(form, form?.querySelector('[name="profilePhotoFile"]'));
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

  await renderFacilityDatalist("patient-reg-facility-datalist");
  attachFacilityInputBehavior('input[name="registrationFacility"]');
  try {
    const providers = await loadHmoProviders();
    if (hmoSelect) {
      hmoSelect.innerHTML = `<option value="">Select HMO provider</option>${providers
        .map(
          (provider) =>
            `<option value="${escapeHtml(provider)}">${escapeHtml(provider)}</option>`,
        )
        .join("")}`;
    }
  } catch (error) {
    if (hmoSelect) {
      hmoSelect.innerHTML = '<option value="">Unable to load providers</option>';
    }
  }

  if (canAttachExisting) {
    const searchInput = document.getElementById("patient-existing-search");
    const searchClear = document.getElementById("patient-existing-search-clear");
    const resultEl = document.getElementById("patient-existing-results");
    let pickedExistingPatientId = "";
    const performSearch = async () => {
      const q = String(searchInput?.value || "").trim();
      if (searchClear) {
        searchClear.style.display = q.length > 0 ? "block" : "none";
      }
      if (resultEl) resultEl.style.display = "none";
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
              if (error.message && error.message.includes("Starter plan limit")) {
                setTimeout(() => {
                  window.location.hash = "#pricing";
                }, 1200);
              }
            }
          });
        });
      } catch (error) {
        resultEl.style.display = "block";
        resultEl.className = "feedback error";
        resultEl.textContent = "Unable to search duplicates right now.";
      }
    };
    searchInput?.addEventListener("input", performSearch);
    searchClear?.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        performSearch();
        searchInput.focus();
      }
    });
  }
  if (editId) {
    apiRequest(`${API_BASE}/patients/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        form.title.value = data.title || "";
        form.firstName.value = data.firstName || "";
        form.lastName.value = data.lastName || "";
        form.email.value = data.email || "";
        form.phone.value = data.phone || "";
        form.birthdate.value = formatDateForInput(data.birthdate);
        form.gender.value = data.gender || "";
        form.address.value = data.address || "";
        form.notes.value = data.notes || "";
        if (form.medicalHistory) {
          form.medicalHistory.value = Array.isArray(data.medicalHistory)
            ? data.medicalHistory.join("\n")
            : "";
        }
        if (form.relationshipToAccountHolder) {
          form.relationshipToAccountHolder.value = data.relationshipToAccountHolder || "";
        }
        const regFacilityInput = form.querySelector(
          '[name="registrationFacility"]',
        );
        if (regFacilityInput) {
          regFacilityInput.value = data.registrationFacility || "";
        }
        if (insuredCb) insuredCb.checked = Boolean(data.isInsured);
        if (hmoSelect && data.hmoProvider)
          hmoSelect.value = String(data.hmoProvider || "");
        syncInsured();

        const isPrimary = typeof data.isPrimaryProfile !== "undefined"
          ? data.isPrimaryProfile
          : (!data.relationshipToAccountHolder && (!data.accountOwnerId || String(data.userId || "") === String(data.accountOwnerId || "")));

        const badgeTextEl = document.getElementById("patient-profile-type-text");
        const relWrap = document.getElementById("patient-relationship-wrap");
        if (badgeTextEl) {
          badgeTextEl.textContent = isPrimary
            ? "Account Owner (Primary Profile)"
            : `Family Member ${data.relationshipToAccountHolder ? `(${data.relationshipToAccountHolder})` : ""}`;
        }
        if (relWrap) {
          relWrap.style.display = isPrimary ? "none" : "block";
        }

        const docsContainer = document.getElementById("patient-existing-documents-container");
        const docsList = document.getElementById("patient-existing-documents-list");
        const docs = Array.isArray(data.documents) ? data.documents : [];
        if (docsContainer && docsList && docs.length > 0) {
          docsContainer.style.display = "block";
          docsList.innerHTML = docs
            .map((d) => {
              const docId = String(d._id || d.id || "");
              const name = escapeHtml(d.name || d.fileUrl || d.url || "Document");
              const fileUrl = escapeHtml(d.fileUrl || d.url || "#");
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; font-size: 0.875rem;">
                  <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" download style="color: #2563eb; text-decoration: underline; font-weight: 500;">📄 ${name}</a>
                  <button type="button" class="btn btn-sm btn-action-delete" style="padding: 2px 8px; font-size: 0.75rem;" data-remove-doc-id="${docId}">Remove</button>
                </div>
              `;
            })
            .join("");

          docsList.querySelectorAll("[data-remove-doc-id]").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const docIdToRemove = btn.getAttribute("data-remove-doc-id");
              if (!docIdToRemove) return;
              try {
                const rmRes = await apiRequest(`${API_BASE}/patients/${editId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ removeDocumentId: docIdToRemove }),
                });
                if (!rmRes.ok) throw new Error("Failed to remove document");
                btn.parentElement?.remove();
                if (!docsList.children.length) {
                  docsContainer.style.display = "none";
                }
                showToast("Document record removed.");
              } catch (err) {
                showToast(err.message || "Failed to remove document", "error");
              }
            });
          });
        }
      });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const patient = Object.fromEntries(new FormData(form));
    patient.isInsured = Boolean(
      document.getElementById("patient-is-insured")?.checked,
    );
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
    const presetPatientPhoto = String(
      form.querySelector('[name="presetPhotoUrl"]')?.value || "",
    ).trim();
    if (
      presetPatientPhoto &&
      isAllowedPresetImageUrl(presetPatientPhoto) &&
      !profilePhotoFile
    ) {
      patient.photoUrl = presetPatientPhoto;
    }
    if (familyMode) {
      patient.relationshipToAccountHolder = String(
        patient.relationshipToAccountHolder || "",
      ).trim();
    }
    if (form.medicalHistory) {
      patient.medicalHistory = String(form.medicalHistory.value || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      delete patient.medicalHistory;
    }
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
      const savedPatient = await res.json().catch(() => null);

      // Immediately sync local user state and update sidebar header avatar if editing own patient profile
      const currentUserId = typeof getCurrentUserId === "function" ? getCurrentUserId() : null;
      const currentRole = typeof getCurrentUserRole === "function" ? getCurrentUserRole() : null;

      const isMyPatientProfile =
        (savedPatient?.userId && currentUserId && String(savedPatient.userId) === String(currentUserId)) ||
        (currentRole === "patient" && (editId || !editId));

      if (isMyPatientProfile && savedPatient) {
        const newPhoto = savedPatient.photoUrl || savedPatient.avatarUrl || savedPatient.picture || patient.photoUrl || "";
        if (newPhoto && typeof applyUserRecordToLocalCache === "function") {
          applyUserRecordToLocalCache({
            _id: currentUserId,
            firstName: savedPatient.firstName || "",
            lastName: savedPatient.lastName || "",
            photoUrl: newPhoto,
            picture: newPhoto,
            avatarUrl: newPhoto,
          });
        }
        if (typeof refreshCurrentUserCacheFromApi === "function") {
          await refreshCurrentUserCacheFromApi();
        }
        if (typeof updateSidebarAccountInfoAndPlan === "function") {
          updateSidebarAccountInfoAndPlan();
        }
      }

      modal.style.display = "none";
      showToast(editId ? "Patient details updated successfully." : "Patient added successfully.");
      const sendDocDoctorSelect = document.getElementById(
        "patient-send-doc-doctor",
      );
      if (sendDocDoctorSelect) sendDocDoctorSelect.value = "";
      const mgmtContainer = document.getElementById("clinical-patients-mgmt-container");
      if (mgmtContainer) {
        void renderPatients(mgmtContainer);
      } else {
        void renderPatients();
      }
    } catch (err) {
      showToast(err.message, "error");
      if (err.message && err.message.includes("Starter plan limit")) {
        setTimeout(() => {
          window.location.hash = "#pricing";
        }, 1200);
      }
    }
  };
}

export function editPatient(id) {
  showPatientForm(id);
}

export async function deletePatient(id) {
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

// Ensure global window bindings are available immediately when module loads
if (typeof window !== "undefined") {
  window.showPatientForm = showPatientForm;
  window.editPatient = editPatient;
  window.deletePatient = deletePatient;
  window.closePatientForm = function () {
    const modal = document.getElementById("patient-form-modal") || document.querySelector(".patient-form-modal-host");
    if (modal) {
      modal.style.display = "none";
      modal.innerHTML = "";
    }
  };
}
