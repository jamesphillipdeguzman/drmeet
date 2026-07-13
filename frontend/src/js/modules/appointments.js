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
export async function renderAppointments() {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) return;

  setPageTone("appointments");
  mainContent.innerHTML =
    '<h2 class="page-title page-title-appointments">Appointments</h2><div class="feedback">Loading...</div>';
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
    mainContent.innerHTML = `
      <h2 class="page-title page-title-appointments">Appointments</h2>
      <div class="appointments-toolbar">
        <button type="button" class="btn btn-secondary" id="appointments-refresh-btn">Refresh</button>
        <button class="cta-primary" onclick="window.showAppointmentForm()">Add Appointment</button>
        ${getCurrentUserRole() === "admin" ? '<button class="cta-primary btn-secondary" id="export-appointments-csv">Export CSV</button>' : ""}
      </div>
      <hr class="section-divider" />
      <div class="list-filters">
        ${getCurrentUserRole() === "receptionist" ? "" : '<input type="search" id="appt-filter-doctor" placeholder="Filter by doctor" />'}
        <input type="search" id="appt-filter-patient" placeholder="Filter by patient" />
        <input type="search" id="appt-filter-date" placeholder="Filter by date (YYYY-MM-DD)" />
        <input type="search" id="appt-filter-time" placeholder="Filter by time" />
        <input type="search" id="appt-filter-status" placeholder="Filter by status" />
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
    const applyAppointmentFilters = () => {
      const doctorQ = String(
        document.getElementById("appt-filter-doctor")?.value || "",
      )
        .toLowerCase()
        .trim();
      const patientQ = String(
        document.getElementById("appt-filter-patient")?.value || "",
      )
        .toLowerCase()
        .trim();
      const dateQ = String(
        document.getElementById("appt-filter-date")?.value || "",
      )
        .toLowerCase()
        .trim();
      const timeQ = String(
        document.getElementById("appt-filter-time")?.value || "",
      )
        .toLowerCase()
        .trim();
      const statusQ = String(
        document.getElementById("appt-filter-status")?.value || "",
      )
        .toLowerCase()
        .trim();
      const filtered = appointments.filter((a) => {
        const doctor = String(
          resolveAppointmentDoctorName(a, doctorLookup) || "",
        ).toLowerCase();
        const patient = String(
          patientLookup.get(String(a.patient?._id || a.patient)) ||
          a.patient ||
          "",
        ).toLowerCase();
        const date = formatDateForInput(a.date).toLowerCase();
        const time = String(a.time || "").toLowerCase();
        const status = String(a.status || "").toLowerCase();
        return (
          (!doctorQ || doctor.includes(doctorQ)) &&
          (!patientQ || patient.includes(patientQ)) &&
          (!dateQ || date.includes(dateQ)) &&
          (!timeQ || time.includes(timeQ)) &&
          (!statusQ || status.includes(statusQ))
        );
      });
      renderRows(filtered);
    };
    [
      "appt-filter-doctor",
      "appt-filter-patient",
      "appt-filter-date",
      "appt-filter-time",
      "appt-filter-status",
    ].forEach((id) => {
      document
        .getElementById(id)
        ?.addEventListener("input", applyAppointmentFilters);
    });
    renderRows(appointments);
    document.getElementById("appointments-refresh-btn")?.addEventListener("click", () => {
      void renderAppointments();
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
    window.deleteAppointment = deleteAppointment;
  } catch (err) {
    mainContent.innerHTML = `<h2>Appointments</h2><div class="feedback error">${err.message}</div>`;
  }
}

export async function showAppointmentForm(editId = null) {
  const modal = document.getElementById("appointment-form-modal");
  if (!modal) return;
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
      const availability = buildDoctorAvailabilityLabel ? buildDoctorAvailabilityLabel(doctor) : "No availability listed";
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
  const renderSmartBookingHint = async () => {
    const doctorId = String(form.doctor?.value || "").trim();
    const date = String(form.date?.value || "").trim();
    if (!doctorId || !date) {
      if (hintEl) hintEl.style.display = "none";
      if (timesEl) timesEl.innerHTML = "";
      return;
    }
    try {
      const url = new URL(`${API_BASE}/appointments/booking-hints`, window.location.origin);
      url.searchParams.set("doctorId", doctorId);
      url.searchParams.set("date", date);
      if (editId) url.searchParams.set("excludeAppointmentId", String(editId));
      const res = await apiRequest(url.toString());
      if (!res.ok) {
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
      if (hintEl) {
        hintEl.style.display = "block";
        hintEl.className =
          Number(info.remainingSlots) > 0
            ? "feedback booking-hint"
            : "feedback error booking-hint";
        hintEl.textContent = String(info.hint || "");
      }
      if (timesEl) {
        timesEl.innerHTML = buildBookingTimeGridHtml({
          suggestedAvailableTimes: info.suggestedAvailableTimes,
          conflictingTimes: info.conflictingTimes,
          selectedTime: form.time?.value || "",
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

export async function renderCalendar() {
  const mainContent = document.getElementById("main-content");
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
      void renderCalendar();
    });
    document.getElementById("calendar-prev-month")?.addEventListener("click", () => {
      const viewDate = new Date(window.__calendarViewYear, window.__calendarViewMonth - 1, 1);
      window.__calendarViewYear = viewDate.getFullYear();
      window.__calendarViewMonth = viewDate.getMonth();
      renderCalendar();
    });
    document.getElementById("calendar-next-month")?.addEventListener("click", () => {
      const viewDate = new Date(window.__calendarViewYear, window.__calendarViewMonth + 1, 1);
      window.__calendarViewYear = viewDate.getFullYear();
      window.__calendarViewMonth = viewDate.getMonth();
      renderCalendar();
    });
    document.getElementById("calendar-month-select")?.addEventListener("change", (event) => {
      window.__calendarViewMonth = Number(event.target.value);
      renderCalendar();
    });
    document.getElementById("calendar-year-select")?.addEventListener("change", (event) => {
      window.__calendarViewYear = Number(event.target.value);
      renderCalendar();
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
