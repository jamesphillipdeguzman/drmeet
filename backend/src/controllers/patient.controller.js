import mongoose from 'mongoose';

import {
  findAllPatients,
  findPatientById,
  createPatient as createPatientService,
  updatePatientById as updatePatientByIdService,
  deletePatientById as deletePatientByIdService,
  findPatientsByUserId,
  findPatientsByAccountOwnerId,
  findPatientsByIds,
  findPatientsByDoctorCareTeam,
} from '../services/patient.service.js';
import { findDoctorByUserId } from '../services/doctor.service.js';
import User from '../models/user.model.js';
import { sanitizeInput } from '../utils/inputSanitizer.js';
import { uploadToCloudinary } from '../services/cloudinary.service.js';
import {
  findAppointmentsByDoctor,
  findAppointmentsByPatient,
  appointmentExistsForDoctorPatient,
} from '../services/appointment.service.js';

function authUserId(req) {
  const id = req.user?._id || req.user?.id;
  return id ? String(id) : null;
}

function authRole(req) {
  return String(req.user?.role || '').toLowerCase();
}

const mapPatientForClient = (patient) => {
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

  return {
    ...plain,
    birthdate: plain.birthdate || null,
    address: addressText || '',
    relationshipToAccountHolder: plain.relationshipToAccountHolder || '',
    isDependent: Boolean(plain.accountOwnerId) && String(plain.userId || '') !== String(plain.accountOwnerId || ''),
    familyHeadName: plain.familyHeadName || '',
    isCareTeamLinked: Array.isArray(plain.careTeamDoctorIds) && plain.careTeamDoctorIds.length > 0,
    documents: Array.isArray(plain.documents) ? plain.documents : [],
  };
};

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
    return appointmentExistsForDoctorPatient(linkedDoctorId, pid);
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
    return appointmentExistsForDoctorPatient(String(doctor._id), pid);
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
    let normalizedPatients = patients.map(mapPatientForClient);
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
    return res.status(200).json(mapPatientForClient(patient));
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

    const { firstName, lastName, email, birthdate, address, name, documentFileData, documentName, ...rest } =
      cleanedBody;

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

    const patientData = {
      ...rest,
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      email: email || '',
      birthdate: parsedBirthdate,
      address: typeof address === 'string' ? { address1: address } : address,
    };
    if (documentFileData) {
      const uploaded = await uploadToCloudinary(documentFileData, {
        folder: 'drmeet/patients',
        resource_type: 'auto',
      });
      patientData.documents = [
        {
          name: String(documentName || 'Patient attachment'),
          url: uploaded.secure_url,
          uploadedAt: new Date(),
        },
      ];
    }

    if (role === 'patient' && uid) {
      const isDependent = Boolean(patientData.relationshipToAccountHolder);
      if (isDependent) {
        patientData.accountOwnerId = uid;
      } else {
        const existingPrimary = await findPatientsByUserId(uid);
        if (existingPrimary.length) {
          return res.status(400).json({
            error: 'A primary patient profile is already linked to this account.',
          });
        }
        patientData.userId = uid;
        patientData.accountOwnerId = uid;
      }
    } else if (!patientData.userId) {
      delete patientData.userId;
    }

    const newPatient = await createPatientService(patientData);

    return res.status(201).json(newPatient);
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

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
      const docs = Array.isArray(existing?.documents) ? existing.documents : [];
      updates.documents = [
        ...docs,
        {
          name: String(cleanedBody.documentName || 'Patient attachment'),
          url: uploaded.secure_url,
          uploadedAt: new Date(),
        },
      ];
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
    console.log(`[PATIENT]✅ PUT /api/patients/${id} was called`);

    return res.status(200).json(updatedPatient);
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
    const deletedPatient = await deletePatientByIdService(id);
    if (!deletedPatient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }
    console.log(
      `[PATIENT]✅ DELETE /api/patients/${id} - Patient ${deletedPatient._id} successfully deleted`,
    );

    return res.status(200).json({ message: `Patient ${id} deleted.` });
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
    const matches = await findAllPatients().then((rows) =>
      rows.filter((p) =>
        regex.test(`${p.firstName || ''} ${p.lastName || ''}`) ||
        regex.test(String(p.email || '')) ||
        regex.test(String(p.phone || '')),
      ),
    );
    return res.status(200).json(matches.slice(0, 10).map(mapPatientForClient));
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
    return res.status(200).json(mapPatientForClient(patient));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to attach existing patient.' });
  }
};
