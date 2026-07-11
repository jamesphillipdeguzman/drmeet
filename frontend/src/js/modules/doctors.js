/**
 * frontend/src/js/modules/doctors.js
 * Doctor Profile & Staff Management Module
 */

import {
  API_BASE,
  DEFAULT_AVATAR_URL,
} from "../config/api.js";

import {
  addInlineTooltips,
  attachClearButtons,
  downloadCsv,
  enforcePhoneInputs,
  escapeHtml,
  fileToDataUrl,
  showDangerConfirm,
  showToast,
} from "../core/ui.js";

// Global environment handlers injected from app.js
let apiRequest = null;
let getApiErrorMessage = null;
let getCurrentUserRole = null;
let getCurrentUserId = null;
let getCurrentReceptionistType = null;
let isAllowedPresetImageUrl = null;
let buildAvatarPresetGridHtml = null;
let wireAvatarPresetGrid = null;
let ensureAvatarPresetsLoaded = null;
let setupTaggedFacilityMultiSelect = null;
let renderFacilityDatalist = null;
let parseAffiliatedClinics = null;
let loadFacilities = null;
let buildDoctorAvailabilityLabel = null;
let formatDateForInput = null;
let renderPatientBooking = null;

export function initDoctorsModule(handlers = {}) {
  apiRequest = handlers.apiRequest || null;
  getApiErrorMessage = handlers.getApiErrorMessage || null;
  getCurrentUserRole = handlers.getCurrentUserRole || null;
  getCurrentUserId = handlers.getCurrentUserId || null;
  getCurrentReceptionistType = handlers.getCurrentReceptionistType || null;
  isAllowedPresetImageUrl = handlers.isAllowedPresetImageUrl || null;
  buildAvatarPresetGridHtml = handlers.buildAvatarPresetGridHtml || null;
  wireAvatarPresetGrid = handlers.wireAvatarPresetGrid || null;
  ensureAvatarPresetsLoaded = handlers.ensureAvatarPresetsLoaded || null;
  setupTaggedFacilityMultiSelect = handlers.setupTaggedFacilityMultiSelect || null;
  renderFacilityDatalist = handlers.renderFacilityDatalist || null;
  parseAffiliatedClinics = handlers.parseAffiliatedClinics || null;
  loadFacilities = handlers.loadFacilities || null;
  buildDoctorAvailabilityLabel = handlers.buildDoctorAvailabilityLabel || null;
  formatDateForInput = handlers.formatDateForInput || null;
  renderPatientBooking = handlers.renderPatientBooking || null;
}

// State variable
export let doctorSpecialtiesPromise = null;

export async function ensureDoctorSpecialtiesLoaded() {
  if (!doctorSpecialtiesPromise) {
    doctorSpecialtiesPromise = fetch("data/doctor-specialties.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((arr) => {
        window.__DRMEET_DOCTOR_SPECIALTIES__ = Array.isArray(arr) ? arr : [];
        return window.__DRMEET_DOCTOR_SPECIALTIES__;
      })
      .catch(() => {
        window.__DRMEET_DOCTOR_SPECIALTIES__ = [];
        return [];
      });
  }
  return doctorSpecialtiesPromise;
}

export function getDoctorSpecialties() {
  return window.__DRMEET_DOCTOR_SPECIALTIES__ || [];
}

