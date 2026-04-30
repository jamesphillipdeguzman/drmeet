import Patient from '../models/patient.model.js';
import { uploadToCloudinary } from '../services/cloudinary.service.js';

function authRole(req) {
  return String(req.user?.role || '').toLowerCase();
}

function authUserId(req) {
  const id = req.user?._id || req.user?.id;
  return id ? String(id) : null;
}

function serializeHistoryEntry(entry) {
  return JSON.stringify({
    secure_url: entry.secure_url,
    public_id: entry.public_id,
    uploadedAt: new Date().toISOString(),
  });
}

function parseHistoryEntry(value) {
  try {
    const parsed = JSON.parse(value);
    return {
      secure_url: parsed.secure_url || '',
      public_id: parsed.public_id || '',
      uploadedAt: parsed.uploadedAt || null,
    };
  } catch {
    return { secure_url: String(value || ''), public_id: '', uploadedAt: null };
  }
}

async function resolvePatientForRequest(req, requestedPatientId = '') {
  const role = authRole(req);
  const userId = authUserId(req);

  if (role === 'patient') {
    return Patient.findOne({ userId });
  }

  if (requestedPatientId) {
    return Patient.findById(requestedPatientId);
  }

  return null;
}

export async function uploadMedicalHistory(req, res) {
  try {
    const { patientId, fileData } = req.body || {};
    if (!fileData) {
      return res.status(400).json({ error: 'fileData is required.' });
    }

    const patient = await resolvePatientForRequest(req, patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const uploaded = await uploadToCloudinary(fileData, {
      folder: 'drmeet/medical-history',
    });
    const historyEntry = serializeHistoryEntry(uploaded);
    const nextHistory = Array.isArray(patient.medicalHistory)
      ? [...patient.medicalHistory, historyEntry]
      : [historyEntry];

    patient.medicalHistory = nextHistory;
    await patient.save();

    return res.status(201).json({
      patientId: String(patient._id),
      file: uploaded,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: error.message || 'Failed to upload medical history.' });
  }
}

export async function getMedicalHistory(req, res) {
  try {
    const role = authRole(req);
    const requestedPatientId = String(req.query.patientId || '');

    if (role === 'patient') {
      const patient = await resolvePatientForRequest(req);
      if (!patient) return res.status(404).json({ error: 'Patient not found.' });
      return res.status(200).json({
        patientId: String(patient._id),
        medicalHistory: (patient.medicalHistory || []).map(parseHistoryEntry),
      });
    }

    if (requestedPatientId) {
      const patient = await Patient.findById(requestedPatientId).lean();
      if (!patient) return res.status(404).json({ error: 'Patient not found.' });
      return res.status(200).json({
        patientId: String(patient._id),
        medicalHistory: (patient.medicalHistory || []).map(parseHistoryEntry),
      });
    }

    const patients = await Patient.find().lean();
    const rows = patients.map((p) => ({
      patientId: String(p._id),
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      medicalHistory: (p.medicalHistory || []).map(parseHistoryEntry),
    }));
    return res.status(200).json(rows);
  } catch (error) {
    return res
      .status(500)
      .json({ error: error.message || 'Failed to fetch medical history.' });
  }
}
