import mongoose from 'mongoose';

import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';
import Doctor from '../models/doctor.model.js';
import Appointment from '../models/appointment.model.js';
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

function normalizeDayStart(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function normalizeDayEnd(value) {
    const d = normalizeDayStart(value);
    if (!d) return null;
    d.setHours(23, 59, 59, 999);
    return d;
}

function toMinutes(timeText) {
    const m = String(timeText || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
}

function minutesToText(total) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildSuggestedTimes(usedTimes = [], max = 8) {
    const used = new Set(
        usedTimes
            .map((t) => toMinutes(t))
            .filter((v) => typeof v === 'number'),
    );
    const suggestions = [];
    for (let mins = 8 * 60; mins <= 18 * 60; mins += 30) {
        if (used.has(mins)) continue;
        suggestions.push(minutesToText(mins));
        if (suggestions.length >= max) break;
    }
    return suggestions;
}

async function resolveDoctorBookingPolicyOwner(req, requestedDoctorId = '') {
    const role = authRole(req);
    const uid = authUserId(req);
    if (!uid) return null;

    if (role === 'doctor') {
        const mine = await findDoctorByUserId(uid);
        if (!mine) return null;
        if (
            requestedDoctorId &&
            mongoose.Types.ObjectId.isValid(requestedDoctorId) &&
            String(mine._id) !== String(requestedDoctorId)
        ) {
            return null;
        }
        return mine;
    }
    if (role === 'receptionist') {
        let linkedDoctorId = req.user?.linkedDoctorId;
        if (!linkedDoctorId) {
            const ru = await User.findById(uid).select('linkedDoctorId').lean();
            linkedDoctorId = ru?.linkedDoctorId || null;
        }
        if (!linkedDoctorId) return null;
        if (
            requestedDoctorId &&
            mongoose.Types.ObjectId.isValid(requestedDoctorId) &&
            String(linkedDoctorId) !== String(requestedDoctorId)
        ) {
            return null;
        }
        return Doctor.findById(String(linkedDoctorId));
    }
    if (role === 'admin' && requestedDoctorId && mongoose.Types.ObjectId.isValid(requestedDoctorId)) {
        return Doctor.findById(String(requestedDoctorId));
    }
    return null;
}

async function getDoctorDailyBookingLimit(doctorId) {
    if (!doctorId || !mongoose.Types.ObjectId.isValid(String(doctorId))) return 10;
    const doctor = await Doctor.findById(String(doctorId)).select('bookingPolicy').lean();
    const max = Number(doctor?.bookingPolicy?.maxPatientsPerDay);
    if (!Number.isFinite(max) || max < 1) return 10;
    return Math.floor(max);
}

async function getDoctorBookingsForDay({ doctorId, date, excludeAppointmentId = '' }) {
    const dayStart = normalizeDayStart(date);
    const dayEnd = normalizeDayEnd(date);
    if (!dayStart || !dayEnd) return [];
    const query = {
        doctor: String(doctorId || ''),
        date: { $gte: dayStart, $lte: dayEnd },
        status: { $ne: 'cancelled' },
    };
    if (excludeAppointmentId && mongoose.Types.ObjectId.isValid(excludeAppointmentId)) {
        query._id = { $ne: new mongoose.Types.ObjectId(excludeAppointmentId) };
    }
    return Appointment.find(query).select('_id time patient status').lean();
}

async function assertSmartBookingOrThrow({ doctorId, date, time, excludeAppointmentId = '' }) {
    if (!doctorId || !date || !time) return;
    const maxPatientsPerDay = await getDoctorDailyBookingLimit(doctorId);
    const existing = await getDoctorBookingsForDay({
        doctorId,
        date,
        excludeAppointmentId,
    });
    const bookedCount = existing.length;
    if (bookedCount >= maxPatientsPerDay) {
        const err = new Error(
            `Daily booking limit reached for this doctor (${bookedCount}/${maxPatientsPerDay}). Please choose another day or doctor.`,
        );
        err.statusCode = 409;
        throw err;
    }
    const conflict = existing.find((a) => String(a.time || '') === String(time || ''));
    if (conflict) {
        const err = new Error(
            `Selected time ${time} is already booked for this doctor. Please choose another available time.`,
        );
        err.statusCode = 409;
        throw err;
    }
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
 * @route GET /api/appointments/booking-hints?doctorId=&date=&excludeAppointmentId=
 * @desc Smart booking hints for patient scheduler.
 */
export const getBookingHints = async (req, res) => {
    try {
        const role = authRole(req);
        if (!['patient', 'doctor', 'receptionist', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        const doctorId = String(req.query.doctorId || '').trim();
        const date = String(req.query.date || '').trim();
        const excludeAppointmentId = String(req.query.excludeAppointmentId || '').trim();
        if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
            return res.status(400).json({ error: 'Valid doctorId is required.' });
        }
        const dayStart = normalizeDayStart(date);
        if (!dayStart) {
            return res.status(400).json({ error: 'Valid date is required.' });
        }

        const maxPatientsPerDay = await getDoctorDailyBookingLimit(doctorId);
        const existing = await getDoctorBookingsForDay({
            doctorId,
            date,
            excludeAppointmentId,
        });
        const conflictingTimes = [
            ...new Set(existing.map((a) => String(a.time || '').trim()).filter(Boolean)),
        ].sort((a, b) => (toMinutes(a) || 0) - (toMinutes(b) || 0));
        const bookedCount = existing.length;
        const remainingSlots = Math.max(maxPatientsPerDay - bookedCount, 0);
        const suggestedAvailableTimes = buildSuggestedTimes(conflictingTimes, 10);

        return res.status(200).json({
            doctorId,
            date: dayStart.toISOString(),
            maxPatientsPerDay,
            bookedCount,
            remainingSlots,
            conflictingTimes,
            suggestedAvailableTimes,
            hint: `Booked ${bookedCount}/${maxPatientsPerDay}. ${remainingSlots > 0 ? `${remainingSlots} slot(s) left.` : 'No slots left for this day.'}`,
        });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to load booking hints.' });
    }
};

/**
 * @route PATCH /api/appointments/booking-policy
 * @desc Staff-managed max booking limit per doctor/day.
 */
export const patchBookingPolicy = async (req, res) => {
    try {
        const role = authRole(req);
        if (!['doctor', 'receptionist', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        const requestedDoctorId = String(req.body?.doctorId || '').trim();
        const doctor = await resolveDoctorBookingPolicyOwner(req, requestedDoctorId);
        if (!doctor) return res.status(403).json({ error: 'Forbidden.' });

        const raw = Number(req.body?.maxPatientsPerDay);
        const maxPatientsPerDay = Math.floor(raw);
        if (!Number.isFinite(maxPatientsPerDay) || maxPatientsPerDay < 1 || maxPatientsPerDay > 200) {
            return res.status(400).json({
                error: 'maxPatientsPerDay must be a number between 1 and 200.',
            });
        }

        const updated = await Doctor.findByIdAndUpdate(
            doctor._id,
            { $set: { 'bookingPolicy.maxPatientsPerDay': maxPatientsPerDay } },
            { new: true },
        ).select('bookingPolicy');
        return res.status(200).json({
            bookingPolicy: updated?.bookingPolicy || { maxPatientsPerDay },
        });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update booking policy.' });
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
        if (String(appointmentData.status || 'pending').toLowerCase() !== 'cancelled') {
            await assertSmartBookingOrThrow({
                doctorId: appointmentData.doctor,
                date: appointmentData.date,
                time: appointmentData.time,
            });
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
        return res.status(error.statusCode || 500).json({
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
            // Patients can now reassign doctor for their own booking; keep patient ownership fixed.
            delete updates.patient;
        }
        if (String(updates.status || existing.status || 'pending').toLowerCase() !== 'cancelled') {
            await assertSmartBookingOrThrow({
                doctorId: updates.doctor || existing.doctor,
                date: updates.date || existing.date,
                time: updates.time || existing.time,
                excludeAppointmentId: id,
            });
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
            .status(error.statusCode || 500)
            .json({ error: error.message || 'An error occured while updating the appointment.' });
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
