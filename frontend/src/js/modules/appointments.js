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
let isPastSlot = null;
let formatTimeLabel = null;
let build30MinTimeOptions = null;
let buildBookingTimeGridHtml = null;
let showDangerConfirm = null;
let showCustomConfirm = null;
let showToast = null;
let escapeHtml = null;
let setPageTone = null;
let API_BASE = null;

function normalizeTimeTextInternal(val) {
  if (!val) return "";
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return str;
  const hh = String(match[1]).padStart(2, "0");
  const mm = String(match[2]).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isSameDayInternal(d1, d2) {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  if (Number.isNaN(date1.getTime()) || Number.isNaN(date2.getTime())) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function parseTimeToMinutesInternal(timeText) {
  const match = String(timeText || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function isPastSlotInternal(dateVal, timeText, bufferMinutes = 0) {
  if (!dateVal || !timeText) return false;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  if (isSameDayInternal(d, now)) {
    const slotMins = parseTimeToMinutesInternal(timeText);
    if (slotMins === null) return false;
    const currentMins = now.getHours() * 60 + now.getMinutes();
    return slotMins < (currentMins + bufferMinutes);
  }

  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dMidnight < nowMidnight;
}

function formatTimeLabelInternal(time24) {
  const m = String(time24 || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return time24;
  let h = Number(m[1]);
  const min = m[2];
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${min} ${period}`;
}

function build30MinTimeOptionsInternal(selectedTime = "", suggestedTimes = [], conflictingTimes = [], isOffDay = false, operatingSlots = []) {
  if (isOffDay) {
    return `<option value="">No available time slots on this date</option>`;
  }

  const normTime = normalizeTimeText || normalizeTimeTextInternal;
  const fmtTime = formatTimeLabel || formatTimeLabelInternal;

  let slots = [];
  if (Array.isArray(operatingSlots) && operatingSlots.length > 0) {
    slots = [...operatingSlots];
  } else if (Array.isArray(suggestedTimes) && suggestedTimes.length > 0) {
    const combined = new Set([
      ...suggestedTimes.map((t) => normTime(t)),
      ...conflictingTimes.map((t) => normTime(t)),
    ]);
    if (selectedTime) combined.add(normTime(selectedTime));
    slots = [...combined].filter(Boolean).sort((a, b) => a.localeCompare(b));
  } else {
    slots = [];
    for (let h = 8; h <= 17; h++) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
      if (h < 17) slots.push(`${String(h).padStart(2, "0")}:30`);
    }
  }

  const conflicts = new Set((conflictingTimes || []).map((t) => normTime(t)));
  const normSelected = normTime(selectedTime);

  if (normSelected && !slots.includes(normSelected) && !isOffDay) {
    slots.push(normSelected);
    slots.sort((a, b) => a.localeCompare(b));
  }

  let optionsHtml = `<option value="">Select time slot (30-min)</option>`;
  for (const t of slots) {
    const norm = normTime(t);
    if (!norm) continue;
    const label = fmtTime(norm);
    const isConflict = conflicts.has(norm);
    const isSel = norm === normSelected ? "selected" : "";
    const disabledAttr = isConflict ? "disabled" : "";
    const conflictTag = isConflict ? " (Already Booked)" : "";

    optionsHtml += `<option value="${norm}" ${isSel} ${disabledAttr}>${label}${conflictTag}</option>`;
  }

  return optionsHtml;
}

function buildBookingTimeGridHtmlInternal({
  suggestedAvailableTimes = [],
  conflictingTimes = [],
  selectedTime = "",
  selectedDate = "",
}) {
  const normTime = normalizeTimeText || normalizeTimeTextInternal;
  const checkPast = isPastSlot || isPastSlotInternal;
  const selected = normTime(selectedTime);
  const taken = new Set(
    (Array.isArray(conflictingTimes) ? conflictingTimes : [])
      .map((t) => normTime(t))
      .filter(Boolean),
  );
  const available = new Set(
    (Array.isArray(suggestedAvailableTimes) ? suggestedAvailableTimes : [])
      .map((t) => normTime(t))
      .filter(Boolean),
  );
  const merged = new Set([...available, ...taken]);
  if (!merged.size) return "";
  const times = [...merged].sort((a, b) => a.localeCompare(b));
  return `<div class="booking-time-grid">
    ${times
      .map((timeVal) => {
        const isPast = checkPast(selectedDate, timeVal, 0);
        const isTaken = taken.has(timeVal) || isPast;
        const isSelected = !isTaken && selected === timeVal;
        const extraLabel = isPast ? " (Past)" : isTaken ? " (Taken)" : "";
        return `<button type="button" class="btn btn-sm booking-time-chip ${isTaken ? "is-taken" : "is-available"} ${isSelected ? "is-selected" : ""}" data-smart-time="${escapeHtml ? escapeHtml(timeVal) : timeVal}" ${isTaken ? "disabled" : ""}>${escapeHtml ? escapeHtml(timeVal) : timeVal}${extraLabel}</button>`;
      })
      .join("")}
  </div>`;
}

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
  normalizeTimeText = config.normalizeTimeText || normalizeTimeTextInternal;
  isPastSlot = config.isPastSlot || isPastSlotInternal;
  formatTimeLabel = config.formatTimeLabel || formatTimeLabelInternal;
  build30MinTimeOptions = config.build30MinTimeOptions || build30MinTimeOptionsInternal;
  buildBookingTimeGridHtml = config.buildBookingTimeGridHtml || buildBookingTimeGridHtmlInternal;
  showDangerConfirm = config.showDangerConfirm || null;
  showCustomConfirm = config.showCustomConfirm || null;
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
      const activeAppointments = appointments.filter(
        (a) => String(a.status || "").toLowerCase() !== "cancelled"
      );

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
        const filtered = activeAppointments.filter((a) => {
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

      renderPatientRows(activeAppointments);

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
  let existingAppointment = null;
  try {
    const requests = [
      apiRequest(`${API_BASE}/doctors`),
      apiRequest(`${API_BASE}/patients`),
    ];
    if (editId) {
      requests.push(apiRequest(`${API_BASE}/appointments/${editId}`));
    }
    const responses = await Promise.all(requests);
    doctors = responses[0].ok ? await responses[0].json() : [];
    patients = responses[1].ok ? await responses[1].json() : [];
    if (editId && responses[2] && responses[2].ok) {
      existingAppointment = await responses[2].json();
    }
  } catch (error) {
    window.closeAppointmentForm = () => {
      modal.style.display = "none";
    };
    modal.innerHTML = `
      <div class="modal-sheet card">
        <button type="button" class="modal-close-x" aria-label="Close" onclick="window.closeAppointmentForm()">&times;</button>
        <div class="feedback error">Failed to load form details.</div>
      </div>`;
    return;
  }

  let originalDate = "";
  let originalTime = "";
  let originalDoctorId = "";
  let originalPatientId = "";
  let originalStatus = "pending";
  let originalNotes = "";

  if (existingAppointment) {
    const docVal = typeof existingAppointment.doctor === "object" ? (existingAppointment.doctor?._id || existingAppointment.doctor?.id) : existingAppointment.doctor;
    const patVal = typeof existingAppointment.patient === "object" ? (existingAppointment.patient?._id || existingAppointment.patient?.id) : existingAppointment.patient;
    originalDoctorId = String(docVal || "").trim();
    originalPatientId = String(patVal || "").trim();
    originalDate = formatDateForInput(existingAppointment.date);
    originalTime = normalizeTimeText(existingAppointment.time || "");
    originalStatus = String(existingAppointment.status || "pending").toLowerCase();
    originalNotes = String(existingAppointment.notes || existingAppointment.reason || "");
  }

  const doctorOptions = doctors
    .map((doctor) => {
      const isSel = editId && String(doctor._id) === originalDoctorId ? "selected" : "";
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
      return `<option value="${doctor._id}" ${isSel}>${fullName} - ${specialty} (${availability})</option>`;
    })
    .join("");

  const patientOptions = patients
    .map((patient) => {
      const isSel = editId && String(patient._id) === originalPatientId ? "selected" : "";
      const fullName = formatPatientDisplayName(patient);
      return `<option value="${patient._id}" ${isSel}>${fullName} (${patient.email || "No email"})</option>`;
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
      <label>Date <input name="date" type="date" value="${originalDate}" required /></label>
      <label>Time
        <select name="time" id="appointment-form-time" required>
          ${originalTime ? `<option value="${originalTime}" selected>${(formatTimeLabel || formatTimeLabelInternal)(originalTime)}</option>` : `<option value="">Select date & doctor first</option>`}
        </select>
      </label>
      <div id="appointment-smart-hint" class="feedback booking-hint" style="display:none"></div>
      <div id="appointment-smart-times" class="booking-time-grid-wrap"></div>
      <label>Status
        <select name="status">
          <option value="pending" ${originalStatus === "pending" ? "selected" : ""}>Pending</option>
          <option value="confirmed" ${originalStatus === "confirmed" ? "selected" : ""}>Confirmed</option>
          <option value="cancelled" ${originalStatus === "cancelled" ? "selected" : ""}>Cancelled</option>
          <option value="completed" ${originalStatus === "completed" ? "selected" : ""}>Completed</option>
        </select>
      </label>
      <label>Notes <textarea name="notes">${escapeHtml(originalNotes)}</textarea></label>
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
  const userRole = String(typeof getCurrentUserRole === "function" ? (getCurrentUserRole() || "") : "").toLowerCase();
  const isPatientRole = userRole === "patient";

  if (isPatientRole) {
    if (form.doctor) {
      form.doctor.disabled = true;
      form.doctor.setAttribute("aria-disabled", "true");
    }
    if (form.patient) {
      form.patient.disabled = true;
      form.patient.setAttribute("aria-disabled", "true");
    }
  } else {
    if (form.doctor) {
      form.doctor.disabled = false;
      form.doctor.removeAttribute("aria-disabled");
    }
    if (form.patient) {
      form.patient.disabled = false;
      form.patient.removeAttribute("aria-disabled");
    }
  }
  const hintEl = document.getElementById("appointment-smart-hint");
  const timesEl = document.getElementById("appointment-smart-times");
  let activeAvailableTimes = new Set();
  let activeConflictingTimes = new Set();

  const renderSmartBookingHint = async () => {
    const doctorId = String(form.doctor?.value || originalDoctorId || "").trim();
    const date = String(form.date?.value || originalDate || "").trim();
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
        if (hintEl) hintEl.style.display = "none";
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

      const operatingList = (Array.isArray(info.operatingSlots) ? info.operatingSlots : [])
        .map((t) => normalizeTimeText(t))
        .filter(Boolean);

      activeAvailableTimes = new Set(operatingList.length > 0 ? operatingList : [...availableList, ...conflictList]);
      activeConflictingTimes = new Set(conflictList);

      const upcomingAvailable = availableList.filter((t) => !isPastSlot(date, t, 0));
      const availableSlotsCount = upcomingAvailable.length;
      const displayRemaining = typeof info.remainingSlots === "number" ? Math.min(info.remainingSlots, availableSlotsCount) : availableSlotsCount;

      const timeSelect = document.getElementById("appointment-form-time");
      if (timeSelect && typeof build30MinTimeOptions === "function") {
        let curVal = "";
        const rawTimeVal = form.time?.value !== undefined ? form.time.value : timeSelect.value;
        if (date !== originalDate) {
          curVal = rawTimeVal || "";
        } else {
          curVal = rawTimeVal !== "" ? rawTimeVal : originalTime;
        }

        timeSelect.innerHTML = build30MinTimeOptions(
          curVal,
          info.suggestedAvailableTimes,
          info.conflictingTimes,
          info.isOffDay || false,
          info.operatingSlots || []
        );
        if (curVal && timeSelect.querySelector(`option[value="${curVal}"]`)) {
          timeSelect.value = curVal;
        } else if (!curVal) {
          timeSelect.value = "";
        }
      }

      if (hintEl) {
        hintEl.style.display = "block";
        hintEl.className =
          displayRemaining > 0 && availableSlotsCount > 0
            ? "feedback booking-hint"
            : "feedback error booking-hint";
        hintEl.textContent = availableSlotsCount > 0
          ? `Booked ${info.bookedCount ?? 0}/${info.maxPatientsPerDay ?? 10}. ${displayRemaining} slot(s) left.`
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
      if (hintEl) hintEl.style.display = "none";
      if (timesEl) timesEl.innerHTML = "";
    }
  };
  form.doctor?.addEventListener("change", renderSmartBookingHint);
  form.date?.addEventListener("change", () => {
    const curDateVal = String(form.date?.value || "").trim();
    if (curDateVal !== originalDate && form.time) {
      form.time.value = "";
    }
    void renderSmartBookingHint();
  });
  form.time?.addEventListener("change", renderSmartBookingHint);

  await renderSmartBookingHint();

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.onclick = (e) => {
      e.preventDefault();
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    };
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const formEntries = Object.fromEntries(new FormData(form));

    const doctorVal = String(form.doctor?.value || formEntries.doctor || originalDoctorId || "").trim();
    const patientVal = String(form.patient?.value || formEntries.patient || originalPatientId || "").trim();
    const dateVal = String(form.date?.value || formEntries.date || "").trim();
    const timeNorm = normalizeTimeText(form.time?.value || formEntries.time || "");
    const statusVal = String(form.status?.value || formEntries.status || "pending").toLowerCase();
    const notesVal = String(form.notes?.value || formEntries.notes || "").trim();

    if (!doctorVal || !dateVal || !timeNorm) {
      showToast("Please select a doctor, date, and valid time slot.", "error");
      return;
    }

    const appointmentPayload = {
      ...formEntries,
      doctor: doctorVal,
      patient: patientVal,
      date: dateVal,
      time: timeNorm,
      status: statusVal,
      notes: notesVal,
      reason: notesVal,
    };

    if (getCurrentUserRole() === "patient" && !patientVal) {
      delete appointmentPayload.patient;
    }

    const isRescheduling = Boolean(
      editId && (dateVal !== originalDate || timeNorm !== originalTime),
    );

    if (!editId || isRescheduling) {
      if (isPastSlot(dateVal, timeNorm)) {
        showToast("Cannot book appointments in the past.", "error");
        return;
      }

      if (activeAvailableTimes.size > 0 && !activeAvailableTimes.has(timeNorm)) {
        showToast("Selected time is outside the doctor's operating schedule.", "error");
        return;
      }

      if (activeConflictingTimes.has(timeNorm)) {
        showToast("Selected time slot is already booked or conflicting.", "error");
        return;
      }
    }

    if (editId) {
      const timeLabel = form.time?.options?.[form.time.selectedIndex]?.text || timeNorm;
      const confirmDetails = `• Date: ${formatDateDisplay(dateVal) || dateVal}\n• Time: ${timeLabel}\n• Status: ${statusVal}`;
      const isConfirmed = typeof showCustomConfirm === "function"
        ? await showCustomConfirm({
            title: "Confirm Appointment Update",
            message: "Are you sure you want to save these changes?",
            details: confirmDetails,
            confirmText: "Update Appointment",
            cancelText: "Cancel",
          })
        : true;
      if (!isConfirmed) return;
    }

    try {
      const res = await apiRequest(
        `${API_BASE}/appointments${editId ? "/" + editId : ""}`,
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appointmentPayload),
        },
      );
      if (!res.ok)
        throw new Error(
          await getApiErrorMessage(res, "Failed to save appointment"),
        );
      modal.style.display = "none";
      modal.innerHTML = "";
      if (typeof showToast === "function") {
        showToast(editId ? "Appointment updated successfully!" : "Appointment created successfully!", "success");
      }
      void renderAppointments();
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

export async function cancelAppointment(id, appointmentData = null) {
  if (!id) return;
  if (!(await showDangerConfirm("Are you sure you want to cancel this appointment?"))) return;
  try {
    let payload = { status: "cancelled" };

    if (appointmentData && typeof appointmentData === "object") {
      payload = {
        doctor: appointmentData.doctor?._id || appointmentData.doctor || "",
        patient: appointmentData.patient?._id || appointmentData.patient || "",
        date: formatDateForInput(appointmentData.date) || appointmentData.date || "",
        time: appointmentData.time || "",
        status: "cancelled",
        notes: appointmentData.notes || appointmentData.reason || "",
      };
    }

    const res = await apiRequest(`${API_BASE}/appointments/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const fallbackRes = await apiRequest(`${API_BASE}/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!fallbackRes.ok) throw new Error(await getApiErrorMessage(fallbackRes, "Failed to cancel appointment"));
    }
    showToast("Appointment successfully cancelled.");
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
