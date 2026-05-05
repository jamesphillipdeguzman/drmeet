import mongoose from 'mongoose';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import Patient from '../models/patient.model.js';
import Message from '../models/message.model.js';
import Conversation from '../models/conversation.model.js';
import Appointment from '../models/appointment.model.js';
import {
  findAllPatients,
  findPatientById,
  createPatient as createPatientService,
  updatePatientById as updatePatientByIdService,
  softDeletePatientById as softDeletePatientByIdService,
  findPatientsByUserId,
  findPatientsByAccountOwnerId,
  findPatientsByIds,
  findPatientsByDoctorCareTeam,
  findAnyPatientByUserId,
  isPatientDocActive,
  patientActiveQuery,
} from '../services/patient.service.js';
import { PHILIPPINES_HMO_PROVIDERS } from '../constants/philippinesHmo.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
let paymentMethodsJsonCache = null;

async function readPaymentMethodsJson() {
  if (paymentMethodsJsonCache) return paymentMethodsJsonCache;
  const buf = await readFile(
    path.join(MODULE_DIR, '../constants/payments.json'),
    'utf8',
  );
  paymentMethodsJsonCache = JSON.parse(buf);
  return paymentMethodsJsonCache;
}
import { findDoctorByUserId, findDoctorById } from '../services/doctor.service.js';
import User from '../models/user.model.js';
import { sanitizeInput } from '../utils/inputSanitizer.js';
import { uploadToCloudinary } from '../services/cloudinary.service.js';
import {
  findAppointmentsByDoctor,
  findAppointmentsByPatient,
  appointmentExistsForDoctorPatient,
} from '../services/appointment.service.js';
import { ensurePatientDoctorConversation } from './message.controller.js';
import { sendDoctorPatientDocumentEmail } from '../services/emailService.js';

function authUserId(req) {
  const id = req.user?._id || req.user?.id;
  return id ? String(id) : null;
}

function authRole(req) {
  return String(req.user?.role || '').toLowerCase();
}

function normalizePatientDocEntry(d) {
  if (!d) return d;
  const o = d.toObject ? d.toObject() : d;
  const url = o.url || o.fileUrl || '';
  return {
    ...o,
    url,
    fileUrl: o.fileUrl || o.url || '',
  };
}

function filterDocumentsForRequester(req, plain) {
  const raw = Array.isArray(plain.documents) ? plain.documents : [];
  const uid = authUserId(req);
  const role = authRole(req);
  if (role === 'admin') {
    return raw.map(normalizePatientDocEntry);
  }
  return raw
    .filter((d) => {
      const row = d.toObject ? d.toObject() : d;
      const up = row.uploaderId ? String(row.uploaderId) : '';
      const rec = row.receiverId ? String(row.receiverId) : '';
      if (!up && !rec) return true;
      if (!uid) return false;
      return up === uid || rec === uid;
    })
    .map(normalizePatientDocEntry);
}

const mapPatientForClient = (patient, req = null) => {
  const plain = patient?.toObject ? patient.toObject() : patient;
  const addressText =
    typeof plain.address === 'string'
      ? plain.address
      : [
          plain.address?.address1,
          plain.address?.address2,
          plain.address?.city,
          plain.address?.province,
          plain.address?.postcode,
          plain.address?.country,
        ]
          .filter(Boolean)
          .join(', ');

  const documents = req
    ? filterDocumentsForRequester(req, plain)
    : Array.isArray(plain.documents)
      ? plain.documents.map(normalizePatientDocEntry)
      : [];

  return {
    ...plain,
    birthdate: plain.birthdate || null,
    address: addressText || '',
    relationshipToAccountHolder: plain.relationshipToAccountHolder || '',
    isDependent: Boolean(plain.accountOwnerId) && String(plain.userId || '') !== String(plain.accountOwnerId || ''),
    familyHeadName: plain.familyHeadName || '',
    isCareTeamLinked: Array.isArray(plain.careTeamDoctorIds) && plain.careTeamDoctorIds.length > 0,
    documents,
    isInsured: Boolean(plain.isInsured),
    hmoProvider: plain.isInsured ? String(plain.hmoProvider || '').trim() : '',
    registrationFacility: String(plain.registrationFacility || '').trim(),
  };
};

