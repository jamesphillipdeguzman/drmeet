import mongoose from "mongoose";
import Doctor from "../models/doctor.model.js";
import Patient from "../models/patient.model.js";
import { sanitizeInput } from "../utils/inputSanitizer.js";
import { uploadToCloudinary } from "../services/cloudinary.service.js";
import { findDoctorByUserId } from "../services/doctor.service.js";
import { findAppointmentById, updateAppointmentById } from "../services/appointment.service.js";
import { patientActiveQuery } from "../services/patient.service.js";
import {
  collectAssignedPatientIds,
  listPatientsForDoctorSearch,
  buildDoctorAppointmentBuckets,
  countConversationsForUser,
  aggregatePatientDocumentsForDoctor,
} from "../services/doctorDashboard.service.js";

function authUserId(req) {
  const id = req.user?._id || req.user?.id;
  return id ? String(id) : null;
}

async function requireDoctorProfile(req) {
  const uid = authUserId(req);
  if (!uid) {
    return { error: { status: 401, body: { error: "Unauthorized." } } };
  }
  const doctor = await findDoctorByUserId(uid);
  if (!doctor) {
    return { error: { status: 404, body: { error: "Doctor profile not found." } } };
  }
  return { doctor, userId: uid };
}

function clinicLabel(doctor) {
  const plain = doctor?.toObject ? doctor.toObject() : doctor;
  const slot = Array.isArray(plain.availability) ? plain.availability[0] : null;
  return (
    plain.affiliatedClinics ||
    slot?.location?.clinicName ||
    slot?.location?.address1 ||
    ""
  );
}

/**
 * GET /api/doctors/me/overview
 */
export const getDoctorDashboardOverview = async (req, res) => {
  try {
    const ctx = await requireDoctorProfile(req);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const { doctor, userId } = ctx;
    const plain = doctor.toObject ? doctor.toObject() : doctor;
    const doctorMongoId = String(doctor._id);

    const patientIds = await collectAssignedPatientIds(doctorMongoId);
    const { upcoming, past } = await buildDoctorAppointmentBuckets(doctorMongoId);
    const messageThreads = await countConversationsForUser(userId);

    return res.status(200).json({
      doctorId: doctorMongoId,
      userId,
      name: `${plain.firstName || ""} ${plain.lastName || ""}`.trim(),
      title: plain.title || "",
      specialty: plain.specialty || "",
      licenseNumber: plain.licenseNumber || "",
      email: plain.email || "",
      phone: plain.phone || "",
      photoUrl: plain.photoUrl || "",
      clinic: clinicLabel(plain),
      room: plain.room || "",
      stats: {
        assignedPatientCount: patientIds.length,
        upcomingAppointmentCount: upcoming.length,
        pastAppointmentCount: past.length,
        messageThreads,
      },
      notificationPrefs: plain.notificationPrefs || {
        emailAppointments: true,
        emailMessages: true,
      },
    });
  } catch (err) {
    console.error("[doctorDashboard] overview", err);
    return res.status(500).json({ error: "Failed to load dashboard overview." });
  }
};

/**
 * GET /api/doctors/me/patients?q=&limit=
 */
export const getDoctorDashboardPatients = async (req, res) => {
  try {
    const ctx = await requireDoctorProfile(req);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const q = String(req.query.q || "").trim();
    const limit = req.query.limit;
    const rows = await listPatientsForDoctorSearch(String(ctx.doctor._id), {
      q,
      limit,
    });

    return res.status(200).json({ patients: rows });
  } catch (err) {
    console.error("[doctorDashboard] patients", err);
    return res.status(500).json({ error: "Failed to load patients." });
  }
};

/**
 * GET /api/doctors/me/appointments?scope=upcoming|past|all
 */
export const getDoctorDashboardAppointments = async (req, res) => {
  try {
    const ctx = await requireDoctorProfile(req);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const scope = String(req.query.scope || "all").toLowerCase();
    const { upcoming, past } = await buildDoctorAppointmentBuckets(String(ctx.doctor._id));

    if (scope === "upcoming") return res.status(200).json({ appointments: upcoming });
    if (scope === "past") return res.status(200).json({ appointments: past });
    return res.status(200).json({ upcoming, past });
  } catch (err) {
    console.error("[doctorDashboard] appointments", err);
    return res.status(500).json({ error: "Failed to load appointments." });
  }
};

const ALLOWED_APPT_STATUS = new Set(["pending", "confirmed", "completed", "cancelled"]);

/**
 * PATCH /api/doctors/me/appointments/:id/status
 */
