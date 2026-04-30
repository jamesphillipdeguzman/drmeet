// appointment.service.js
import Appointment from "../models/appointment.model.js";
import Patient from "../models/patient.model.js";

// Get all appointments
export const findAllAppointments = async () => Appointment.find();

function toTitleCase(value = "") {
  return String(value)
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}

async function withPatientMeta(appointments = []) {
  if (!Array.isArray(appointments) || !appointments.length) return [];
  const patientIds = [
    ...new Set(
      appointments
        .map((appt) => String(appt.patient || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!patientIds.length) return appointments;

  const patientDocs = await Patient.find({ _id: { $in: patientIds } })
    .select("firstName lastName")
    .lean();
  const patientLookup = new Map(
    patientDocs.map((p) => {
      const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim();
      return [
        String(p._id),
        {
          name: fullName || "Unknown Patient",
          title: fullName ? toTitleCase(p.firstName || "") : "",
        },
      ];
    }),
  );

  return appointments.map((appt) => {
    const plain = appt?.toObject ? appt.toObject() : appt;
    const patientId = String(plain.patient || "");
    return {
      ...plain,
      patientId: patientLookup.get(patientId) || {
        name: "Unknown Patient",
        title: "",
      },
    };
  });
}

// Get a single appointment by ID
export const findAppointmentById = async (id) => Appointment.findById(id);

// Create a new appointment
export const createAppointment = async (data) => new Appointment(data).save();

// Update an existing appointment by ID
export const updateAppointmentById = async (id, updates) =>
  Appointment.findByIdAndUpdate(id, updates, { new: true });

// Delete an appointment by ID
export const deleteAppointmentById = async (id) =>
  Appointment.findByIdAndDelete(id);

// Find all appointments by a specific doctor
export const findAppointmentsByDoctor = async (doctorId) => {
  const appointments = await Appointment.find({ doctor: String(doctorId) });
  return withPatientMeta(appointments);
};

// Find all appointments by a specific patient
export const findAppointmentsByPatient = async (patientId) =>
  Appointment.find({ patient: patientId });

export const findAppointmentsByDoctorForRoleScope = async (doctorId) => {
  const appointments = await Appointment.find({ doctor: String(doctorId) });
  return withPatientMeta(appointments);
};

export const findAllAppointmentsWithPatientMeta = async () => {
  const appointments = await Appointment.find();
  return withPatientMeta(appointments);
};

export const appointmentExistsForDoctorPatient = async (doctorId, patientId) =>
  Appointment.exists({
    doctor: String(doctorId),
    patient: String(patientId),
  });
