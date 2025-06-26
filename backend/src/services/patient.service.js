// patient.service.js

import Patient from "../models/patient.model.js";

// Get all patients
export const findAllPatients = async () => Patient.find();

// Find a patient by their ID
export const findPatientById = async (id) => Patient.findById(id);

// Create a new patient record
export const createPatient = async (data) => Patient(data).save();

// Update a patient record by ID
export const updatePatientById = async (id, updates) =>
  Patient.findByIdAndUpdate(id, updates, { new: true });

// Delete a patient by ID
export const deletePatientById = async (id) => Patient.findByIdAndDelete(id);