export const patchDoctorDashboardAppointmentStatus = async (req, res) => {
  try {
    const ctx = await requireDoctorProfile(req);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid appointment id." });
    }

    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!ALLOWED_APPT_STATUS.has(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    const appt = await findAppointmentById(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found." });
    if (String(appt.doctor) !== String(ctx.doctor._id)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const updated = await updateAppointmentById(id, { status });
    return res.status(200).json(updated);
  } catch (err) {
    console.error("[doctorDashboard] patch status", err);
    return res.status(500).json({ error: "Failed to update appointment." });
  }
};

/**
 * GET /api/doctors/me/documents?patientId=&source=
 * source=patient|clinic|all (default all)
 */
export const getDoctorDashboardDocuments = async (req, res) => {
  try {
    const ctx = await requireDoctorProfile(req);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const filterPid = String(req.query.patientId || "").trim();
    const source = String(req.query.source || "all").toLowerCase();

    const doctorPlain = ctx.doctor.toObject ? ctx.doctor.toObject() : ctx.doctor;
    const clinicDocs = (Array.isArray(doctorPlain.documents) ? doctorPlain.documents : []).map(
      (d) => ({
        source: "clinic",
        docType: d.docType || "clinic",
        name: d.name || "Document",
        fileUrl: d.fileUrl || d.url || "",
        url: d.url || d.fileUrl || "",
        uploadedAt: d.uploadedAt || doctorPlain.updatedAt,
        uploaderId: d.uploaderId || null,
        receiverId: d.receiverId || null,
      }),
    );

    let patientDocs = await aggregatePatientDocumentsForDoctor(String(ctx.doctor._id));
    if (filterPid && mongoose.Types.ObjectId.isValid(filterPid)) {
      patientDocs = patientDocs.filter((row) => String(row.patientId) === filterPid);
    }

    let items = [];
    if (source === "clinic") items = [...clinicDocs];
    else if (source === "patient") items = [...patientDocs];
    else items = [...clinicDocs, ...patientDocs];

    items.sort((a, b) => {
      const ta = new Date(a.uploadedAt || 0).getTime();
      const tb = new Date(b.uploadedAt || 0).getTime();
      return tb - ta;
    });

    return res.status(200).json({ documents: items });
  } catch (err) {
    console.error("[doctorDashboard] documents", err);
    return res.status(500).json({ error: "Failed to load documents." });
  }
};

/**
 * POST /api/doctors/me/documents
 * body: { scope: 'clinic'|'patient', patientId?, documentName, documentFileData (base64) }
 */
export const postDoctorDashboardDocument = async (req, res) => {
  try {
    const ctx = await requireDoctorProfile(req);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const body = sanitizeInput(req.body || {});
    const scope = String(body.scope || "clinic").toLowerCase();
    const uid = authUserId(req);

    if (!body.documentFileData) {
      return res.status(400).json({ error: "documentFileData is required." });
    }

    const uploaded = await uploadToCloudinary(body.documentFileData, {
      folder: "drmeet/doctor-documents",
      resource_type: "auto",
    });
    const secureUrl = uploaded.secure_url;
    const name = String(body.documentName || body.name || "Attachment").trim() || "Attachment";

    if (scope === "patient") {
      const patientId = String(body.patientId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({ error: "Valid patientId is required for patient uploads." });
      }
      const allowed = await collectAssignedPatientIds(String(ctx.doctor._id));
      if (!allowed.includes(patientId)) {
        return res.status(403).json({ error: "Patient is not assigned to your practice." });
      }

      const patient = await Patient.findOne({
        _id: patientId,
        ...patientActiveQuery,
      });
      if (!patient) return res.status(404).json({ error: "Patient not found." });

      const docs = Array.isArray(patient.documents) ? patient.documents : [];
      const docEntry = {
        name,
        url: secureUrl,
        fileUrl: secureUrl,
        uploadedAt: new Date(),
      };
      if (uid && mongoose.Types.ObjectId.isValid(uid)) {
        docEntry.uploaderId = new mongoose.Types.ObjectId(uid);
      }
      if (patient.userId && mongoose.Types.ObjectId.isValid(String(patient.userId))) {
        docEntry.receiverId = patient.userId;
      }

      patient.documents = [...docs, docEntry];
      await patient.save();

      return res.status(201).json({
        source: "patient",
        patientId: String(patient._id),
        document: docEntry,
      });
    }

    const doctor = await Doctor.findById(ctx.doctor._id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });

    const docs = Array.isArray(doctor.documents) ? doctor.documents : [];
    const docEntry = {
      name,
      url: secureUrl,
      fileUrl: secureUrl,
      docType: String(body.docType || "clinic").trim() || "clinic",
      uploadedAt: new Date(),
    };
    if (uid && mongoose.Types.ObjectId.isValid(uid)) {
      docEntry.uploaderId = new mongoose.Types.ObjectId(uid);
    }

    doctor.documents = [...docs, docEntry];
    await doctor.save();

    return res.status(201).json({ source: "clinic", document: docEntry });
  } catch (err) {
    console.error("[doctorDashboard] post document", err);
    return res.status(500).json({ error: "Failed to upload document." });
  }
};

/**
 * GET /api/doctors/me/messages-summary
 */
export const getDoctorDashboardMessagesSummary = async (req, res) => {
  try {
    const ctx = await requireDoctorProfile(req);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const threads = await countConversationsForUser(ctx.userId);
    return res.status(200).json({ conversationCount: threads });
  } catch (err) {
    console.error("[doctorDashboard] messages summary", err);
    return res.status(500).json({ error: "Failed to load messages summary." });
  }
};

/**
 * PATCH /api/doctors/me/notification-prefs
 */
export const patchDoctorNotificationPrefs = async (req, res) => {
  try {
    const ctx = await requireDoctorProfile(req);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const prefs = req.body || {};
    const existingDoc = await Doctor.findById(ctx.doctor._id).lean();
    if (!existingDoc) return res.status(404).json({ error: "Doctor not found." });

    const existing = existingDoc.notificationPrefs || {};
    const merged = {
      emailAppointments:
        typeof prefs.emailAppointments === "boolean"
          ? prefs.emailAppointments
          : existing.emailAppointments !== false,
      emailMessages:
        typeof prefs.emailMessages === "boolean"
          ? prefs.emailMessages
          : existing.emailMessages !== false,
    };

    const updated = await Doctor.findByIdAndUpdate(
      ctx.doctor._id,
      { $set: { notificationPrefs: merged } },
      { new: true },
    ).select("notificationPrefs");

    return res.status(200).json({ notificationPrefs: updated.notificationPrefs });
  } catch (err) {
    console.error("[doctorDashboard] notification prefs", err);
    return res.status(500).json({ error: "Failed to update notification preferences." });
  }
};
