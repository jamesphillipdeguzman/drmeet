// appointment.service.js
import Appointment from "../models/appointment.model.js";
import Patient from "../models/patient.model.js";
import Doctor from "../models/doctor.model.js";

const apptSort = { date: -1, time: 1 };

// Get all appointments
export const findAllAppointments = async () => Appointment.find().sort(apptSort);

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
    .select("title firstName lastName photoUrl")
    .lean();
  const patientLookup = new Map(
    patientDocs.map((p) => {
      const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim();
      return [
        String(p._id),
        {
          name: fullName || "Unknown Patient",
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          title: String(p.title || "").trim(),
          photoUrl: String(p.photoUrl || "").trim(),
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
        firstName: "",
        lastName: "",
        title: "",
      },
    };
  });
}

async function withDoctorMeta(appointments = []) {
  if (!Array.isArray(appointments) || !appointments.length) return [];
  const doctorIds = [
    ...new Set(
      appointments
        .map((appt) => {
          const plain = appt?.toObject ? appt.toObject() : appt;
          return String(plain.doctor || "").trim();
        })
        .filter(Boolean),
    ),
  ];
  if (!doctorIds.length) return appointments;

  const doctorDocs = await Doctor.find({ _id: { $in: doctorIds } })
    .select("firstName lastName title")
    .lean();
  const doctorLookup = new Map(
    doctorDocs.map((d) => {
      const t = d.title ? `${d.title} ` : "";
      const name =
        `${t}${d.firstName || ""} ${d.lastName || ""}`.trim() || "Unknown Doctor";
      return [String(d._id), name];
    }),
  );

  return appointments.map((appt) => {
    const plain = appt?.toObject ? appt.toObject() : appt;
    const did = String(plain.doctor || "");
    return {
      ...plain,
      doctorDisplayName: doctorLookup.get(did) || "",
    };
  });
}

async function withAppointmentListMeta(appointments) {
  const withPatient = await withPatientMeta(appointments);
  return withDoctorMeta(withPatient);
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
  const appointments = await Appointment.find({ doctor: String(doctorId) }).sort(apptSort);
  return withAppointmentListMeta(appointments);
};

// Find all appointments by a specific patient
export const findAppointmentsByPatient = async (patientId) => {
  const appointments = await Appointment.find({ patient: patientId }).sort(apptSort);
  return withAppointmentListMeta(appointments);
};

export const findAppointmentsByDoctorForRoleScope = async (doctorId) => {
  const appointments = await Appointment.find({ doctor: String(doctorId) }).sort(apptSort);
  return withAppointmentListMeta(appointments);
};

export const findAllAppointmentsWithPatientMeta = async () => {
  const appointments = await Appointment.find().sort(apptSort);
  return withAppointmentListMeta(appointments);
};

export const appointmentExistsForDoctorPatient = async (doctorId, patientId) =>
  Appointment.exists({
    doctor: String(doctorId),
    patient: String(patientId),
  });
