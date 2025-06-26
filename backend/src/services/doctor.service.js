// doctor.service.js
import Doctor from "../models/doctor.model.js";

// Get all doctors
export const findAllDoctors = async () => Doctor.find();

// Find a doctor by their ID
export const findDoctorById = async (id) => Doctor.findById(id);

// Create a new doctor profile
export const createDoctor = async (data) => new Doctor(data).save();

// Update a doctor's profile by ID
export const updateDoctorById = async (id, updates) =>
  Doctor.findByIdAndUpdate(id, updates, { new: true });

// Delete a doctor profile by ID
export const deleteDoctorById = async (id) => Doctor.findByIdAndDelete(id);

// Find doctors by their medical specialty
export const findDoctorsBySpecialty = async (specialty) =>
  Doctor.find({ specialty });
