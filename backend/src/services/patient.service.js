// patient.service.js

import Patient from "../models/patient.model.js";

// Get all patients
export const findAllPatients = async () => Patient.find();

export const findPatientsByUserId = async (userId) => Patient.find({ userId });

export const findPatientsByAccountOwnerId = async (accountOwnerId) =>
  Patient.find({ accountOwnerId });

export const findPatientsByIds = async (ids) => {
  if (!Array.isArray(ids) || !ids.length) return [];
  return Patient.find({ _id: { $in: ids } });
};

// Find a patient by their ID
export const findPatientById = async (id) => Patient.findById(id);

// Create a new patient record
export const createPatient = async (data) => Patient(data).save();

// Update a patient record by ID
export const updatePatientById = async (id, updates) =>
  Patient.findByIdAndUpdate(id, updates, { new: true });

// Delete a patient by ID
export const deletePatientById = async (id) => Patient.findByIdAndDelete(id);
