/**
 * frontend/src/js/modules/appointments.js
 * Appointments & Calendar Scheduling Module
 */

import { formatDoctorDisplayName } from "./doctors.js";
import { attachClearButtons, downloadCsv } from "../core/ui.js";

// Global environment handlers injected from app.js
let apiRequest = null;
let getApiErrorMessage = null;
let getCurrentUserRole = null;
let getCurrentUserId = null;
let getCurrentLinkedDoctorId = null;
let formatPatientDisplayName = null;
let formatPatientFullNameOnly = null;
let formatPatientAddress = null;
let formatDateDisplay = null;
let formatDateForInput = null;
let normalizeTimeText = null;
let buildBookingTimeGridHtml = null;
let showDangerConfirm = null;
let showToast = null;
let escapeHtml = null;
let setPageTone = null;
let API_BASE = null;

export function initAppointmentsModule(config = {}) {
  apiRequest = config.apiRequest || null;
  getApiErrorMessage = config.getApiErrorMessage || null;
  getCurrentUserRole = config.getCurrentUserRole || null;
  getCurrentUserId = config.getCurrentUserId || null;
  getCurrentLinkedDoctorId = config.getCurrentLinkedDoctorId || null;
  formatPatientDisplayName = config.formatPatientDisplayName || null;
  formatPatientFullNameOnly = config.formatPatientFullNameOnly || null;
  formatPatientAddress = config.formatPatientAddress || null;
  formatDateDisplay = config.formatDateDisplay || null;
  formatDateForInput = config.formatDateForInput || null;
  normalizeTimeText = config.normalizeTimeText || null;
  buildBookingTimeGridHtml = config.buildBookingTimeGridHtml || null;
  showDangerConfirm = config.showDangerConfirm || null;
  showToast = config.showToast || null;
  escapeHtml = config.escapeHtml || null;
  setPageTone = config.setPageTone || null;
  API_BASE = config.API_BASE || null;
}

