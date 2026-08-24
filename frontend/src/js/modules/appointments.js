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
      invalidateCalendarCache();
      void renderAppointments();
      const calContainer = document.getElementById("clinical-calendar-container") || (window.location.hash === "#calendar" ? document.getElementById("main-content") : null);
      if (calContainer && typeof renderCalendar === "function") {
        void renderCalendar(calContainer, { forceRefresh: true });
      }
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
    invalidateCalendarCache();
    renderAppointments();
    const calContainer = document.getElementById("clinical-calendar-container") || (window.location.hash === "#calendar" ? document.getElementById("main-content") : null);
    if (calContainer && typeof renderCalendar === "function") {
      void renderCalendar(calContainer, { forceRefresh: true });
    }
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
    invalidateCalendarCache();
    void renderAppointments();
    const calContainer = document.getElementById("clinical-calendar-container") || (window.location.hash === "#calendar" ? document.getElementById("main-content") : null);
    if (calContainer && typeof renderCalendar === "function") {
      void renderCalendar(calContainer, { forceRefresh: true });
    }
  } catch (err) {
    showToast(err?.message || "Unable to cancel appointment", "error");
  }
}

// Local variable for buildDoctorAvailabilityLabel
let buildDoctorAvailabilityLabel = null;

// Calendar In-Memory Cache for Instant 0ms Range Navigation & Prefetching
let calendarCache = {
  appointments: null,
  doctors: null,
  patients: null,
  lastFetched: 0,
};

export function invalidateCalendarCache() {
  calendarCache.lastFetched = 0;
  calendarCache.appointments = null;
}

async function getCalendarDataset(forceRefresh = false) {
  const now = Date.now();
  const CACHE_TTL_MS = 60 * 1000; // 1 minute fresh cache
  const hasValidCache = Array.isArray(calendarCache.appointments) && Array.isArray(calendarCache.doctors) && Array.isArray(calendarCache.patients);

  if (!forceRefresh && hasValidCache && (now - calendarCache.lastFetched < CACHE_TTL_MS)) {
    return {
      appointments: calendarCache.appointments,
      doctors: calendarCache.doctors,
      patients: calendarCache.patients,
      fromCache: true,
    };
  }

  const [appointmentRes, doctorRes, patientRes] = await Promise.all([
    apiRequest(`${API_BASE}/appointments`),
    apiRequest(`${API_BASE}/doctors`),
    apiRequest(`${API_BASE}/patients`),
  ]);

  if (!appointmentRes.ok) throw new Error("Failed to fetch calendar data");
  const appointments = await appointmentRes.json();
  const doctors = doctorRes.ok ? await doctorRes.json() : [];
  const patients = patientRes.ok ? await patientRes.json() : [];

  calendarCache = {
    appointments,
    doctors,
    patients,
    lastFetched: Date.now(),
  };

  return {
    appointments,
    doctors,
    patients,
    fromCache: false,
  };
}

// Extend init hook to bind buildDoctorAvailabilityLabel
const originalInit = initAppointmentsModule;
export function initAppointmentsModuleWithAvailability(config = {}) {
  originalInit(config);
  buildDoctorAvailabilityLabel = config.buildDoctorAvailabilityLabel || null;
}
// We assign to the exported name
initAppointmentsModule = initAppointmentsModuleWithAvailability;