async function doctorMayAccessPatientDoctorScope(doctorMongoId, patientDoc) {
  if (!patientDoc || !doctorMongoId) return false;
  const pid = String(patientDoc._id);
  const appt = await appointmentExistsForDoctorPatient(String(doctorMongoId), pid);
  if (appt) return true;
  const ids = Array.isArray(patientDoc.careTeamDoctorIds)
    ? patientDoc.careTeamDoctorIds.map(String)
    : [];
  return ids.includes(String(doctorMongoId));
}

async function primaryCareDoctorUserIdForPatient(patientLike) {
  const plain = patientLike?.toObject ? patientLike.toObject() : patientLike;
  const ids = Array.isArray(plain?.careTeamDoctorIds) ? plain.careTeamDoctorIds : [];
  if (!ids.length) return null;
  const d = await findDoctorById(ids[0]);
  return d?.userId ? String(d.userId) : null;
}

async function doctorUserIdForPatientMessaging(patientLike) {
  const fromCare = await primaryCareDoctorUserIdForPatient(patientLike);
  if (fromCare) return fromCare;
  const plain = patientLike?.toObject ? patientLike.toObject() : patientLike;
  const pid = plain?._id ? String(plain._id) : '';
  if (!pid || !mongoose.Types.ObjectId.isValid(pid)) return null;
  const latest = await Appointment.findOne({ patient: pid })
    .sort({ date: -1, createdAt: -1 })
    .select('doctor')
    .lean();
  if (!latest?.doctor) return null;
  const d = await findDoctorById(String(latest.doctor));
  return d?.userId ? String(d.userId) : null;
}

async function notifyDoctorOfPatientDocumentUpload({
  patientUserId,
  patientLabel,
  docEntry,
  patientDocLike,
}) {
  try {
    if (!patientUserId || !docEntry) return;
    const url = String(docEntry.fileUrl || docEntry.url || '').trim();
    if (!url) return;
    const plainPatient = patientDocLike?.toObject
      ? patientDocLike.toObject()
      : patientDocLike;
    if (!plainPatient) return;
    const doctorUserId = await doctorUserIdForPatientMessaging(plainPatient);
    if (!doctorUserId) return;

    const doctorUser = await User.findById(doctorUserId)
      .select('email firstName lastName')
      .lean();
    if (doctorUser?.email) {
      void sendDoctorPatientDocumentEmail({
        to: doctorUser.email,
        doctorFirstName: doctorUser.firstName || '',
        patientLabel,
        documentName: docEntry.name || 'Attachment',
        documentUrl: url,
      });
    }

    const conversation = await ensurePatientDoctorConversation({
      patientId: String(patientUserId),
      doctorId: String(doctorUserId),
    });
    const label = String(docEntry.name || 'attachment').trim() || 'attachment';
    const text = `Shared a document from their profile: ${label}.`;
    await Message.create({
      conversationId: conversation._id,
      senderId: patientUserId,
      message: text,
      attachmentUrl: url,
      attachmentName: String(docEntry.name || ''),
      attachmentType: '',
      readBy: [patientUserId],
    });
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: docEntry.name ? `📎 ${docEntry.name}` : '📎 Attachment',
      lastMessageAt: new Date(),
    });
  } catch (e) {
    console.error('[PATIENT][documents] notify doctor failed', e?.message || e);
  }
}

