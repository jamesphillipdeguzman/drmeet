// appointment.service.js
import Appointment from "../models/appointment.model.js";

// Get all appointments with doctor and patient details populated
export const findAllAppointments = async () =>
  Appointment.find().populate("doctor patient");

// Get a single appointment by ID with doctor and patient populated
export const findAppointmentById = async (id) =>
  Appointment.findById(id).populate("doctor patient");

// Create a new appointment
export const createAppointment = async (data) => new Appointment(data).save();

// Update an existing appointment by ID
export const updateAppointmentById = async (id, updates) =>
  Appointment.findByIdAndUpdate(id, updates, { new: true });

// Delete an appointment by ID
export const deleteAppointmentById = async (id) =>
  Appointment.findByIdAndDelete(id);

// Find all appointments by a specific doctor
export const findAppointmentsByDoctor = async (doctorId) =>
  Appointment.find({ doctor: doctorId });

// Find all appointments by a specific patient
export const findAppointmentsByPatient = async (patientId) =>
  Appointment.find({ patient: patientId });
