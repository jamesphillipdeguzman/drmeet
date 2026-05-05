import mongoose from 'mongoose';

import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';
import { patientActiveQuery } from '../services/patient.service.js';

import {
    findAllAppointmentsWithPatientMeta,
    findAppointmentById,
    findAppointmentsByPatient,
    findAppointmentsByDoctorForRoleScope,
    createAppointment as createAppointmentService,
    updateAppointmentById as updateAppointmentByIdService,
    deleteAppointmentById as deleteAppointmentByIdService,
} from '../services/appointment.service.js';
import { findDoctorByUserId } from '../services/doctor.service.js';

function authUserId(req) {
    const id = req.user?._id || req.user?.id;
    return id ? String(id) : null;
}

function authRole(req) {
    return String(req.user?.role || '').toLowerCase();
}

async function getScopedAppointments(req) {
    const role = authRole(req);
    const uid = authUserId(req);

    if (role === 'admin') {
        return findAllAppointmentsWithPatientMeta();
    }

    if (role === 'receptionist') {
        let linkedDoctorId = req.user?.linkedDoctorId;
        if (!linkedDoctorId && uid) {
            const ru = await User.findById(uid).select('linkedDoctorId').lean();
            linkedDoctorId = ru?.linkedDoctorId || null;
        }
        if (!linkedDoctorId) return [];
        return findAppointmentsByDoctorForRoleScope(String(linkedDoctorId));
    }

    if (role === 'patient' && uid) {
        const patient = await Patient.findOne({ userId: uid, ...patientActiveQuery });
        if (!patient) return [];
        return findAppointmentsByPatient(String(patient._id));
    }

    if (role === 'doctor' && uid) {
        const doctor = await findDoctorByUserId(uid);
        if (!doctor) return [];
        return findAppointmentsByDoctorForRoleScope(String(doctor._id));
    }

    return [];
}

async function appointmentVisibleToRequester(req, appt) {
    if (!appt) return false;
    const role = authRole(req);
    const uid = authUserId(req);

    if (role === 'admin') return true;

    if (role === 'receptionist') {
        let linkedDoctorId = req.user?.linkedDoctorId;
        if (!linkedDoctorId && uid) {
            const ru = await User.findById(uid).select('linkedDoctorId').lean();
            linkedDoctorId = ru?.linkedDoctorId || null;
        }
        return Boolean(linkedDoctorId) && String(appt.doctor) === String(linkedDoctorId);
    }

    if (role === 'patient' && uid) {
        const patient = await Patient.findOne({ userId: uid, ...patientActiveQuery });
        return patient && String(appt.patient) === String(patient._id);
    }

    if (role === 'doctor' && uid) {
        const doctor = await findDoctorByUserId(uid);
        return doctor && String(appt.doctor) === String(doctor._id);
    }

    return false;
}

/**
 * @route GET /api/appointments
 * @desc Fetch all appointments
 */
export const getAllAppointments = async (req, res) => {
    try {
        const appointments = await getScopedAppointments(req);
        console.log('[APPOINTMENT]✅ GET /api/appointments was called.');
        return res.status(200).json(appointments);
    } catch (error) {
        console.log('Error fetching appointments: ', error);
        return res
            .status(500)
            .json({ error: 'An error occured while fetching all appointments.' });
    }
};

/**
 * @route GET /api/appointments/:id
 * @desc Fetch an appointment by ID
 */
export const getAppointmentById = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.log('Invalid appointment ID format');
        return res.status(400).json({ error: 'Invalid appointment ID format' });
    }
    try {
        const appointment = await findAppointmentById(id);
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }
        const allowed = await appointmentVisibleToRequester(req, appointment);
        if (!allowed) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        console.log(`[APPOINTMENT]✅ GET /api/appointments/${id} was called`);
        return res.status(200).json(appointment);
    } catch (error) {
        console.log(`Error fetching the appointment with ${id}:`, error);
        return res
            .status(500)
            .json({ error: 'An error occured while fetching the appointment.' });
    }
};

/**
 * @route POST /api/appointments
 * @desc Create a new appointment
 */
export const postAppointment = async (req, res) => {
    try {
        const appointmentData = {
            ...req.body,
            reason: req.body.reason || req.body.notes || '',
        };

        const role = authRole(req);
        const uid = authUserId(req);
        if (role === 'patient' && uid) {
            const patient = await Patient.findOne({ userId: uid, ...patientActiveQuery });
            if (!patient) {
                return res.status(400).json({
                    error: 'Create your patient profile before booking an appointment.',
                });
            }
            appointmentData.patient = String(patient._id);
        }

        const newAppointment = await createAppointmentService(appointmentData);
        if (!newAppointment) {
            return res.status(400).json({ error: 'Failed to create appointment.' });
        }
        console.log(
            `[APPOINTMENT]✅ POST /api/appointments - Appointment ${newAppointment._id} created`,
        );
        return res.status(201).json(newAppointment);
    } catch (error) {
        console.error('Error creating the appointment: ', error);
        return res.status(500).json({
            error: error.message || 'An error occured while creating the appointment.',
        });
    }
};

/**
 * @route PUT /api/appointments/:id
 * @desc Update an appointment by ID
 */
export const updateAppointment = async (req, res) => {
    const { id } = req.params;
    const updates = {
        ...req.body,
        reason: req.body.reason || req.body.notes || undefined,
    };
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid appointment ID format.' });
    }

    try {
        const existing = await findAppointmentById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Appointment not found. ' });
        }
        const canEdit = await appointmentVisibleToRequester(req, existing);
        if (!canEdit) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        const role = authRole(req);
        if (role === 'patient') {
            // Patients can update schedule/status notes for their own appointment,
            // but cannot reassign doctor/patient ownership.
            delete updates.patient;
            delete updates.doctor;
        }

        const updatedAppointment = await updateAppointmentByIdService(id, updates);
        if (!updatedAppointment) {
            return res.status(404).json({ error: 'Appointment not found. ' });
        }
        console.log(`[APPOINTMENT]✅ PUT /api/appointments/${id} was called`);

        return res.status(200).json(updatedAppointment);
    } catch (error) {
        console.log(`Error updating the appointment with ${id}:`, error);
        return res
            .status(500)
            .json({ error: 'An error occured while updating the appointment.' });
    }
};

/**
 * @route DELETE /api/appointments/:id
 * @desc Delete an appointment by ID
 */
export const deleteAppointment = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid appointment ID format.' });
    }
    try {
        const existing = await findAppointmentById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }
        const canDelete = await appointmentVisibleToRequester(req, existing);
        if (!canDelete) {
            return res.status(403).json({ error: 'Forbidden.' });
        }

        const deletedAppointment = await deleteAppointmentByIdService(id);
        if (!deletedAppointment) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }
        console.log(
            `[APPOINTMENT]✅ DELETE /api/appointments/${id} - Appointment ${deletedAppointment._id} successfully deleted`,
        );

        return res.status(200).json({ message: `Appointment ${id} deleted.` });
    } catch (error) {
        return res
            .status(500)
            .json({ error: 'An error occured while deleting the appointment.' });
    }
};