async function getScopedPatients(req) {
  const role = authRole(req);
  const uid = authUserId(req);

  if (role === 'admin') {
    return findAllPatients();
  }

  if (role === 'receptionist' && uid) {
    const receptionist = await User.findById(uid).select('linkedDoctorId').lean();
    const linkedDoctorId = receptionist?.linkedDoctorId
      ? String(receptionist.linkedDoctorId)
      : '';
    if (!linkedDoctorId) return [];
    const [appts, linkedPatients] = await Promise.all([
      findAppointmentsByDoctor(linkedDoctorId),
      findPatientsByDoctorCareTeam(linkedDoctorId),
    ]);
    const patientIds = [...new Set([
      ...appts.map((a) => a.patient).filter(Boolean),
      ...linkedPatients.map((p) => p._id),
    ])]
      .map((id) => String(id))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    return findPatientsByIds(patientIds);
  }

  if (role === 'patient' && uid) {
    const [primary, dependents] = await Promise.all([
      findPatientsByUserId(uid),
      findPatientsByAccountOwnerId(uid),
    ]);
    const merged = [...primary, ...dependents];
    const seen = new Set();
    return merged.filter((p) => {
      const id = String(p._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  if (role === 'doctor' && uid) {
    const doctor = await findDoctorByUserId(uid);
    if (!doctor) return [];
    const [appts, linkedPatients] = await Promise.all([
      findAppointmentsByDoctor(String(doctor._id)),
      findPatientsByDoctorCareTeam(String(doctor._id)),
    ]);
    const patientIds = [...new Set([
      ...appts.map((a) => a.patient).filter(Boolean),
      ...linkedPatients.map((p) => p._id),
    ])]
      .map((id) => String(id))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!patientIds.length) return [];
    return findPatientsByIds(patientIds);
  }

  return [];
}

async function patientVisibleToRequester(req, patientDoc) {
  if (!patientDoc) return false;
  const role = authRole(req);
  const uid = authUserId(req);
  const pid = String(patientDoc._id);

  if (role === 'admin') return true;

  if (role === 'receptionist' && uid) {
    const receptionist = await User.findById(uid).select('linkedDoctorId').lean();
    const linkedDoctorId = receptionist?.linkedDoctorId
      ? String(receptionist.linkedDoctorId)
      : '';
    if (!linkedDoctorId) return false;
    return doctorMayAccessPatientDoctorScope(linkedDoctorId, patientDoc);
  }

  if (role === 'patient' && uid) {
    return (
      String(patientDoc.userId || '') === uid ||
      String(patientDoc.accountOwnerId || '') === uid
    );
  }

  if (role === 'doctor' && uid) {
    const doctor = await findDoctorByUserId(uid);
    if (!doctor) return false;
    return doctorMayAccessPatientDoctorScope(String(doctor._id), patientDoc);
  }

  return false;
}

/**
 * @route GET /api/patients
 * @desc Fetch patients visible to the authenticated user
 */
export const getAllPatients = async (req, res) => {
  try {
    const patients = await getScopedPatients(req);
    let normalizedPatients = patients.map((p) => mapPatientForClient(p, req));
    if (authRole(req) === 'doctor' || authRole(req) === 'receptionist' || authRole(req) === 'admin') {
      const ownerIds = [
        ...new Set(
          patients
            .map((p) => String(p.accountOwnerId || ''))
            .filter(Boolean),
        ),
      ].filter((id) => mongoose.Types.ObjectId.isValid(id));
      const owners = ownerIds.length
        ? await User.find({ _id: { $in: ownerIds } })
            .select('firstName lastName')
            .lean()
        : [];
      const ownerMap = new Map(
        owners.map((o) => [String(o._id), `${o.firstName || ''} ${o.lastName || ''}`.trim()]),
      );
      normalizedPatients = normalizedPatients.map((p) => ({
        ...p,
        familyHeadName: p.accountOwnerId ? ownerMap.get(String(p.accountOwnerId)) || '' : '',
      }));
    }
    console.log('[PATIENT]✅ GET /api/patients was called.');
    return res.status(200).json(normalizedPatients);
  } catch (error) {
    console.log('Error fetching patients: ', error);
    return res
      .status(500)
      .json({ error: 'An error occured while fetching all patients.' });
  }
};

/**
 * @route GET /api/patients/:id
 * @desc Fetch a patient by ID
 */
export const getPatientById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log('Invalid patient ID format');
    return res.status(400).json({ error: 'Invalid patient ID format' });
  }
  try {
    const patient = await findPatientById(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }
    const allowed = await patientVisibleToRequester(req, patient);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    console.log(`[PATIENT]✅ GET /api/patients/${id} was called`);
    return res.status(200).json(mapPatientForClient(patient, req));
  } catch (error) {
    console.log(`Error fetching the patient with ${id}:`, error);
    return res
      .status(500)
      .json({ error: 'An error occured while fetching the patient.' });
  }
};

/**
 * @route POST /api/patients
 * @desc Create a new patient
 */
export const postPatient = async (req, res) => {
  try {
    const cleanedBody = sanitizeInput(req.body || {});
    const role = authRole(req);
    const uid = authUserId(req);

    const {
      firstName,
      lastName,
      email,
      birthdate,
      address,
      name,
      documentFileData,
      documentName,
      photoFileData,
      isInsured: rawInsured,
      hmoProvider: rawHmo,
      ...rest
    } = cleanedBody;

    let resolvedFirstName = firstName;
    let resolvedLastName = lastName;

    if (!resolvedFirstName && !resolvedLastName && name) {
      const parts = name.trim().split(' ');
      resolvedFirstName = parts[0];
      resolvedLastName = parts.slice(1).join(' ') || '';
    }

    if (!resolvedFirstName || !resolvedLastName) {
      return res.status(400).json({
        error: 'firstName and lastName are required',
      });
    }

    let parsedBirthdate = undefined;

    if (birthdate) {
      const d = new Date(birthdate);

      if (isNaN(d.getTime())) {
        return res.status(400).json({
          error: 'Invalid birthdate format. Use YYYY-MM-DD',
        });
      }

      parsedBirthdate = d;
    }

    const insured = Boolean(rawInsured);
    if (insured) {
      const hmo = String(rawHmo || '').trim();
      if (!hmo || !PHILIPPINES_HMO_PROVIDERS.includes(hmo)) {
        return res.status(400).json({
          error: 'When insured, select a valid HMO provider from the list.',
        });
      }
    }

    const registrationFacility = String(cleanedBody.registrationFacility || '').trim();

    const patientData = {
      ...rest,
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      email: email || '',
      birthdate: parsedBirthdate,
      address: typeof address === 'string' ? { address1: address } : address,
      isInsured: insured,
      hmoProvider: insured ? String(rawHmo || '').trim() : '',
      registrationFacility,
    };

    if (role === 'patient' && uid) {
      const isDependent = Boolean(patientData.relationshipToAccountHolder);
      if (isDependent) {
        patientData.accountOwnerId = uid;
      } else {
        const existingByUser = await findAnyPatientByUserId(uid);
        if (existingByUser) {
          if (isPatientDocActive(existingByUser)) {
            return res.status(400).json({
              error: 'A primary patient profile is already linked to this account.',
            });
          }
          return res.status(400).json({
            error:
              'An archived patient record is still linked to this account. Contact the clinic to restore it before creating a new profile.',
          });
        }
        patientData.userId = uid;
        patientData.accountOwnerId = uid;
      }
    } else if (!patientData.userId) {
      delete patientData.userId;
    }

    if (role === 'doctor' && uid) {
      const doctor = await findDoctorByUserId(uid);
      if (doctor) {
        const cur = Array.isArray(patientData.careTeamDoctorIds)
          ? patientData.careTeamDoctorIds.map(String)
          : [];
        const did = String(doctor._id);
        if (!cur.includes(did)) {
          patientData.careTeamDoctorIds = [...(patientData.careTeamDoctorIds || []), doctor._id];
        }
      }
    } else if (role === 'receptionist' && uid) {
      const ru = await User.findById(uid).select('linkedDoctorId').lean();
      if (ru?.linkedDoctorId) {
        const cur = Array.isArray(patientData.careTeamDoctorIds)
          ? patientData.careTeamDoctorIds.map(String)
          : [];
        const did = String(ru.linkedDoctorId);
        if (!cur.includes(did)) {
          patientData.careTeamDoctorIds = [...(patientData.careTeamDoctorIds || []), ru.linkedDoctorId];
        }
      }
    }

    const emailNorm = String(email || '').trim().toLowerCase();
    if (emailNorm && parsedBirthdate && registrationFacility) {
      const start = new Date(parsedBirthdate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(parsedBirthdate);
      end.setUTCHours(23, 59, 59, 999);
      const esc = emailNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const dup = await Patient.findOne({
        ...patientActiveQuery,
        birthdate: { $gte: start, $lte: end },
        registrationFacility,
        email: new RegExp(`^${esc}$`, 'i'),
      });
      if (dup) {
        return res.status(400).json({
          error:
            'A patient with this email, date of birth, and registration facility already exists.',
        });
      }
    }

    if (photoFileData) {
      const uploadedPhoto = await uploadToCloudinary(photoFileData, {
        folder: 'drmeet/patients/profile',
        resource_type: 'image',
      });
      patientData.photoUrl = uploadedPhoto.secure_url;
    }

    if (documentFileData) {
      const uploaded = await uploadToCloudinary(documentFileData, {
        folder: 'drmeet/patients',
        resource_type: 'auto',
      });
      const secureUrl = uploaded.secure_url;
      const docEntry = {
        name: String(documentName || 'Patient attachment'),
        url: secureUrl,
        fileUrl: secureUrl,
        uploadedAt: new Date(),
      };
      if (uid && mongoose.Types.ObjectId.isValid(uid)) {
        docEntry.uploaderId = new mongoose.Types.ObjectId(uid);
      }
      if (role === 'patient' && uid) {
        const recv = await primaryCareDoctorUserIdForPatient(patientData);
        if (recv && mongoose.Types.ObjectId.isValid(recv)) {
          docEntry.receiverId = new mongoose.Types.ObjectId(recv);
        }
      } else if (['doctor', 'receptionist', 'admin'].includes(role) && patientData.userId) {
        docEntry.receiverId = patientData.userId;
      }
      patientData.documents = [docEntry];
      console.log('[PATIENT][documents] POST create upload', {
        hasUploader: Boolean(docEntry.uploaderId),
        hasReceiver: Boolean(docEntry.receiverId),
      });
    }

    const newPatient = await createPatientService(patientData);
    if (newPatient.userId) {
      await User.findByIdAndUpdate(
        newPatient.userId,
        {
          title: newPatient.title || '',
          firstName: newPatient.firstName || '',
          lastName: newPatient.lastName || '',
          email: newPatient.email || '',
          phone: newPatient.phone || '',
          ...(newPatient.photoUrl ? { picture: newPatient.photoUrl } : {}),
        },
        { new: true },
      );
    }

    console.log('[PATIENT]✅ POST /api/patients created', String(newPatient._id));

    if (documentFileData && authRole(req) === 'patient' && authUserId(req)) {
      const docs = Array.isArray(newPatient.documents) ? newPatient.documents : [];
      const lastDoc = docs.length ? docs[docs.length - 1] : null;
      if (lastDoc) {
        const uid = authUserId(req);
        const label =
          `${newPatient.firstName || ''} ${newPatient.lastName || ''}`.trim() ||
          'Patient';
        void notifyDoctorOfPatientDocumentUpload({
          patientUserId: uid,
          patientLabel: label,
          docEntry: lastDoc,
          patientDocLike: newPatient,
        });
      }
    }

    return res.status(201).json(mapPatientForClient(newPatient, req));
  } catch (error) {
    console.error('CREATE PATIENT ERROR:', error);

    return res.status(500).json({
      error: error.message || 'Server error while creating patient',
    });
  }
};

/**
 * @route PUT /api/patients/:id
 * @desc Update a patient by ID
 */
export const updatePatient = async (req, res) => {
  const { id } = req.params;
  const cleanedBody = sanitizeInput(req.body || {});
    const updates = {
    ...cleanedBody,
    birthdate: cleanedBody.birthdate || cleanedBody.birthdate || undefined,
    address:
      typeof cleanedBody.address === 'string'
        ? { address1: cleanedBody.address }
        : cleanedBody.address,
  };

    if ('isInsured' in cleanedBody || 'hmoProvider' in cleanedBody) {
      const insured = Boolean(cleanedBody.isInsured);
      updates.isInsured = insured;
      if (insured) {
        const hmo = String(cleanedBody.hmoProvider || '').trim();
        if (!PHILIPPINES_HMO_PROVIDERS.includes(hmo)) {
          return res.status(400).json({
            error: 'When insured, select a valid HMO provider from the list.',
          });
        }
        updates.hmoProvider = hmo;
      } else {
        updates.hmoProvider = '';
      }
    }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  let uploadedDocForNotify = null;
  try {
    const existing = await findPatientById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Patient not found. ' });
    }
    if (cleanedBody.documentFileData) {
      const uploaded = await uploadToCloudinary(cleanedBody.documentFileData, {
        folder: 'drmeet/patients',
        resource_type: 'auto',
      });
      const secureUrl = uploaded.secure_url;
      const docs = Array.isArray(existing?.documents) ? existing.documents : [];
      const uid = authUserId(req);
      const role = authRole(req);
      const docEntry = {
        name: String(cleanedBody.documentName || 'Patient attachment'),
        url: secureUrl,
        fileUrl: secureUrl,
        uploadedAt: new Date(),
      };
      if (uid && mongoose.Types.ObjectId.isValid(uid)) {
        docEntry.uploaderId = new mongoose.Types.ObjectId(uid);
      }
      if (role === 'patient' && uid) {
        const recv = await doctorUserIdForPatientMessaging(existing);
        if (recv && mongoose.Types.ObjectId.isValid(recv)) {
          docEntry.receiverId = new mongoose.Types.ObjectId(recv);
        }
      } else if (['doctor', 'receptionist', 'admin'].includes(role) && existing.userId) {
        docEntry.receiverId = existing.userId;
      }
      uploadedDocForNotify = docEntry;
      updates.documents = [...docs, docEntry];
      console.log('[PATIENT][documents] PUT append', {
        patientId: id,
        hasUploader: Boolean(docEntry.uploaderId),
        hasReceiver: Boolean(docEntry.receiverId),
      });
    }
    if (cleanedBody.photoFileData) {
      const uploadedPhoto = await uploadToCloudinary(cleanedBody.photoFileData, {
        folder: 'drmeet/patients/profile',
        resource_type: 'image',
      });
      updates.photoUrl = uploadedPhoto.secure_url;
    }
    const allowed = await patientVisibleToRequester(req, existing);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const role = authRole(req);
    if (role === 'patient') {
      delete updates.userId;
    }

    const updatedPatient = await updatePatientByIdService(id, updates);
    if (!updatedPatient) {
      return res.status(404).json({ error: 'Patient not found. ' });
    }
    const linkedUserId = updatedPatient.userId || existing.userId;
    if (linkedUserId) {
      await User.findByIdAndUpdate(
        linkedUserId,
        {
          title: updatedPatient.title || '',
          firstName: updatedPatient.firstName || '',
          lastName: updatedPatient.lastName || '',
          email: updatedPatient.email || '',
          phone: updatedPatient.phone || '',
          ...(updatedPatient.photoUrl
            ? { picture: updatedPatient.photoUrl }
            : {}),
        },
        { new: true },
      );
    }
    console.log(`[PATIENT]✅ PUT /api/patients/${id} was called`);

    if (uploadedDocForNotify && authRole(req) === 'patient' && authUserId(req)) {
      const uid = authUserId(req);
      const label =
        `${updatedPatient.firstName || ''} ${updatedPatient.lastName || ''}`.trim() ||
        'Patient';
      void notifyDoctorOfPatientDocumentUpload({
        patientUserId: uid,
        patientLabel: label,
        docEntry: uploadedDocForNotify,
        patientDocLike: updatedPatient,
      });
    }

    return res.status(200).json(mapPatientForClient(updatedPatient, req));
  } catch (error) {
    console.log(`Error updating the patient with ${id}:`, error);
    return res
      .status(500)
      .json({ error: 'An error occured while updating the patient.' });
  }
};

/**
 * @route DELETE /api/patients/:id
 * @desc Delete a patient by ID
 */
export const deletePatient = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  if (authRole(req) !== 'admin') {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  try {
    const archivedPatient = await softDeletePatientByIdService(id);
    if (!archivedPatient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }
    console.log(
      `[PATIENT]✅ DELETE /api/patients/${id} - Patient ${archivedPatient._id} soft-deleted (clinic removed; User unchanged)`,
    );

    return res.status(200).json({
      message: 'Patient removed from active clinic records. Linked User account was not deleted.',
      softDeleted: true,
      patientId: String(archivedPatient._id),
      deletedAt: archivedPatient.deletedAt,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'An error occured while deleting the patient.' });
  }
};

export const searchPatients = async (req, res) => {
  try {
    const role = authRole(req);
    if (!['doctor', 'receptionist', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(200).json([]);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const pool = await getScopedPatients(req);
    const matches = pool.filter(
      (p) =>
        regex.test(`${p.firstName || ''} ${p.lastName || ''}`) ||
        regex.test(String(p.email || '')) ||
        regex.test(String(p.phone || '')),
    );
    return res
      .status(200)
      .json(matches.slice(0, 10).map((p) => mapPatientForClient(p, req)));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to search patients.' });
  }
};

export const attachExistingPatientToCareTeam = async (req, res) => {
  try {
    const role = authRole(req);
    const uid = authUserId(req);
    if (!['doctor', 'receptionist'].includes(role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid patient ID format.' });
    }
    let doctorId = '';
    if (role === 'doctor') {
      const doctor = await findDoctorByUserId(uid);
      if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
      doctorId = String(doctor._id);
    } else {
      const receptionist = await User.findById(uid).select('linkedDoctorId').lean();
      if (!receptionist?.linkedDoctorId) {
        return res.status(400).json({ error: 'Receptionist is not linked to a doctor.' });
      }
      doctorId = String(receptionist.linkedDoctorId);
    }
    const patient = await findPatientById(id);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });
    const existing = Array.isArray(patient.careTeamDoctorIds)
      ? patient.careTeamDoctorIds.map((x) => String(x))
      : [];
    if (!existing.includes(doctorId)) {
      patient.careTeamDoctorIds = [...existing, doctorId];
      await patient.save();
    }
    return res.status(200).json(mapPatientForClient(patient, req));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to attach existing patient.' });
  }
};

export const getPhilippinesHmoProviders = async (req, res) => {
  try {
    return res.status(200).json({ providers: PHILIPPINES_HMO_PROVIDERS });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load HMO list.' });
  }
};

export const getPaymentMethodCatalog = async (req, res) => {
  try {
    const data = await readPaymentMethodsJson();
    return res.status(200).json(data);
  } catch (e) {
    console.error('[patients] payment methods', e);
    return res.status(500).json({ error: 'Failed to load payment methods.' });
  }
};

export const getPatientMessagingRecipient = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid patient ID format.' });
    }
    const patient = await findPatientById(id);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });
    const allowed = await patientVisibleToRequester(req, patient);
    if (!allowed) return res.status(403).json({ error: 'Forbidden.' });

    if (patient.userId) {
      return res.status(200).json({ recipientUserId: String(patient.userId) });
    }
    const email = String(patient.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(404).json({ error: 'No linked account or patient email found.' });
    }
    const user = await User.findOne({ email }).select('_id').lean();
    if (!user?._id) {
      return res.status(404).json({ error: 'No user account found for this patient email.' });
    }
    return res.status(200).json({ recipientUserId: String(user._id) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to resolve patient messaging recipient.' });
  }
};
