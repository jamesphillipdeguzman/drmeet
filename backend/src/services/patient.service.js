// patient.service.js

import Patient from '../models/patient.model.js';

/** Not soft-deleted (legacy documents without these fields still match). */
export const patientActiveQuery = {
  deletedAt: null,
  isActive: { $ne: false },
};

const withActive = (criteria = {}) => ({ ...criteria, ...patientActiveQuery });

export function isPatientDocActive(doc) {
  if (!doc) return false;
  return !doc.deletedAt && doc.isActive !== false;
}

/** Includes archived rows — use for uniqueness / role sync. */
export const findAnyPatientByUserId = async (userId) =>
  Patient.findOne({ userId });

// Get all active patients
export const findAllPatients = async () => Patient.find(patientActiveQuery);

export const findPatientsByUserId = async (userId) =>
  Patient.find(withActive({ userId }));

export const findPatientsByAccountOwnerId = async (accountOwnerId) =>
  Patient.find(withActive({ accountOwnerId }));

export const findPatientsByIds = async (ids) => {
  if (!Array.isArray(ids) || !ids.length) return [];
  return Patient.find(withActive({ _id: { $in: ids } }));
};

export const findPatientsByDoctorCareTeam = async (doctorId) => {
  if (!doctorId) return [];
  return Patient.find(withActive({ careTeamDoctorIds: doctorId }));
};

export const findPatientById = async (id, { includeInactive = false } = {}) => {
  if (!id) return null;
  if (includeInactive) return Patient.findById(id);
  return Patient.findOne(withActive({ _id: id }));
};

export const createPatient = async (data) => new Patient(data).save();

export const updatePatientById = async (id, updates) =>
  Patient.findOneAndUpdate(withActive({ _id: id }), updates, { new: true });

/** Soft delete: row kept for appointments / audit; User document is not modified here. */
export const softDeletePatientById = async (id) =>
  Patient.findOneAndUpdate(
    withActive({ _id: id }),
    { $set: { deletedAt: new Date(), isActive: false } },
    { new: true },
  );
