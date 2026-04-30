import {
  createPrescription,
  listPrescriptions,
  getPrescriptionById,
  updatePrescriptionById,
  deletePrescriptionById,
} from '../services/prescription.service.js';
import Patient from '../models/patient.model.js';
import { findDoctorByUserId } from '../services/doctor.service.js';
import { uploadToCloudinary } from '../services/cloudinary.service.js';

function authRole(req) {
  return String(req.user?.role || '').toLowerCase();
}

function authUserId(req) {
  const id = req.user?._id || req.user?.id;
  return id ? String(id) : null;
}

async function resolveScopedFilters(req) {
  const role = authRole(req);
  const userId = authUserId(req);
  const filters = { ...req.query };

  if (role === 'patient' && userId) {
    const patient = await Patient.findOne({ userId }).lean();
    filters.patientId = patient ? String(patient._id) : '__none__';
  }

  if (role === 'doctor' && userId) {
    const doctor = await findDoctorByUserId(userId);
    filters.doctorId = doctor ? String(doctor._id) : '__none__';
  }
  return filters;
}

export async function postPrescription(req, res) {
  try {
    const role = authRole(req);
    const userId = authUserId(req);
    const body = req.body || {};
    const doctorId =
      role === 'doctor'
        ? String((await findDoctorByUserId(userId))?._id || '')
        : String(body.doctorId || '');

    if (!body.patientId || !doctorId || !body.medication) {
      return res
        .status(400)
        .json({ error: 'patientId, doctorId, and medication are required.' });
    }

    let upload = { secure_url: '', public_id: '' };
    if (body.fileData) {
      upload = await uploadToCloudinary(body.fileData, {
        folder: 'drmeet/prescriptions',
      });
    }

    const created = await createPrescription({
      ...body,
      doctorId,
      secure_url: upload.secure_url,
      public_id: upload.public_id,
      createdBy: userId,
      updatedBy: userId,
    });
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create prescription.' });
  }
}

export async function getPrescriptions(req, res) {
  try {
    const filters = await resolveScopedFilters(req);
    const rows = await listPrescriptions(filters);
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch prescriptions.' });
  }
}

export async function getPrescription(req, res) {
  try {
    const row = await getPrescriptionById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Prescription not found.' });
    return res.status(200).json(row);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch prescription.' });
  }
}

export async function putPrescription(req, res) {
  try {
    let upload = {};
    if (req.body?.fileData) {
      upload = await uploadToCloudinary(req.body.fileData, {
        folder: 'drmeet/prescriptions',
      });
    }
    const updated = await updatePrescriptionById(req.params.id, {
      ...req.body,
      ...upload,
      updatedBy: authUserId(req),
    });
    if (!updated) return res.status(404).json({ error: 'Prescription not found.' });
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update prescription.' });
  }
}

export async function removePrescription(req, res) {
  try {
    const deleted = await deletePrescriptionById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Prescription not found.' });
    return res.status(200).json({ message: 'Prescription deleted.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to delete prescription.' });
  }
}
