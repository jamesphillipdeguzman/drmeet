// doctor.service.js
import mongoose from "mongoose";
import Doctor from "../models/doctor.model.js";

// Get all doctors
export const findAllDoctors = async () =>
  Doctor.find().sort({ specialty: 1, lastName: 1 });

export const findDoctorByUserId = async (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return null;
  return Doctor.findOne({ userId });
};

export const findDoctorsByIds = async (ids) => {
  if (!Array.isArray(ids) || !ids.length) return [];
  const valid = ids.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
  if (!valid.length) return [];
  return Doctor.find({ _id: { $in: valid } });
};

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