// Helpers
export function doctorMatchesPatientSearch(doctor, q) {
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

export function formatDoctorDisplayName(d) {
  if (!d) return "";
  const t = d.title ? `${d.title} ` : "";
  return `${t}${d.firstName || ""} ${d.lastName || ""}`.trim();
}

// Page tone helper
function setPageTone(tone) {
  document.body.className = document.body.className
    .split(" ")
    .filter((c) => !c.startsWith("tone-"))
    .join(" ");
  if (tone) document.body.classList.add(`tone-${tone}`);
}

window.closeDoctorForm = function () {
  const modal = document.getElementById("doctor-form-modal");
  if (modal) {
    modal.style.display = "none";
    modal.innerHTML = "";
  }
};

// --- Doctors ---
export async function renderDoctors() {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) return;

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
      ${isDoctor
        ? `<section class="card" style="margin: 1rem 0;">
              <h3>Clinic Staff</h3>
              <p class="signup-lead">Invite a receptionist and link them to your clinic.</p>
              <form id="invite-receptionist-form">
                <label>
                  Receptionist Email
                  <input type="email" name="email" required placeholder="reception@clinic.com" />
                </label>
 
                <label>
                  Receptionist Name
                  <input 
                    type="text" 
                    name="receptionistName" 
                    required 
                    placeholder="e.g. Marimar Meets" 
                  />
                </label>
 
                <div class="modal-form-actions">
                  <button type="submit" class="btn btn-secondary btn-action-edit">
                    Invite Receptionist
                  </button>
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
      ${hideDoctorFilters
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
                            ${isAdmin || isDoctor
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
        const receptionistName = String(
          new FormData(form).get("receptionistName") || "",
        ).trim();
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
              body: JSON.stringify({ email, receptionistName }),
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

export async function showDoctorForm(editId = null) {
  const modal = document.getElementById("doctor-form-modal");
  await ensureDoctorSpecialtiesLoaded();
  await ensureAvatarPresetsLoaded();
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
        ${[...new Set(getDoctorSpecialties())].map((s) => `<option value="${s}"></option>`).join("")}
      </datalist>
      <label>Bio <textarea name="bio" placeholder="Short profile"></textarea></label>
      <label>Availability Rules (one per line)
        <textarea name="availabilityText" placeholder="Monday - Friday 10:00-15:00&#10;Saturday 09:00-12:00"></textarea>
      </label>
      <label>Room <input name="room" placeholder="e.g. Room 204" /></label>
      <label>Affiliated Hospitals / Clinics
        <input
          id="doctor-affiliated-clinic-input"
          list="facility-list"
          placeholder="Type a clinic then press Enter"
        />
        <input type="hidden" name="affiliatedClinics" />
        <div id="doctor-affiliated-clinic-tags" class="facility-tag-list"></div>
        <small>You can select multiple hospitals or clinics.</small>
      </label>
 
      <datalist id="facility-list"></datalist>
      
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
      <div class="section license-details">
        <h3>License Details</h3>
        <p class="clinical-muted">Required for verification</p>
        <div class="form-group">
          <label for="prcLicenseNumber">PRC License Number</label>
          <input type="text" id="prcLicenseNumber" name="prcLicenseNumber" required />
        </div>
        <div class="form-group">
          <label for="prcExpirationDate">PRC ID Expiration Date</label>
          <input type="date" id="prcExpirationDate" name="prcExpirationDate" required />
        </div>
        <div class="form-group">
          <label for="prcIdFile">Upload PRC ID</label>
          <input type="file" id="prcIdFile" name="prcIdFile" accept=".jpg,.jpeg,.png,.pdf" required />
        </div>
      </div>
      <label>Profile Photo
        <input name="photoFile" type="file" accept="image/*" />
      </label>
      ${buildAvatarPresetGridHtml("doctor")}
      <div id="doctor-photo-preview" class="feedback" style="display:none"></div>
      <div class="modal-form-actions">
        <button type="submit" class="btn btn-secondary btn-action-edit">${editId ? "Update" : "Add"}</button>
        <button type="button" class="btn btn-action-delete" onclick="window.closeDoctorForm()">Cancel</button>
      </div>
    </form>
    </div>
  `;

  const closeBtn = modal.querySelector(".modal-close-x");
  closeBtn?.addEventListener("click", () => {
    window.closeDoctorForm();
  });

  const form = document.getElementById("doctor-form");
  wireAvatarPresetGrid(form, form?.querySelector('[name="photoFile"]'));

  addInlineTooltips(form);
  attachClearButtons(form);
  enforcePhoneInputs(form);

  const facilities = await loadFacilities();
  await renderFacilityDatalist();
  const initDoctorClinics = (initialValues = []) =>
    setupTaggedFacilityMultiSelect({
      inputSelector: "#doctor-affiliated-clinic-input",
      hiddenInputSelector: 'input[name="affiliatedClinics"]',
      tagsContainerSelector: "#doctor-affiliated-clinic-tags",
      options: facilities,
      initialValues,
      root: form,
    });

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
        initDoctorClinics(parseAffiliatedClinics(data.affiliatedClinics));
        form.phone.value = data.phone || "";
        form.receptionistName.value = data.receptionistName || "";
        form.receptionistPhone.value = data.receptionistPhone || "";
        form.receptionistEmail.value = data.receptionistEmail || "";
        form.address.value = data.address || "";
        form.prcLicenseNumber.value =
          data.prcLicenseNumber || data.licenseNumber || "";
        form.prcExpirationDate.value = formatDateForInput(
          data.prcExpirationDate || "",
        );
        const prcIdFileInput = form.querySelector('[name="prcIdFile"]');
        if (prcIdFileInput && data.prcIdFileUrl) {
          prcIdFileInput.required = false;
        }
        if (data.photoUrl) {
          const preview = document.getElementById("doctor-photo-preview");
          preview.style.display = "block";
          preview.className = "feedback doctor-photo-preview";
          preview.innerHTML = `<img src="${escapeHtml(data.photoUrl)}" alt="Current photo" class="doctor-avatar" /><span>Current profile photo</span>`;
        }
      });
  } else {
    initDoctorClinics();
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const doctor = Object.fromEntries(new FormData(form));
    const prcLicenseNumber = String(doctor.prcLicenseNumber || "").trim();
    const prcExpirationDate = String(doctor.prcExpirationDate || "").trim();
    const prcIdFile = form.prcIdFile?.files?.[0];
    if (!prcLicenseNumber || !prcExpirationDate || (!prcIdFile && !editId)) {
      showToast("Complete all License Details fields.", "error");
      return;
    }
    if (prcExpirationDate) {
      const expDate = new Date(`${prcExpirationDate}T23:59:59`);
      if (Number.isNaN(expDate.getTime()) || expDate <= new Date()) {
        showToast("PRC ID expiration date must be in the future.", "error");
        return;
      }
    }
    if (prcIdFile) {
      doctor.prcIdFileData = await fileToDataUrl(prcIdFile);
      doctor.prcIdFileName = prcIdFile.name || "prc-id";
    }
    doctor.licenseNumber = prcLicenseNumber;
    const photoFile = form.photoFile?.files?.[0];
    if (photoFile) {
      doctor.photoFileData = await fileToDataUrl(photoFile);
    }
    const presetDoctorPhoto = String(
      form.querySelector('[name="presetPhotoUrl"]')?.value || "",
    ).trim();
    if (
      presetDoctorPhoto &&
      isAllowedPresetImageUrl(presetDoctorPhoto) &&
      !photoFile
    ) {
      doctor.photoUrl = presetDoctorPhoto;
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
            location: {
              clinicName: parseAffiliatedClinics(doctor.affiliatedClinics)[0] || "",
            },
          };
        }
        return {
          day: row,
          timeRange: "",
          startTime: "",
          endTime: "",
          location: {
            clinicName: parseAffiliatedClinics(doctor.affiliatedClinics)[0] || "",
          },
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

export function editDoctor(id) {
  showDoctorForm(id);
}
export async function deleteDoctor(id) {
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