/** Mirrors backend `payments.json` so Clinical billing dropdowns work offline or if the API fails. */
export const PAYMENT_METHOD_CATEGORIES_FALLBACK = [
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
export const CLINICAL_HMO_PAYMENT_METHODS = new Set(["HMO Coverage", "HMO Co-pay"]);

export function resolveAppointmentDoctorName(a, doctorLookup) {
  const named = String(a?.doctorDisplayName || "").trim();
  if (named) return named;
  const id = String(a?.doctor?._id || a?.doctor || "").trim();
  if (id && doctorLookup?.has?.(id)) return doctorLookup.get(id);
  if (typeof a?.doctor === "object" && (a.doctor?.firstName || a.doctor?.lastName))
    return formatDoctorDisplayName(a.doctor);
  return id ? "Unknown doctor" : "—";
}

// --- Appointments ---
export async function renderAppointments(targetContainer = null) {
  const container = targetContainer || document.getElementById("main-content");
  if (!container) return;

  const role = String(getCurrentUserRole() || "").toLowerCase();

  if (!targetContainer && role === "doctor") {
    window.location.hash = "#doctor-dashboard?tab=appointments";
    return;
  }
  setPageTone("appointments");
  container.innerHTML = '<div class="feedback">Loading appointments...</div>';
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
        formatPatientDisplayName(patient),
      ]),
    );
    const patientById = new Map(
      patients.map((patient) => [String(patient._id), patient]),
    );

    if (role === "patient") {
      container.innerHTML = `
        <header class="patient-appointments-header" style="margin-bottom: 1.5rem;">
          <h2 class="page-title page-title-appointments" style="margin-bottom: 0.35rem;">My Appointments</h2>
          <p class="clinical-muted" style="margin: 0;">View, manage, or reschedule your upcoming and past doctor appointments.</p>
        </header>
        <div class="appointments-toolbar" style="margin-bottom: 1.25rem; display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; flex-wrap: wrap;">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button type="button" class="btn btn-secondary btn-sm" id="appointments-refresh-btn">🔄 Refresh List</button>
            <a href="#book" class="btn btn-primary btn-sm" style="text-decoration: none;">+ Book New Appointment</a>
          </div>
        </div>
        <div class="relative w-full max-w-xl mb-4" style="position: relative; width: 100%; max-width: 36rem; margin-bottom: 1rem; display: flex; align-items: center;">
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">🔍</span>
          <input 
            type="text" 
            id="appointments-unified-search" 
            placeholder="Search your visits by doctor, date, time, or status..." 
            class="search-input-unified" 
            style="width: 100%; padding: 8px 36px 8px 48px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem;"
          />
          <button 
            type="button" 
            id="appointments-search-clear" 
            class="search-clear-btn hidden" 
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div id="patient-appointments-list" class="patient-appointments-list" style="display: flex; flex-direction: column; gap: 1rem;"></div>
        <div id="appointment-form-modal" style="display:none"></div>
      `;

      const listEl = document.getElementById("patient-appointments-list");
      const renderPatientRows = (list) => {
        if (!list || !list.length) {
          listEl.innerHTML = `
            <div class="card patient-empty-appointments" style="padding: 2.5rem; text-align: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px;">
              <p style="font-size: 1.1rem; font-weight: 600; color: #475569; margin-bottom: 0.5rem;">No appointments found</p>
              <p class="clinical-muted" style="margin-bottom: 1.25rem;">You haven't scheduled any doctor visits yet, or none match your search criteria.</p>
              <a href="#book" class="btn btn-primary" style="text-decoration: none;">Book an Appointment</a>
            </div>
          `;
          return;
        }

        listEl.innerHTML = list
          .map((a) => {
            const docName = resolveAppointmentDoctorName(a, doctorLookup) || "Doctor";
            const dateText = formatDateDisplay(a.date) || "";
            const timeText = a.time || "";
            const statusRaw = String(a.status || "pending").toLowerCase();
            const isCancelled = statusRaw === "cancelled";
            const isCompleted = statusRaw === "completed";
            const canModify = !isCancelled && !isCompleted;

            return `
              <div class="card patient-appt-card ${isCancelled ? "row-cancelled" : ""}" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; border-left: 4px solid ${isCancelled ? "#ef4444" : isCompleted ? "#10b981" : "#3b82f6"};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
                  <div>
                    <h3 style="margin: 0 0 0.25rem; font-size: 1.1rem; color: #1e293b;">${escapeHtml(docName)}</h3>
                    <p class="clinical-muted" style="margin: 0; font-size: 0.9rem;">
                      🗓️ <strong>${escapeHtml(dateText)}</strong> at ⏰ <strong>${escapeHtml(timeText)}</strong>
                    </p>
                  </div>
                  <span class="status-pill status-${escapeHtml(statusRaw)}">${escapeHtml(a.status || "Pending")}</span>
                </div>
                ${a.reason || a.notes ? `<p style="margin: 0; font-size: 0.875rem; color: #475569;"><strong>Reason:</strong> ${escapeHtml(a.reason || a.notes)}</p>` : ""}
                <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
                  ${canModify ? `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.editAppointment('${a._id}')">Reschedule</button>
                    <button type="button" class="btn btn-secondary btn-sm" style="color: #dc2626; border-color: #fca5a5;" onclick="window.cancelAppointment('${a._id}')">Cancel Appointment</button>
                  ` : `
                    <a href="#book" class="btn btn-secondary btn-sm" style="text-decoration: none;">Book Again</a>
                  `}
                </div>
              </div>
            `;
          })
          .join("");
      };

      const searchInput = document.getElementById("appointments-unified-search");
      const searchClear = document.getElementById("appointments-search-clear");
      const applyFilters = () => {
        const q = String(searchInput?.value || "").toLowerCase().trim();
        if (searchClear) {
          if (q.length > 0) {
            searchClear.classList.remove("hidden");
            searchClear.style.display = "block";
          } else {
            searchClear.classList.add("hidden");
            searchClear.style.display = "none";
          }
        }
        const filtered = appointments.filter((a) => {
          const doc = String(resolveAppointmentDoctorName(a, doctorLookup) || "").toLowerCase();
          const dInput = formatDateForInput(a.date).toLowerCase();
          const dDisplay = String(formatDateDisplay(a.date) || "").toLowerCase();
          const time = String(a.time || "").toLowerCase();
          const status = String(a.status || "").toLowerCase();
          const reason = String(a.reason || a.notes || "").toLowerCase();
          return !q || doc.includes(q) || dInput.includes(q) || dDisplay.includes(q) || time.includes(q) || status.includes(q) || reason.includes(q);
        });
        renderPatientRows(filtered);
      };

      searchInput?.addEventListener("input", applyFilters);
      searchClear?.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
          applyFilters();
          searchInput.focus();
        }
      });

      renderPatientRows(appointments);

      document.getElementById("appointments-refresh-btn")?.addEventListener("click", () => {
        void renderAppointments(targetContainer);
      });
      window.showAppointmentForm = showAppointmentForm;
      window.editAppointment = editAppointment;
      window.cancelAppointment = cancelAppointment;
      window.deleteAppointment = deleteAppointment;
      return;
    }

    container.innerHTML = `
      <div class="appointments-toolbar" style="margin-bottom: 1rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
        <button type="button" class="btn btn-secondary" id="appointments-refresh-btn">Refresh List</button>
        <button class="cta-primary" onclick="window.showAppointmentForm()">Add Appointment</button>
        ${getCurrentUserRole() === "admin" ? '<button class="cta-primary btn-secondary" id="export-appointments-csv">Export CSV</button>' : ""}
      </div>
      <div class="relative w-full max-w-xl mb-4" style="position: relative; width: 100%; max-width: 36rem; margin-bottom: 1rem; display: flex; align-items: center;">
        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; align-items: center;">🔍</span>
        <input 
          type="text" 
          id="appointments-unified-search" 
          placeholder="Search appointments by doctor, patient, date, time, or status..." 
          class="search-input-unified" 
          style="width: 100%; padding: 8px 36px 8px 48px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem;"
        />
        <button 
          type="button" 
          id="appointments-search-clear" 
          class="search-clear-btn hidden" 
          aria-label="Clear search"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
            <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
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
              <td>${escapeHtml(resolveAppointmentDoctorName(a, doctorLookup))}</td>
              <td>${(typeof a.patientId === "object" ? (formatPatientDisplayName(a.patientId) || a.patientId?.name || "") : "") || patientLookup.get(String(a.patient?._id || a.patient)) || "Unknown Patient"}</td>
              <td>${formatDateDisplay(a.date) || ""}</td>
              <td>${a.time || ""}</td>
              <td><span class="status-pill status-${String(a.status || "pending").toLowerCase()}">${a.status || ""}</span></td>
              <td>
                <button class="btn btn-secondary btn-action-edit" onclick="window.editAppointment('${a._id
            }')">Edit</button>
                <button class="btn btn-action-delete" onclick="window.deleteAppointment('${a._id
            }')">Delete</button>
              </td>
            </tr>
          `,
        )
        .join("");
    };
    const apptSearchInput = document.getElementById("appointments-unified-search");
    const apptSearchClear = document.getElementById("appointments-search-clear");
    const applyAppointmentFilters = () => {
      const q = String(apptSearchInput?.value || "").toLowerCase().trim();
      if (apptSearchClear) {
        if (q.length > 0) {
          apptSearchClear.classList.remove("hidden");
          apptSearchClear.style.display = "block";
        } else {
          apptSearchClear.classList.add("hidden");
          apptSearchClear.style.display = "none";
        }
      }
      const filtered = appointments.filter((a) => {
        const doctor = String(
          resolveAppointmentDoctorName(a, doctorLookup) || "",
        ).toLowerCase();
        const patient = String(
          (typeof a.patientId === "object" ? (formatPatientDisplayName(a.patientId) || a.patientId?.name || "") : "") ||
          patientLookup.get(String(a.patient?._id || a.patient)) ||
          a.patient ||
          "",
        ).toLowerCase();
        const dateInput = formatDateForInput(a.date).toLowerCase();
        const dateDisplay = String(formatDateDisplay(a.date) || "").toLowerCase();
        const time = String(a.time || "").toLowerCase();
        const status = String(a.status || "").toLowerCase();
        return (
          !q ||
          doctor.includes(q) ||
          patient.includes(q) ||
          dateInput.includes(q) ||
          dateDisplay.includes(q) ||
          time.includes(q) ||
          status.includes(q)
        );
      });
      renderRows(filtered);
    };
    apptSearchInput?.addEventListener("input", applyAppointmentFilters);
    apptSearchClear?.addEventListener("click", () => {
      if (apptSearchInput) {
        apptSearchInput.value = "";
        applyAppointmentFilters();
        apptSearchInput.focus();
      }
    });
    renderRows(appointments);
    document
      .getElementById("appointments-refresh-btn")
      ?.addEventListener("click", () => {
        void renderAppointments(targetContainer);
      });
    document
      .getElementById("export-appointments-csv")
      ?.addEventListener("click", () => {
        downloadCsv(
          `appointments-${Date.now()}.csv`,
          appointments.map((a) => ({
            doctor: resolveAppointmentDoctorName(a, doctorLookup),
            patient:
              (typeof a.patientId === "object"
                ? formatPatientDisplayName(a.patientId) || a.patientId?.name
                : "") ||
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
    window.cancelAppointment = cancelAppointment;
    window.deleteAppointment = deleteAppointment;
  } catch (err) {
    container.innerHTML = `<h2>Appointments</h2><div class="feedback error">${escapeHtml(err.message)}</div>`;
  }
}

export async function showAppointmentForm(editId = null) {
  let modal = document.getElementById("appointment-form-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "appointment-form-modal";
    modal.style.display = "none";
    document.body.appendChild(modal);
  }
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
      const availability = typeof buildDoctorAvailabilityLabel === "function"
        ? buildDoctorAvailabilityLabel(doctor)
        : (
            (doctor.availabilityRules && String(doctor.availabilityRules).trim()) ||
            (doctor.availabilityText && String(doctor.availabilityText).trim()) ||
            (typeof doctor.availability === "string" && doctor.availability.trim()) ||
            (Array.isArray(doctor.availability) && doctor.availability.length
              ? doctor.availability
                  .map((s) =>
                    typeof s === "string"
                      ? s
                      : s.timeRange
                        ? `${s.day || ""} ${s.timeRange}`
                        : `${s.day || ""} ${s.startTime || ""}-${s.endTime || ""}`,
                  )
                  .join(" | ")
              : null) ||
            "No availability listed"
          );
      return `<option value="${doctor._id}">${fullName} - ${specialty} (${availability})</option>`;
    })
    .join("");

  const patientOptions = patients
    .map((patient) => {
      const fullName = formatPatientDisplayName(patient);
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
      <div id="appointment-smart-hint" class="feedback" style="display:none"></div>
      <div id="appointment-smart-times" class="calendar-detail-modal-actions"></div>
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
  if (getCurrentUserRole() === "patient" && form.patient) {
    form.patient.disabled = true;
    form.patient.setAttribute("aria-disabled", "true");
  }
  const hintEl = document.getElementById("appointment-smart-hint");
  const timesEl = document.getElementById("appointment-smart-times");
  let activeAvailableTimes = new Set();
  let activeConflictingTimes = new Set();

  const renderSmartBookingHint = async () => {
    const doctorId = String(form.doctor?.value || "").trim();
    const date = String(form.date?.value || "").trim();
    if (!doctorId || !date) {
      activeAvailableTimes.clear();
      activeConflictingTimes.clear();
      if (hintEl) hintEl.style.display = "none";
      if (timesEl) timesEl.innerHTML = "";
      if (form.time) {
        form.time.removeAttribute("min");
        form.time.removeAttribute("max");
      }
      return;
    }
    try {
      const url = new URL(`${API_BASE}/appointments/booking-hints`, window.location.origin);
      url.searchParams.set("doctorId", doctorId);
      url.searchParams.set("date", date);
      if (editId) url.searchParams.set("excludeAppointmentId", String(editId));
      const res = await apiRequest(url.toString());
      if (!res.ok) {
        activeAvailableTimes.clear();
        activeConflictingTimes.clear();
        if (hintEl) {
          hintEl.style.display = "block";
          hintEl.className = "feedback error";
          hintEl.textContent = await getApiErrorMessage(
            res,
            "Unable to load booking hints.",
          );
        }
        if (timesEl) timesEl.innerHTML = "";
        return;
      }
      const info = await res.json();
      const availableList = (Array.isArray(info.suggestedAvailableTimes) ? info.suggestedAvailableTimes : [])
        .map((t) => normalizeTimeText(t))
        .filter(Boolean);
      const conflictList = (Array.isArray(info.conflictingTimes) ? info.conflictingTimes : [])
        .map((t) => normalizeTimeText(t))
        .filter(Boolean);

      activeAvailableTimes = new Set(availableList);
      activeConflictingTimes = new Set(conflictList);

      const upcomingAvailable = availableList.filter((t) => !isPastSlot(date, t, 0));

      if (form.time && upcomingAvailable.length) {
        const sorted = [...upcomingAvailable].sort((a, b) => a.localeCompare(b));
        form.time.min = sorted[0];
        form.time.max = sorted[sorted.length - 1];
        if (!form.time.value || isPastSlot(date, form.time.value, 0) || !upcomingAvailable.includes(form.time.value)) {
          form.time.value = sorted[0];
        }
      }

      if (hintEl) {
        hintEl.style.display = "block";
        hintEl.className =
          Number(info.remainingSlots) > 0 && upcomingAvailable.length
            ? "feedback booking-hint"
            : "feedback error booking-hint";
        hintEl.textContent = upcomingAvailable.length
          ? String(info.hint || "")
          : "No upcoming available schedule slots for the selected date. Please pick another date.";
      }
      if (timesEl) {
        timesEl.innerHTML = buildBookingTimeGridHtml({
          suggestedAvailableTimes: info.suggestedAvailableTimes,
          conflictingTimes: info.conflictingTimes,
          selectedTime: form.time?.value || "",
          selectedDate: date,
        });
      }
      timesEl?.querySelectorAll("[data-smart-time]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const next = normalizeTimeText(btn.getAttribute("data-smart-time"));
          if (!next || !form.time) return;
          form.time.value = next;
          void renderSmartBookingHint();
        });
      });
    } catch (error) {
      activeAvailableTimes.clear();
      activeConflictingTimes.clear();
      if (hintEl) {
        hintEl.style.display = "block";
        hintEl.className = "feedback error";
        hintEl.textContent = "Unable to load booking hints.";
      }
      if (timesEl) timesEl.innerHTML = "";
    }
  };
  form.doctor?.addEventListener("change", renderSmartBookingHint);
  form.date?.addEventListener("change", renderSmartBookingHint);
  form.time?.addEventListener("change", renderSmartBookingHint);
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
      await renderSmartBookingHint();
    } catch (error) {
      console.error(error);
    }
  }
  if (!editId) {
    await renderSmartBookingHint();
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const appointment = Object.fromEntries(new FormData(form));
    const timeNorm = normalizeTimeText(appointment.time);

    if (isPastSlot(appointment.date, timeNorm)) {
      showToast("Cannot book appointments in the past.", "error");
      return;
    }

    if (activeAvailableTimes.size > 0 && !activeAvailableTimes.has(timeNorm)) {
      showToast("Selected time is outside the doctor's available schedule.", "error");
      return;
    }

    if (activeConflictingTimes.has(timeNorm)) {
      showToast("Selected time slot is already booked or conflicting.", "error");
      return;
    }

    try {
      const res = await apiRequest(
        `${API_BASE}/appointments${editId ? "/" + editId : ""}`,
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appointment),
        },
      );
      if (!res.ok)
        throw new Error(
          await getApiErrorMessage(res, "Failed to save appointment"),
        );
      modal.style.display = "none";
      renderAppointments();
    } catch (err) {
      showToast(err.message, "error");
    }
  };
}