export async function renderCalendar(container, options = {}) {
  const mainContent = container || document.getElementById("main-content");
  if (!mainContent) return;

  setPageTone("appointments");
  const calRole = getCurrentUserRole();
  if (!["doctor", "receptionist", "admin"].includes(String(calRole || ""))) {
    mainContent.innerHTML = `<h2 class="page-title page-title-appointments">Calendar</h2><div class="feedback error">The calendar is available to doctor, receptionist, and admin accounts.</div>`;
    return;
  }

  const forceRefresh = options?.forceRefresh === true;
  const hasCachedData = Array.isArray(calendarCache.appointments) && Array.isArray(calendarCache.doctors);

  // Only show the loading spinner on initial cold load if no cached data exists in memory
  if (!hasCachedData && !mainContent.querySelector(".calendar-section")) {
    mainContent.innerHTML =
      '<div class="feedback" style="padding: 2rem; text-align: center;">Loading clinical calendar…</div>';
  }

  try {
    let data;
    if (hasCachedData && !forceRefresh) {
      // Instant render: synchronous execution from in-memory cache
      data = {
        appointments: calendarCache.appointments,
        doctors: calendarCache.doctors,
        patients: calendarCache.patients,
      };

      // Stale-While-Revalidate: background sync if cache is older than 30 seconds
      if (Date.now() - calendarCache.lastFetched > 30000) {
        setTimeout(async () => {
          try {
            await getCalendarDataset(true);
          } catch {
            /* ignore background sync error */
          }
        }, 150);
      }
    } else {
      data = await getCalendarDataset(forceRefresh);
    }

    const appointments = data.appointments || [];
    const doctors = data.doctors || [];
    const patients = data.patients || [];
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

    if (typeof window.__calendarViewMode !== "string") {
      window.__calendarViewMode = "week"; // 'week' | 'day' | 'month'
    }
    if (!(window.__calendarCurrentDate instanceof Date) || isNaN(window.__calendarCurrentDate.getTime())) {
      window.__calendarCurrentDate = new Date();
    }
    if (typeof window.__calendarDoctorFilter !== "string") {
      window.__calendarDoctorFilter = "all";
    }

    const viewMode = window.__calendarViewMode;
    const curDate = new Date(window.__calendarCurrentDate);
    const today = new Date();

    const isSameDay = (d1, d2) => {
      if (!d1 || !d2) return false;
      const date1 = new Date(d1);
      const date2 = new Date(d2);
      return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
      );
    };

    // Filter appointments by selected doctor if applicable
    const filteredAppointments = appointments.filter((appt) => {
      if (window.__calendarDoctorFilter === "all") return true;
      const docId = String(appt.doctor?._id || appt.doctor || appt.doctorId || "");
      return docId === window.__calendarDoctorFilter;
    });

    // Helper to calculate week dates (Monday to Sunday)
    const getWeekDays = (centerDate) => {
      const d = new Date(centerDate);
      const day = d.getDay(); // 0 is Sun, 1 is Mon...
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // start on Monday
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);

      const days = [];
      for (let i = 0; i < 7; i++) {
        const nextDay = new Date(monday);
        nextDay.setDate(monday.getDate() + i);
        days.push(nextDay);
      }
      return days;
    };

    // Title generation
    let titleText = "";
    if (viewMode === "day") {
      titleText = curDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
    } else if (viewMode === "week") {
      const wDays = getWeekDays(curDate);
      const first = wDays[0];
      const last = wDays[6];
      if (first.getMonth() === last.getMonth()) {
        titleText = `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.getDate()}, ${first.getFullYear()}`;
      } else {
        titleText = `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
      }
    } else {
      titleText = curDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }

    const doctorFilterOptions = `<option value="all" ${window.__calendarDoctorFilter === "all" ? "selected" : ""}>All Doctors</option>` +
      doctors.map((d) => `<option value="${d._id}" ${window.__calendarDoctorFilter === String(d._id) ? "selected" : ""}>${escapeHtml(`${d.firstName || ""} ${d.lastName || ""}`.trim())}</option>`).join("");

    // Time-grid calculation constants
    const START_HOUR = 7; // 7:00 AM
    const END_HOUR = 19; // 7:00 PM (12 hours)
    const TOTAL_HOURS = END_HOUR - START_HOUR;
    const PIXELS_PER_HOUR = 60;
    const START_MINUTES = START_HOUR * 60;

    let calendarViewHtml = "";

    if (viewMode === "week" || viewMode === "day") {
      const daysToRender = viewMode === "week" ? getWeekDays(curDate) : [curDate];
      const gridCols = daysToRender.length;

      // Header row
      const headerCellsHtml = daysToRender.map((dayDate) => {
        const isDayToday = isSameDay(dayDate, today);
        const dayName = dayDate.toLocaleDateString(undefined, { weekday: "short" });
        const dayNum = dayDate.getDate();
        return `
          <div class="time-grid-header-cell ${isDayToday ? "is-today" : ""}">
            <span class="time-grid-header-dayname">${dayName}</span>
            <span class="time-grid-header-date-badge">${dayNum}</span>
          </div>
        `;
      }).join("");

      // Time Column labels
      const timeLabelsHtml = Array.from({ length: TOTAL_HOURS }).map((_, idx) => {
        const hour = START_HOUR + idx;
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const ampm = hour >= 12 ? "PM" : "AM";
        return `<div class="time-grid-time-slot-label">${displayHour} ${ampm}</div>`;
      }).join("");

      // Day Columns body
      const dayColumnsHtml = daysToRender.map((dayDate) => {
        const isDayToday = isSameDay(dayDate, today);
        const dateInputStr = formatDateForInput(dayDate);

        // Filter appointments for this date
        const dayAppts = filteredAppointments.filter((a) => {
          return formatDateForInput(a.date) === dateInputStr;
        });

        // Hour lines
        const hourLinesHtml = Array.from({ length: TOTAL_HOURS }).map(() => {
          return `<div class="time-grid-hour-line"></div>`;
        }).join("");

        // Current time line if today
        let nowIndicatorHtml = "";
        if (isDayToday) {
          const nowMins = today.getHours() * 60 + today.getMinutes();
          if (nowMins >= START_MINUTES && nowMins <= END_HOUR * 60) {
            const topPx = ((nowMins - START_MINUTES) / 60) * PIXELS_PER_HOUR;
            nowIndicatorHtml = `<div class="time-grid-now-indicator" style="top: ${topPx}px;"></div>`;
          }
        }

        // Lunch break block (12:00 PM - 1:00 PM) on weekdays
        let lunchBreakHtml = "";
        const dayOfWeek = dayDate.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const lunchTop = ((12 * 60 - START_MINUTES) / 60) * PIXELS_PER_HOUR;
          lunchBreakHtml = `<div class="time-grid-break-block" style="top: ${lunchTop}px; height: ${PIXELS_PER_HOUR}px;">🍽️ Lunch Break</div>`;
        }

        // Render appointment blocks
        const apptBlocksHtml = dayAppts.map((appt) => {
          const rawTime = String(appt.time || "09:00").trim();
          const startMins = parseTimeToMinutesInternal(rawTime) ?? 540;
          const duration = 30; // 30-min default appointment duration

          const topPx = Math.max(0, ((startMins - START_MINUTES) / 60) * PIXELS_PER_HOUR);
          const heightPx = Math.max(26, (duration / 60) * PIXELS_PER_HOUR - 2);

          const statusClass = String(appt.status || "pending").toLowerCase();
          const patientName =
            (typeof appt.patientId === "object"
              ? formatPatientFullNameOnly(appt.patientId) || appt.patientId?.name
              : "") ||
            formatPatientFullNameOnly(patientById.get(String(appt.patient?._id || appt.patient)) || {}) ||
            patientLookup.get(String(appt.patient?._id || appt.patient)) ||
            "Patient";

          const formattedTime = (formatTimeLabel || formatTimeLabelInternal)(rawTime);

          return `
            <div 
              class="time-grid-appt-block status-${escapeHtml(statusClass)}" 
              style="top: ${topPx}px; height: ${heightPx}px;" 
              data-calendar-appt-id="${escapeHtml(String(appt._id))}"
              title="${escapeHtml(patientName)} - ${escapeHtml(formattedTime)} (${escapeHtml(appt.status || "Pending")})"
            >
              <div class="time-grid-appt-time">⏰ ${escapeHtml(formattedTime)}</div>
              <div class="time-grid-appt-patient">${escapeHtml(patientName)}</div>
              ${appt.reason || appt.notes ? `<div class="time-grid-appt-reason">${escapeHtml(appt.reason || appt.notes)}</div>` : ""}
            </div>
          `;
        }).join("");

        return `
          <div class="time-grid-day-column ${isDayToday ? "is-today" : ""}" data-calendar-day-date="${dateInputStr}">
            ${hourLinesHtml}
            ${nowIndicatorHtml}
            ${lunchBreakHtml}
            ${apptBlocksHtml}
          </div>
        `;
      }).join("");

      calendarViewHtml = `
        <div class="time-grid-container" style="--grid-cols: ${gridCols};">
          <div class="time-grid-header">
            <div class="time-grid-header-gutter">Time</div>
            ${headerCellsHtml}
          </div>
          <div class="time-grid-body">
            <div class="time-grid-time-column">
              ${timeLabelsHtml}
            </div>
            ${dayColumnsHtml}
          </div>
        </div>
      `;
    } else {
      // Month View
      const year = curDate.getFullYear();
      const month = curDate.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const totalDays = monthEnd.getDate();
      const firstWeekday = monthStart.getDay();

      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      const monthAppointments = filteredAppointments.filter((a) =>
        formatDateForInput(a.date).startsWith(monthKey),
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

      const calendarCells = [];
      for (let index = 0; index < firstWeekday; index += 1) {
        calendarCells.push('<div class="calendar-day calendar-day-empty"></div>');
      }

      for (let day = 1; day <= totalDays; day += 1) {
        const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
        const dayAppointments = dayLookup[dateKey] || [];
        const cellDate = new Date(year, month, day);
        const isDayToday = isSameDay(cellDate, today);

        calendarCells.push(`
          <article class="calendar-day ${isDayToday ? "is-today" : ""}" data-calendar-day-date="${dateKey}" style="cursor: pointer;">
            <header class="calendar-day-header">${day}</header>
            <div class="calendar-day-items">
              ${dayAppointments.length
            ? dayAppointments
              .map((appointment) => {
                const patientName =
                  (typeof appointment.patientId === "object"
                    ? formatPatientFullNameOnly(appointment.patientId) || appointment.patientId?.name
                    : "") ||
                  formatPatientFullNameOnly(patientById.get(String(appointment.patient?._id || appointment.patient)) || {}) ||
                  patientLookup.get(String(appointment.patient?._id || appointment.patient)) ||
                  "Patient";
                const formattedTime = (formatTimeLabel || formatTimeLabelInternal)(appointment.time || "");
                return `<button type="button" data-calendar-appt-id="${escapeHtml(String(appointment._id))}" class="calendar-appt-item status-${escapeHtml(String(appointment.status || "pending").toLowerCase())}">
                        <strong>${escapeHtml(formattedTime || "Time n/a")}</strong>
                        <span class="calendar-appt-patient">${escapeHtml(patientName)}</span>
                      </button>`;
              })
              .join("")
            : '<p class="calendar-day-empty-text">Free</p>'}
            </div>
          </article>`);
      }

      calendarViewHtml = `
        <div style="display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1rem;">
          <div class="calendar-month-grid-wrap">
            <div class="calendar-weekdays">
              ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<span>${day}</span>`).join("")}
            </div>
            <div class="calendar-grid">
              ${calendarCells.join("")}
            </div>
          </div>
          <aside class="calendar-sidebar">
            <h3>Monthly Overview</h3>
            <p class="calendar-sidebar-month">${titleText}</p>
            <div class="calendar-status-list">
              <p><span class="status-pill status-confirmed">Confirmed</span> <strong>${statusCounts.confirmed}</strong></p>
              <p><span class="status-pill status-cancelled">Cancelled</span> <strong>${statusCounts.cancelled}</strong></p>
              <p><span class="status-pill status-completed">Completed</span> <strong>${statusCounts.completed}</strong></p>
              <p><span class="status-pill status-pending">Pending</span> <strong>${statusCounts.pending}</strong></p>
            </div>
          </aside>
        </div>
      `;
    }

    // Main section markup with Top Navigation Toolbar
    mainContent.innerHTML = `
      <section class="calendar-section">
        <div class="calendar-toolbar">
          <div class="calendar-toolbar-nav">
            <button type="button" class="btn btn-secondary btn-sm" id="calendar-today-btn" style="font-weight: 700;">Today</button>
            <div class="calendar-toolbar-nav-group">
              <button type="button" class="btn btn-secondary btn-sm" id="calendar-prev-btn" aria-label="Previous">‹</button>
              <button type="button" class="btn btn-secondary btn-sm" id="calendar-next-btn" aria-label="Next">›</button>
            </div>
            <span class="calendar-title-text" id="calendar-title">${escapeHtml(titleText)}</span>
          </div>

          <div class="calendar-toolbar-controls">
            <div class="calendar-view-segmented">
              <button type="button" class="calendar-view-btn ${viewMode === "day" ? "active" : ""}" data-view-mode="day">Day</button>
              <button type="button" class="calendar-view-btn ${viewMode === "week" ? "active" : ""}" data-view-mode="week">Week</button>
              <button type="button" class="calendar-view-btn ${viewMode === "month" ? "active" : ""}" data-view-mode="month">Month</button>
            </div>

            <select id="calendar-doctor-filter" aria-label="Filter by doctor" style="padding: 5px 10px; font-size: 0.84rem; border-radius: 8px; border: 1px solid #cbd5e1;">
              ${doctorFilterOptions}
            </select>

            <button type="button" class="btn btn-secondary btn-sm" id="calendar-refresh" title="Reload calendar">Refresh</button>
            <button type="button" class="cta-primary btn-sm" id="calendar-add-appt-btn" style="padding: 6px 12px; font-size: 0.84rem;">+ Add Appointment</button>
          </div>
        </div>

        ${calendarViewHtml}
      </section>
      <div id="appointment-form-modal" style="display:none"></div>
    `;

    // Event Listeners for Toolbar - Fast Local Cache Navigation (0ms lag)
    document.getElementById("calendar-today-btn")?.addEventListener("click", () => {
      window.__calendarCurrentDate = new Date();
      void renderCalendar(container, { forceRefresh: false });
    });

    document.getElementById("calendar-prev-btn")?.addEventListener("click", () => {
      const d = new Date(window.__calendarCurrentDate);
      if (viewMode === "day") d.setDate(d.getDate() - 1);
      else if (viewMode === "week") d.setDate(d.getDate() - 7);
      else if (viewMode === "month") d.setMonth(d.getMonth() - 1);
      window.__calendarCurrentDate = d;
      void renderCalendar(container, { forceRefresh: false });
    });

    document.getElementById("calendar-next-btn")?.addEventListener("click", () => {
      const d = new Date(window.__calendarCurrentDate);
      if (viewMode === "day") d.setDate(d.getDate() + 1);
      else if (viewMode === "week") d.setDate(d.getDate() + 7);
      else if (viewMode === "month") d.setMonth(d.getMonth() + 1);
      window.__calendarCurrentDate = d;
      void renderCalendar(container, { forceRefresh: false });
    });

    document.querySelectorAll(".calendar-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextMode = btn.getAttribute("data-view-mode");
        if (nextMode) {
          window.__calendarViewMode = nextMode;
          void renderCalendar(container, { forceRefresh: false });
        }
      });
    });

    document.getElementById("calendar-doctor-filter")?.addEventListener("change", (e) => {
      window.__calendarDoctorFilter = e.target.value;
      void renderCalendar(container, { forceRefresh: false });
    });

    document.getElementById("calendar-refresh")?.addEventListener("click", () => {
      void renderCalendar(container, { forceRefresh: true });
    });

    document.getElementById("calendar-add-appt-btn")?.addEventListener("click", () => {
      if (typeof window.showAppointmentForm === "function") {
        window.showAppointmentForm();
      }
    });

    // Appointment Details Modal (Single Instance Management)
    const openCalendarAppointmentDetails = (appointmentId) => {
      // Remove any lingering overlays first
      document.querySelectorAll(".calendar-detail-modal-overlay").forEach((el) => el.remove());

      const appointment = appointments.find(
        (row) => String(row._id) === String(appointmentId),
      );
      if (!appointment) return;
      const patientId = String(
        appointment.patient?._id || appointment.patient || (typeof appointment.patientId === "object" ? appointment.patientId?._id : "") || "",
      );
      const patient = patientById.get(patientId) || (typeof appointment.patientId === "object" ? appointment.patientId : {}) || {};
      const doctorName = resolveAppointmentDoctorName(appointment, doctorLookup);
      const patientName =
        (typeof appointment.patientId === "object"
          ? formatPatientFullNameOnly(appointment.patientId) || appointment.patientId?.name
          : "") ||
        formatPatientFullNameOnly(patient) ||
        patientLookup.get(patientId) ||
        "Unknown Patient";

      const formattedTime = (formatTimeLabel || formatTimeLabelInternal)(appointment.time || "");
      const formattedDate = (formatDateDisplay || formatDateDisplayInternal)(appointment.date) || appointment.date;
      const statusClass = String(appointment.status || "pending").toLowerCase();
      const statusLabel = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);

      const overlay = document.createElement("div");
      overlay.className = "modal-overlay calendar-detail-modal-overlay";
      overlay.innerHTML = `
        <div class="card modal-card-with-close calendar-detail-modal" style="border-top: 4px solid ${statusClass === "confirmed" ? "#2563eb" : statusClass === "completed" ? "#10b981" : statusClass === "cancelled" ? "#ef4444" : "#f59e0b"};">
          <button type="button" class="modal-close-x" aria-label="Close">&times;</button>
          <div style="margin-bottom: 1rem;">
            <h3 style="margin: 0 0 0.25rem;">Appointment Details</h3>
            <p class="clinical-muted" style="margin: 0; font-size: 0.88rem;">Scheduled with Dr. ${escapeHtml(doctorName)}</p>
          </div>

          <div class="calendar-detail-sched-card" style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 0.75rem; margin-bottom: 1rem; background: #ffffff !important; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #cbd5e1 !important; align-items: center; color: #0f172a !important;">
            <div>
              <p class="calendar-detail-card-label" style="margin: 0; font-size: 0.75rem; color: #475569 !important; font-weight: 700; text-transform: uppercase;">Date</p>
              <div style="margin: 0.2rem 0 0; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-size: 0.95rem; font-weight: 700; color: #0f172a !important;">🗓️ ${escapeHtml(formattedDate)}</span>
                <span class="status-pill status-${escapeHtml(statusClass)}" style="font-size: 0.75rem; padding: 0.15rem 0.5rem;">${escapeHtml(statusLabel)}</span>
              </div>
            </div>
            <div>
              <p class="calendar-detail-card-label" style="margin: 0; font-size: 0.75rem; color: #475569 !important; font-weight: 700; text-transform: uppercase;">Time</p>
              <p style="margin: 0.2rem 0 0; font-size: 0.95rem; font-weight: 700; color: #0f172a !important;">⏰ ${escapeHtml(formattedTime)}</p>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <p style="margin: 0; font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Reason / Clinical Notes</p>
            <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: #334155; line-height: 1.4;">${escapeHtml(String(appointment.reason || appointment.notes || "No additional notes provided."))}</p>
          </div>

          <hr class="section-divider" style="margin: 1rem 0;" />
          <h4 style="margin: 0 0 0.65rem; font-size: 0.95rem; color: #1e293b;">Patient Information</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
            <p style="margin: 0;"><strong>Name:</strong> ${escapeHtml(patientName)}</p>
            <p style="margin: 0;"><strong>Phone:</strong> ${escapeHtml(String(patient.phone || "—"))}</p>
            <p style="margin: 0;"><strong>Email:</strong> ${escapeHtml(String(patient.email || "—"))}</p>
            <p style="margin: 0;"><strong>HMO:</strong> ${escapeHtml(String(patient.hmoProvider || "—"))}</p>
            <p style="margin: 0;"><strong>Birthdate:</strong> ${escapeHtml((formatDateDisplay || formatDateDisplayInternal)(patient.birthdate) || "—")}</p>
            <p style="margin: 0;"><strong>Gender:</strong> ${escapeHtml(String(patient.gender || "—"))}</p>
          </div>

          <div class="calendar-detail-modal-actions" style="margin-top: 1.5rem; display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" id="cal-modal-reschedule-btn">Reschedule</button>
            ${statusClass !== "cancelled" ? '<button type="button" class="btn btn-action-delete btn-sm" id="cal-modal-cancel-btn">Cancel Appointment</button>' : ""}
            <button type="button" class="btn btn-secondary btn-sm" data-calendar-detail-close>Close</button>
          </div>
        </div>
      `;

      const close = () => {
        document.querySelectorAll(".calendar-detail-modal-overlay").forEach((el) => el.remove());
        document.removeEventListener("keydown", onKeyDown);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape") close();
      };
      document.addEventListener("keydown", onKeyDown);

      overlay.querySelector(".modal-close-x")?.addEventListener("click", close);
      overlay.querySelector("[data-calendar-detail-close]")?.addEventListener("click", close);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });

      overlay.querySelector("#cal-modal-reschedule-btn")?.addEventListener("click", () => {
        close();
        if (typeof window.editAppointment === "function") {
          window.editAppointment(String(appointment._id));
        }
      });

      overlay.querySelector("#cal-modal-cancel-btn")?.addEventListener("click", () => {
        close();
        if (typeof window.cancelAppointment === "function") {
          window.cancelAppointment(String(appointment._id));
        }
      });

      document.body.appendChild(overlay);
    };

    // Click handler scoped to newly rendered calendar section
    const calSection = mainContent.querySelector(".calendar-section");
    calSection?.addEventListener("click", (event) => {
      const apptBtn = event.target.closest("[data-calendar-appt-id]");
      if (apptBtn) {
        event.stopPropagation();
        openCalendarAppointmentDetails(apptBtn.getAttribute("data-calendar-appt-id"));
        return;
      }

      // If clicked on an empty day column in time grid, open new appointment form with pre-filled date
      const dayCol = event.target.closest(".time-grid-day-column");
      if (dayCol && !event.target.closest(".time-grid-appt-block") && !event.target.closest(".time-grid-break-block")) {
        const clickedDate = dayCol.getAttribute("data-calendar-day-date");
        if (clickedDate && typeof window.showAppointmentForm === "function") {
          window.showAppointmentForm();
          setTimeout(() => {
            const form = document.getElementById("appointment-form");
            if (form && form.date) {
              form.date.value = clickedDate;
              form.date.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }, 50);
        }
      }
    });

  } catch (error) {
    mainContent.innerHTML = `<h2 class="page-title page-title-appointments">Calendar</h2><div class="feedback error">${escapeHtml(error?.message || "Failed to load calendar")}</div>`;
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
