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
  const needle = String(q || "").trim();

  const query = {
    _id: { $in: mongoIds },
    ...patientActiveQuery,
  };

  if (needle) {
    const rx = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const terms = needle.split(/\s+/).filter(Boolean);
    const andTerms = terms.map((t) => {
      const trx = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      return {
        $or: [
          { firstName: trx },
          { lastName: trx },
          { email: trx },
          { phone: trx },
        ],
      };
    });

    query.$or = [
      { firstName: rx },
      { lastName: rx },
      { email: rx },
      { phone: rx },
      ...(andTerms.length > 1 ? [{ $and: andTerms }] : []),
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
    const isCancelled = String(appt.status || "").toLowerCase() === "cancelled";
    if (!day || Number.isNaN(day.getTime())) {
      past.push(appt);
      continue;
    }
    if (day >= start && !isCancelled) upcoming.push(appt);
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

  const doctorDoc = await Doctor.findById(doctorId).select("userId").lean();
  const doctorUserId = doctorDoc?.userId ? String(doctorDoc.userId) : "";
  const doctorIdStr = String(doctorId);

  const patients = await findPatientsByIds(ids);
  const items = [];

  for (const p of patients) {
    const plain = p?.toObject ? p.toObject() : p;
    const pid = String(plain._id);
    const patientName = `${plain.firstName || ""} ${plain.lastName || ""}`.trim();
    const docs = Array.isArray(plain.documents) ? plain.documents : [];
    for (const d of docs) {
      const dDocId = d.doctorId ? String(d.doctorId) : "";
      const dRecId = d.receiverId ? String(d.receiverId) : "";
      const dUpId = d.uploaderId ? String(d.uploaderId) : "";

      // Strict doctor-patient relationship scoping:
      // Document must be targeted to this doctor (by doctorId or receiverId) or uploaded by this doctor (uploaderId)
      const isTargetedToThisDoctor =
        (dDocId && (dDocId === doctorIdStr || (doctorUserId && dDocId === doctorUserId))) ||
        (dRecId && ((doctorUserId && dRecId === doctorUserId) || dRecId === doctorIdStr)) ||
        (dUpId && ((doctorUserId && dUpId === doctorUserId) || dUpId === doctorIdStr));

      // Hide documents intended for other doctors
      if (!isTargetedToThisDoctor) {
        continue;
      }

      items.push({
        source: "patient",
        patientId: pid,
        patientName: patientName || "Patient",
        name: d.name || "Document",
        fileUrl: d.fileUrl || d.url || "",
        url: d.url || d.fileUrl || "",
        uploadedAt: d.uploadedAt || plain.updatedAt,
        uploaderId: d.uploaderId || null,
        uploaderRole: d.uploaderRole || "",
        receiverId: d.receiverId || null,
        doctorId: d.doctorId || null,
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