export function editAppointment(id) {
  showAppointmentForm(id);
}

export async function deleteAppointment(id) {
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

export async function cancelAppointment(id) {
  if (!id) return;
  if (!(await showDangerConfirm("Are you sure you want to cancel this appointment?"))) return;
  try {
    const res = await apiRequest(`${API_BASE}/appointments/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) {
      const fallbackRes = await apiRequest(`${API_BASE}/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!fallbackRes.ok) throw new Error(await getApiErrorMessage(fallbackRes, "Failed to cancel appointment"));
    }
    showToast("Appointment cancelled successfully.");
    void renderAppointments();
  } catch (err) {
    showToast(err?.message || "Unable to cancel appointment", "error");
  }
}

// Local variable for buildDoctorAvailabilityLabel
let buildDoctorAvailabilityLabel = null;

// Extend init hook to bind buildDoctorAvailabilityLabel
const originalInit = initAppointmentsModule;
export function initAppointmentsModuleWithAvailability(config = {}) {
  originalInit(config);
  buildDoctorAvailabilityLabel = config.buildDoctorAvailabilityLabel || null;
}
// We assign to the exported name
initAppointmentsModule = initAppointmentsModuleWithAvailability;

export async function renderCalendar(container) {
  const mainContent = container || document.getElementById("main-content");
  if (!mainContent) return;

  setPageTone("appointments");
  const calRole = getCurrentUserRole();
  if (!["doctor", "receptionist", "admin"].includes(String(calRole || ""))) {
    mainContent.innerHTML = `<h2 class="page-title page-title-appointments">Calendar</h2><div class="feedback error">The calendar is available to doctor, receptionist, and admin accounts.</div>`;
    return;
  }
  mainContent.innerHTML =
    '<h2 class="page-title page-title-appointments">Calendar</h2><div class="feedback">Loading...</div>';
  try {
    const [appointmentRes, doctorRes, patientRes] = await Promise.all([
      apiRequest(`${API_BASE}/appointments`),
      apiRequest(`${API_BASE}/doctors`),
      apiRequest(`${API_BASE}/patients`),
    ]);
    if (!appointmentRes.ok) throw new Error("Failed to fetch calendar data");
    const appointments = await appointmentRes.json();
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
        formatPatientDisplayName(patient),
      ]),
    );
    const patientById = new Map(
      patients.map((patient) => [String(patient._id), patient]),
    );

    const now = new Date();
    const [minYear, maxYear] = appointments.reduce(
      (acc, appointment) => {
        const d = new Date(appointment.date);
        if (Number.isNaN(d.getTime())) return acc;
        const y = d.getFullYear();
        return [Math.min(acc[0], y), Math.max(acc[1], y)];
      },
      [now.getFullYear(), now.getFullYear()],
    );
    if (typeof window.__calendarViewYear !== "number") {
      window.__calendarViewYear = now.getFullYear();
    }
    if (typeof window.__calendarViewMonth !== "number") {
      window.__calendarViewMonth = now.getMonth();
    }
    const monthStart = new Date(window.__calendarViewYear, window.__calendarViewMonth, 1);
    const monthEnd = new Date(
      window.__calendarViewYear,
      window.__calendarViewMonth + 1,
      0,
    );
    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
    const monthAppointments = appointments.filter((appointment) =>
      formatDateForInput(appointment.date).startsWith(monthKey),
    );
    const dayLookup = monthAppointments.reduce((acc, appointment) => {
      const dayKey = formatDateForInput(appointment.date);
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(appointment);
      return acc;
    }, {});

    const statusCounts = monthAppointments.reduce(
      (acc, appointment) => {
        const status = String(appointment.status || "pending").toLowerCase();
        if (acc[status] === undefined) acc[status] = 0;
        acc[status] += 1;
        return acc;
      },
      { confirmed: 0, cancelled: 0, completed: 0, pending: 0 },
    );

    const totalDays = monthEnd.getDate();
    const firstWeekday = monthStart.getDay();
    const calendarCells = [];
    for (let index = 0; index < firstWeekday; index += 1) {
      calendarCells.push('<div class="calendar-day calendar-day-empty"></div>');
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
      const dayAppointments = dayLookup[dateKey] || [];
      calendarCells.push(`
        <article class="calendar-day" data-calendar-day-date="${dateKey}" style="cursor: pointer;">
          <header class="calendar-day-header">${day}</header>
          <div class="calendar-day-items">
            ${dayAppointments.length
          ? dayAppointments
            .map((appointment) => {
              const patientName =
                (typeof appointment.patientId === "object"
                  ? formatPatientFullNameOnly(appointment.patientId) ||
                  appointment.patientId?.name
                  : "") ||
                formatPatientFullNameOnly(
                  patientById.get(
                    String(appointment.patient?._id || appointment.patient),
                  ) || {},
                ) ||
                patientLookup.get(
                  String(appointment.patient?._id || appointment.patient),
                ) ||
                "Unknown Patient";
              const doctorName =
                resolveAppointmentDoctorName(appointment, doctorLookup);
              return `<button type="button" data-calendar-appt-id="${escapeHtml(String(appointment._id))}" class="calendar-appt-item status-${escapeHtml(String(appointment.status || "pending").toLowerCase())}" title="${escapeHtml(doctorName)}">
                      <strong>${escapeHtml(String(appointment.time || "Time n/a"))}</strong>
                      <span class="calendar-appt-patient">${escapeHtml(patientName)}</span>
                    </button>`;
            })
            .join("")
          : '<p class="calendar-day-empty-text calendar-day-free">Free</p>'}
          </div>
        </article>`);
    }

    mainContent.innerHTML = `
      <section class="calendar-section">
        <div class="calendar-main">
          <div class="calendar-toolbar">
            <h2 class="page-title page-title-appointments">Calendar - ${monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}</h2>
            <div class="calendar-toolbar-controls">
              <button type="button" class="btn btn-secondary btn-sm" id="calendar-refresh" title="Reload calendar">Refresh</button>
              <button type="button" class="btn btn-secondary btn-sm" id="calendar-prev-month">Prev</button>
              <select id="calendar-month-select">${Array.from({ length: 12 }).map((_, idx) => `<option value="${idx}" ${idx === window.__calendarViewMonth ? "selected" : ""}>${new Date(2026, idx, 1).toLocaleString(undefined, { month: "long" })}</option>`).join("")}</select>
              <select id="calendar-year-select">${Array.from({ length: maxYear - minYear + 5 }).map((_, idx) => {
      const year = minYear - 2 + idx;
      return `<option value="${year}" ${year === window.__calendarViewYear ? "selected" : ""}>${year}</option>`;
    }).join("")}</select>
              <button type="button" class="btn btn-secondary btn-sm" id="calendar-next-month">Next</button>
            </div>
          </div>
          <div class="calendar-weekdays">
            ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        .map((day) => `<span>${day}</span>`)
        .join("")}
          </div>
          <div class="calendar-grid">
            ${calendarCells.join("")}
          </div>
        </div>
        <aside class="calendar-sidebar card">
          <h3>Monthly appointment status</h3>
          <p class="calendar-sidebar-month">${monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}</p>
          <div class="calendar-status-list">
            <p><span class="status-pill status-confirmed">Confirmed</span> <strong>${statusCounts.confirmed}</strong></p>
            <p><span class="status-pill status-cancelled">Cancelled</span> <strong>${statusCounts.cancelled}</strong></p>
            <p><span class="status-pill status-completed">Completed</span> <strong>${statusCounts.completed}</strong></p>
            <p><span class="status-pill status-pending">Pending</span> <strong>${statusCounts.pending}</strong></p>
          </div>
          <div class="calendar-day-details-section" id="calendar-day-details-panel" style="margin-top: 1.5rem; display: none;">
            <hr class="section-divider" style="margin: 1rem 0; border-color: #dbe2f3;" />
            <h3 id="calendar-details-date-title" style="margin-bottom: 0.6rem;">Appointments</h3>
            <div id="calendar-details-list" class="calendar-details-list"></div>
          </div>
        </aside>
      </section>
    `;
    document.getElementById("calendar-refresh")?.addEventListener("click", () => {
      void renderCalendar(container);
    });
    document.getElementById("calendar-prev-month")?.addEventListener("click", () => {
      const viewDate = new Date(window.__calendarViewYear, window.__calendarViewMonth - 1, 1);
      window.__calendarViewYear = viewDate.getFullYear();
      window.__calendarViewMonth = viewDate.getMonth();
      renderCalendar(container);
    });
    document.getElementById("calendar-next-month")?.addEventListener("click", () => {
      const viewDate = new Date(window.__calendarViewYear, window.__calendarViewMonth + 1, 1);
      window.__calendarViewYear = viewDate.getFullYear();
      window.__calendarViewMonth = viewDate.getMonth();
      renderCalendar(container);
    });
    document.getElementById("calendar-month-select")?.addEventListener("change", (event) => {
      window.__calendarViewMonth = Number(event.target.value);
      renderCalendar(container);
    });
    document.getElementById("calendar-year-select")?.addEventListener("change", (event) => {
      window.__calendarViewYear = Number(event.target.value);
      renderCalendar(container);
    });
    const openCalendarAppointmentDetails = (appointmentId) => {
      const appointment = appointments.find(
        (row) => String(row._id) === String(appointmentId),
      );
      if (!appointment) return;
      const patientId = String(
        appointment.patient?._id || appointment.patient || "",
      );
      const patient = patientById.get(patientId) || {};
      const doctorName = resolveAppointmentDoctorName(appointment, doctorLookup);
      const patientName =
        (typeof appointment.patientId === "object"
          ? formatPatientFullNameOnly(appointment.patientId) ||
          appointment.patientId?.name
          : "") ||
        formatPatientFullNameOnly(patient) ||
        patientLookup.get(String(appointment.patient?._id || appointment.patient)) ||
        "Unknown Patient";
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="card modal-card-with-close calendar-detail-modal">
          <button type="button" class="modal-close-x" aria-label="Close">&times;</button>
          <h3>Appointment Details</h3>
          <p><strong>Patient:</strong> ${escapeHtml(patientName)}</p>
          <p><strong>Doctor:</strong> ${escapeHtml(doctorName)}</p>
          <p><strong>Date:</strong> ${escapeHtml(formatDateDisplay(appointment.date) || "—")}</p>
          <p><strong>Time:</strong> ${escapeHtml(String(appointment.time || "—"))}</p>
          <p><strong>Status:</strong> ${escapeHtml(String(appointment.status || "pending"))}</p>
          <p><strong>Reason / notes:</strong> ${escapeHtml(String(appointment.reason || appointment.notes || "—"))}</p>
          <hr class="section-divider" />
          <h4>Patient chart</h4>
          <p><strong>Title:</strong> ${escapeHtml(String(patient.title || "—"))}</p>
          <p><strong>Email:</strong> ${escapeHtml(String(patient.email || "—"))}</p>
          <p><strong>Phone:</strong> ${escapeHtml(String(patient.phone || "—"))}</p>
          <p><strong>Birthdate:</strong> ${escapeHtml(formatDateDisplay(patient.birthdate) || "—")}</p>
          <p><strong>Gender:</strong> ${escapeHtml(String(patient.gender || "—"))}</p>
          <p><strong>Address:</strong> ${escapeHtml(formatPatientAddress(patient.address))}</p>
          <p><strong>HMO:</strong> ${escapeHtml(String(patient.hmoProvider || "—"))}</p>
          <p><strong>Notes:</strong> ${escapeHtml(String(patient.notes || "—"))}</p>
          <div class="calendar-detail-modal-actions">
            <button type="button" class="btn btn-secondary" data-calendar-detail-close>Close</button>
          </div>
        </div>
      `;
      const close = () => overlay.remove();
      overlay.querySelector(".modal-close-x")?.addEventListener("click", close);
      overlay.querySelector("[data-calendar-detail-close]")?.addEventListener("click", close);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });
      document.body.appendChild(overlay);
    };
    document.querySelector(".calendar-grid")?.addEventListener("click", (event) => {
      const apptBtn = event.target.closest("[data-calendar-appt-id]");
      if (apptBtn) {
        openCalendarAppointmentDetails(apptBtn.getAttribute("data-calendar-appt-id"));
        event.stopPropagation();
      }

      const dayCard = event.target.closest(".calendar-day:not(.calendar-day-empty)");
      if (!dayCard) return;

      document.querySelectorAll(".calendar-grid .calendar-day").forEach((card) => {
        card.classList.remove("active-day");
      });
      dayCard.classList.add("active-day");

      const selectedDate = dayCard.getAttribute("data-calendar-day-date");
      const dayNum = dayCard.querySelector(".calendar-day-header")?.textContent || "";
      const dayAppts = dayLookup[selectedDate] || [];

      const detailsPanel = document.getElementById("calendar-day-details-panel");
      const detailsTitle = document.getElementById("calendar-details-date-title");
      const detailsList = document.getElementById("calendar-details-list");

      if (detailsPanel && detailsTitle && detailsList) {
        if (dayAppts.length === 0) {
          detailsTitle.textContent = `Day ${dayNum} - Free`;
          detailsList.innerHTML = `<p class="calendar-detail-empty-msg">No appointments scheduled for this day.</p>`;
        } else {
          detailsTitle.textContent = `Day ${dayNum} - Appointments (${dayAppts.length})`;
          detailsList.innerHTML = dayAppts.map((appt) => {
            const patientName =
              (typeof appt.patientId === "object"
                ? formatPatientFullNameOnly(appt.patientId) ||
                appt.patientId?.name
                : "") ||
              formatPatientFullNameOnly(
                patientById.get(
                  String(appt.patient?._id || appt.patient),
                ) || {},
              ) ||
              patientLookup.get(
                String(appt.patient?._id || appt.patient),
              ) ||
              "Unknown Patient";
            const doctorName = resolveAppointmentDoctorName(appt, doctorLookup);
            const statusClass = String(appt.status || "pending").toLowerCase();
            const statusLabel = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
            
            return `
              <div class="calendar-detail-item card" style="margin-bottom: 0.55rem; padding: 0.65rem;">
                <div class="calendar-detail-item-meta" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <span class="calendar-detail-time" style="font-weight: 700;">${escapeHtml(appt.time || "Time n/a")}</span>
                  <span class="status-pill status-${statusClass}">${escapeHtml(statusLabel)}</span>
                </div>
                <div class="calendar-detail-item-names" style="margin-bottom: 0.35rem;">
                  <p style="margin: 0.15rem 0; font-size: 0.84rem;"><strong>Patient:</strong> ${escapeHtml(patientName)}</p>
                  <p style="margin: 0.15rem 0; font-size: 0.84rem;"><strong>Doctor:</strong> ${escapeHtml(doctorName)}</p>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" data-open-appt-id="${escapeHtml(String(appt._id))}">View Full Details</button>
              </div>
            `;
          }).join("");
        }
        detailsPanel.style.display = "block";
      }
    });

    document.getElementById("calendar-day-details-panel")?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-open-appt-id]");
      if (!btn) return;
      openCalendarAppointmentDetails(btn.getAttribute("data-open-appt-id"));
    });
  } catch (error) {
    mainContent.innerHTML = `<h2>Calendar</h2><div class="feedback error">${error.message}</div>`;
  }
}

// Ensure global window bindings are available immediately when module loads
if (typeof window !== "undefined") {
  window.showAppointmentForm = showAppointmentForm;
  window.editAppointment = editAppointment;
  window.deleteAppointment = deleteAppointment;
  window.closeAppointmentForm = function () {
    const modal = document.getElementById("appointment-form-modal");
    if (modal) {
      modal.style.display = "none";
      modal.innerHTML = "";
    }
  };
}
