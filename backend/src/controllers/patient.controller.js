import mongoose from 'mongoose';

import {
  findAllPatients,
  findPatientById,
  createPatient as createPatientService,
  updatePatientById as updatePatientByIdService,
  deletePatientById as deletePatientByIdService,
  findPatientsByUserId,
  findPatientsByIds,
} from '../services/patient.service.js';
import { findDoctorByUserId } from '../services/doctor.service.js';
import User from '../models/user.model.js';
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
    const appts = await findAppointmentsByDoctor(linkedDoctorId);
    const patientIds = [...new Set(appts.map((a) => a.patient).filter(Boolean))]
      .map((id) => String(id))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    return findPatientsByIds(patientIds);
  }

  if (role === 'patient' && uid) {
    return findPatientsByUserId(uid);
  }

  if (role === 'doctor' && uid) {
    const doctor = await findDoctorByUserId(uid);
    if (!doctor) return [];
    const appts = await findAppointmentsByDoctor(String(doctor._id));
    const patientIds = [
      ...new Set(appts.map((a) => a.patient).filter(Boolean)),
    ].filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
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
    return String(patientDoc.userId || '') === uid;
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
    const normalizedPatients = patients.map(mapPatientForClient);
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
    const role = authRole(req);
    const uid = authUserId(req);

    const { firstName, lastName, email, birthdate, address, name, ...rest } =
      req.body;

    let resolvedFirstName = firstName;
    let resolvedLastName = lastName;

    if (!resolvedFirstName && !resolvedLastName && name) {
      const parts = name.trim().split(' ');
      resolvedFirstName = parts[0];
      resolvedLastName = parts.slice(1).join(' ') || '';
    }

    if (!resolvedFirstName || !resolvedLastName || !email) {
      return res.status(400).json({
        error: 'firstName, lastName, and email are required',
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
      email,
      birthdate: parsedBirthdate,
      address: typeof address === 'string' ? { address1: address } : address,
    };

    if (role === 'patient' && uid) {
      const existing = await findPatientsByUserId(uid);
      if (existing.length) {
        return res.status(400).json({
          error: 'A patient profile is already linked to this account.',
        });
      }
      patientData.userId = uid;
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
  const updates = {
    ...req.body,
    birthdate: req.body.birthdate || req.body.birthdate || undefined,
    address:
      typeof req.body.address === 'string'
        ? { address1: req.body.address }
        : req.body.address,
  };
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    const existing = await findPatientById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Patient not found. ' });
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
