import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";
import Patient from "../models/patient.model.js";
import Doctor from "../models/doctor.model.js";
import Conversation from "../models/conversation.model.js";
import { patientActiveQuery, findPatientsByIds } from "./patient.service.js";
import { findAppointmentsByDoctorForRoleScope } from "./appointment.service.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * All patient ObjectIds the doctor may manage: explicit assignment ∪ appointments ∪ care team.
 */
export async function collectAssignedPatientIds(doctorId) {
  if (!doctorId || !mongoose.Types.ObjectId.isValid(String(doctorId))) return [];

  const doctor = await Doctor.findById(doctorId).select("assignedPatients").lean();
  const explicit = new Set(
    (doctor?.assignedPatients || []).map((id) => String(id)),
  );

  const fromAppts = await Appointment.find({
    doctor: String(doctorId),
  })
    .distinct("patient")
    .exec();
  fromAppts.forEach((id) => {
    if (id) explicit.add(String(id));
  });

  const care = await Patient.find({
    ...patientActiveQuery,
    careTeamDoctorIds: doctorId,
  })
    .select("_id")
    .lean();
  care.forEach((p) => explicit.add(String(p._id)));

  return [...explicit].filter((id) => mongoose.Types.ObjectId.isValid(id));
}

export async function listPatientsForDoctorSearch(doctorId, { q = "", limit = 40 } = {}) {
  const ids = await collectAssignedPatientIds(doctorId);
  if (!ids.length) return [];

  const mongoIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const needle = String(q || "").trim().toLowerCase();

  const query = {
    _id: { $in: mongoIds },
    ...patientActiveQuery,
  };

  if (needle) {
    query.$or = [
      { firstName: new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      { lastName: new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      { email: new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
    ];
  }

  const patients = await Patient.find(query)
    .select(
      "title firstName lastName email phone gender birthdate photoUrl userId notes createdAt",
    )
    .sort({ lastName: 1, firstName: 1 })
    .limit(Math.min(Math.max(Number(limit) || 40, 1), 100))
    .lean();

  return patients;
}

export function partitionAppointmentsByTime(appointments = []) {
  const start = startOfToday();
  const upcoming = [];
  const past = [];

  for (const raw of appointments) {
    const appt = raw?.toObject ? raw.toObject() : raw;
    const day = appt.date ? new Date(appt.date) : null;
    if (!day || Number.isNaN(day.getTime())) {
      past.push(appt);
      continue;
    }
    if (day >= start) upcoming.push(appt);
    else past.push(appt);
  }

  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
  past.sort((a, b) => new Date(b.date) - new Date(a.date));

  return { upcoming, past };
}

export async function buildDoctorAppointmentBuckets(doctorMongoId) {
  const list = await findAppointmentsByDoctorForRoleScope(String(doctorMongoId));
  return partitionAppointmentsByTime(list);
}

export async function countConversationsForUser(userObjectId) {
  if (!userObjectId || !mongoose.Types.ObjectId.isValid(String(userObjectId))) return 0;
  return Conversation.countDocuments({
    participants: new mongoose.Types.ObjectId(String(userObjectId)),
  });
}

export async function aggregatePatientDocumentsForDoctor(doctorId) {
  const ids = await collectAssignedPatientIds(doctorId);
  if (!ids.length) return [];

  const patients = await findPatientsByIds(ids);
  const items = [];

  for (const p of patients) {
    const plain = p?.toObject ? p.toObject() : p;
    const pid = String(plain._id);
    const patientName = `${plain.firstName || ""} ${plain.lastName || ""}`.trim();
    const docs = Array.isArray(plain.documents) ? plain.documents : [];
    for (const d of docs) {
      items.push({
        source: "patient",
        patientId: pid,
        patientName: patientName || "Patient",
        name: d.name || "Document",
        fileUrl: d.fileUrl || d.url || "",
        url: d.url || d.fileUrl || "",
        uploadedAt: d.uploadedAt || plain.updatedAt,
        uploaderId: d.uploaderId || null,
        receiverId: d.receiverId || null,
        docType: "patient",
      });
    }
  }

  items.sort((a, b) => {
    const ta = new Date(a.uploadedAt || 0).getTime();
    const tb = new Date(b.uploadedAt || 0).getTime();
    return tb - ta;
  });

  return items;
}
