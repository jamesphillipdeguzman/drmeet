import mongoose from 'mongoose';

import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';
import Doctor from '../models/doctor.model.js';
import Appointment from '../models/appointment.model.js';
import { patientActiveQuery } from '../services/patient.service.js';
import { assertStarterPlanPatientLimit } from '../utils/planLimit.js';

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

const WEEKDAYS = {
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
    sun: 0, sunday: 0,
};

function getDayIndex(str) {
    if (!str) return null;
    const clean = String(str).trim().toLowerCase().replace(/[^a-z]/g, '');
    return WEEKDAYS[clean] !== undefined ? WEEKDAYS[clean] : null;
}

function getTargetDayIndex(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).trim().split('T')[0].split('-');
    if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const d = Number(parts[2]);
        if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
            const dt = new Date(y, m, d);
            return dt.getDay();
        }
    }
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d.getDay();
}

function doesDayMatch(ruleDayText, targetDayIndex) {
    if (targetDayIndex === null || targetDayIndex === undefined) return true;
    if (!ruleDayText) return true;

    const raw = String(ruleDayText).trim().toLowerCase();
    if (raw.includes('daily') || raw.includes('everyday') || raw.includes('all')) return true;

    const rangeParts = raw.split(/\s*(?:-|to)\s*/);
    if (rangeParts.length === 2) {
        const startIdx = getDayIndex(rangeParts[0]);
        const endIdx = getDayIndex(rangeParts[1]);
        if (startIdx !== null && endIdx !== null) {
            if (startIdx <= endIdx) {
                return targetDayIndex >= startIdx && targetDayIndex <= endIdx;
            } else {
                return targetDayIndex >= startIdx || targetDayIndex <= endIdx;
            }
        }
    }

    const tokens = raw.split(/[,&/]/).map((t) => t.trim());
    for (const token of tokens) {
        const idx = getDayIndex(token);
        if (idx !== null && idx === targetDayIndex) return true;
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const name = dayNames[targetDayIndex];
        if (token.includes(name) || name.includes(token)) return true;
    }

    return false;
}

function parseAvailabilityLines(rawText) {
    if (!rawText) return [];
    return String(rawText)
        .split(/(?:[|\n;]|,\s*(?=(?:mon|tue|wed|thu|fri|sat|sun|daily|everyday)))/i)
        .map((b) => b.trim())
        .filter(Boolean);
}

function toMinutesWithContext(timeText, referenceStartMins = null) {
    if (!timeText) return null;
    let str = String(timeText).trim().toLowerCase().replace(/[:\s]+$/, '');

    const ampmMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (ampmMatch) {
        let h = Number(ampmMatch[1]);
        const mm = ampmMatch[2] ? Number(ampmMatch[2]) : 0;
        const period = ampmMatch[3];
        if (h < 1 || h > 12 || mm < 0 || mm > 59) return null;
        if (period === 'pm' && h < 12) h += 12;
        if (period === 'am' && h === 12) h = 0;
        return h * 60 + mm;
    }

    const m = str.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (m) {
        let h = Number(m[1]);
        const mm = m[2] ? Number(m[2]) : 0;
        if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;

        let mins = h * 60 + mm;

        if (referenceStartMins !== null && mins <= referenceStartMins && h < 12) {
            mins += 12 * 60;
        } else if (referenceStartMins === null && h >= 1 && h <= 6) {
            mins += 12 * 60;
        }

        return mins;
    }
    return null;
}

function toMinutes(timeText) {
    return toMinutesWithContext(timeText);
}

function minutesToText(total) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function resolveDoctorDayWindows(doctor, dateStr) {
    if (!doctor) return { windows: [], isOffDay: false, hasRules: false };
    const slots = Array.isArray(doctor.availability) ? doctor.availability : [];
    let textRules = String(doctor.availabilityRules || doctor.availabilityText || '').trim();

    const hasAnyRules = slots.length > 0 || Boolean(textRules);
    if (!hasAnyRules) {
        return {
            windows: [{ startMins: 8 * 60, endMins: 12 * 60 }],
            isOffDay: false,
            hasRules: false,
        };
    }

    const targetDayIdx = getTargetDayIndex(dateStr);
    const matchedWindows = [];

    for (const slot of slots) {
        if (!slot) continue;
        const slotDay = String(slot.day || '');
        if (targetDayIdx !== null && !doesDayMatch(slotDay, targetDayIdx)) {
            continue;
        }
        let sMins = null;
        let eMins = null;
        if (slot.startTime && slot.endTime) {
            sMins = toMinutesWithContext(slot.startTime);
            eMins = toMinutesWithContext(slot.endTime, sMins);
        } else if (slot.timeRange) {
            const parts = slot.timeRange.split(/(?:-|\bto\b)/i).map((p) => p.trim());
            if (parts.length === 2) {
                sMins = toMinutesWithContext(parts[0]);
                eMins = toMinutesWithContext(parts[1], sMins);
            }
        }
        if (typeof sMins === 'number' && typeof eMins === 'number' && eMins > sMins) {
            matchedWindows.push({ startMins: sMins, endMins: eMins });
        }
    }

    if (textRules) {
        const blocks = parseAvailabilityLines(textRules);
        for (const block of blocks) {
            const m = block.match(/^(.+?)\s+((?:\d{1,2}(?::\d{2})?:?\s*(?:am|pm)?))\s*(?:-|:|to)\s*((?:\d{1,2}(?::\d{2})?:?\s*(?:am|pm)?))$/i);
            if (m) {
                const lineDayText = m[1].trim();
                if (targetDayIdx !== null && !doesDayMatch(lineDayText, targetDayIdx)) {
                    continue;
                }
                const sMins = toMinutesWithContext(m[2]);
                const eMins = toMinutesWithContext(m[3], sMins);
                if (typeof sMins === 'number' && typeof eMins === 'number' && eMins > sMins) {
                    matchedWindows.push({ startMins: sMins, endMins: eMins });
                }
            }
        }
    }

    if (matchedWindows.length > 0) {
        return { windows: matchedWindows, isOffDay: false, hasRules: true };
    }

    return { windows: [], isOffDay: true, hasRules: true };
}

function resolveDoctorDayWindow(doctor, dateStr) {
    const res = resolveDoctorDayWindows(doctor, dateStr);
    if (res.isOffDay) return { startMins: null, endMins: null, isOffDay: true };
    if (res.windows.length > 0) return { ...res.windows[0], isOffDay: false };
    return { startMins: 8 * 60, endMins: 12 * 60, isOffDay: false };
}

function buildSuggestedTimes(usedTimes = [], max = 20, doctor = null, dateStr = '') {
    const used = new Set(
        usedTimes
            .map((t) => toMinutesWithContext(t))
            .filter((v) => typeof v === 'number'),
    );

    let windows = [{ startMins: 8 * 60, endMins: 12 * 60 }];
    const slotDuration = 30;

    if (doctor) {
        const res = resolveDoctorDayWindows(doctor, dateStr);
        if (res.isOffDay) {
            return [];
        }
        if (res.windows && res.windows.length > 0) {
            windows = res.windows;
        }
    }

    const suggestions = [];
    const addedMins = new Set();

    for (const win of windows) {
        for (let mins = win.startMins; mins + slotDuration <= win.endMins; mins += slotDuration) {
            if (used.has(mins) || addedMins.has(mins)) continue;
            addedMins.add(mins);
            suggestions.push(minutesToText(mins));
            if (suggestions.length >= max) break;
        }
        if (suggestions.length >= max) break;
    }

    return suggestions.sort((a, b) => (toMinutesWithContext(a) || 0) - (toMinutesWithContext(b) || 0));
}

function buildAllDoctorOperatingSlots(doctor = null, dateStr = '') {
    if (!doctor) return { slots: [], isOffDay: false };
    const res = resolveDoctorDayWindows(doctor, dateStr);
    if (res.isOffDay) return { slots: [], isOffDay: true };
    const windows = res.windows && res.windows.length > 0 ? res.windows : [{ startMins: 8 * 60, endMins: 12 * 60 }];
    const slots = [];
    const added = new Set();
    const slotDuration = 30;
    for (const win of windows) {
        for (let mins = win.startMins; mins + slotDuration <= win.endMins; mins += slotDuration) {
            if (added.has(mins)) continue;
            added.add(mins);
            slots.push(minutesToText(mins));
        }
    }
    slots.sort((a, b) => (toMinutesWithContext(a) || 0) - (toMinutesWithContext(b) || 0));
    return { slots, isOffDay: false };
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

async function assertSmartBookingOrThrow({ doctorId, date, time, excludeAppointmentId = '', isRescheduling = false }) {
    if (!doctorId || !date || !time) return;

    if (!excludeAppointmentId || isRescheduling) {
        const d = new Date(date);
        const m = String(time).trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!Number.isNaN(d.getTime()) && m) {
            const apptDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(m[1]), Number(m[2]));
            if (apptDate < new Date()) {
                const err = new Error('Cannot book appointments in the past.');
                err.statusCode = 400;
                throw err;
            }
        }
    }

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
        if (!['patient', 'doctor', 'nurse', 'receptionist', 'hospital_admin', 'admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        const doctorId = String(req.query.doctorId || '').trim();
        const date = String(req.query.date || '').trim();
        const excludeAppointmentId = String(req.query.excludeAppointmentId || '').trim();

        const dayStart = date ? normalizeDayStart(date) : null;
        if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId) || !date || !dayStart) {
            return res.status(200).json({
                doctorId: doctorId || '',
                date: date || '',
                maxPatientsPerDay: 10,
                bookedCount: 0,
                remainingSlots: 10,
                availableSlotsCount: 0,
                conflictingTimes: [],
                suggestedAvailableTimes: [],
                hint: 'Select a valid doctor and date to view availability.',
            });
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
        const doctor = await Doctor.findById(doctorId).lean();
        const opRes = buildAllDoctorOperatingSlots(doctor, date);
        const operatingSlots = opRes.slots;
        const isOffDay = opRes.isOffDay;
        let suggestedAvailableTimes = buildSuggestedTimes(conflictingTimes, 20, doctor, date);

        const now = new Date();
        const isToday = dayStart.getFullYear() === now.getFullYear() &&
                        dayStart.getMonth() === now.getMonth() &&
                        dayStart.getDate() === now.getDate();
        if (isToday) {
            const currentMins = now.getHours() * 60 + now.getMinutes();
            suggestedAvailableTimes = suggestedAvailableTimes.filter((t) => {
                const tm = toMinutes(t);
                return typeof tm === 'number' && tm >= currentMins;
            });
        }

        const availableSlotsCount = suggestedAvailableTimes.length;
        const remainingSlots = Math.min(
            Math.max(maxPatientsPerDay - bookedCount, 0),
            availableSlotsCount
        );

        return res.status(200).json({
            doctorId,
            date: dayStart.toISOString(),
            maxPatientsPerDay,
            bookedCount,
            remainingSlots,
            availableSlotsCount,
            conflictingTimes,
            suggestedAvailableTimes,
            operatingSlots,
            isOffDay,
            hint: `Booked ${bookedCount}/${maxPatientsPerDay}. ${remainingSlots > 0 ? `${remainingSlots} slot(s) left.` : 'No slots left for this day.'}`,
        });
    } catch (error) {
        console.error('[APPOINTMENT] Error in getBookingHints:', error);
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

        if (appointmentData.doctor && appointmentData.patient) {
            const patientObj = await Patient.findById(appointmentData.patient).select('careTeamDoctorIds').lean();
            const existingCareTeam = Array.isArray(patientObj?.careTeamDoctorIds)
                ? patientObj.careTeamDoctorIds.map(String)
                : [];
            const isAlreadyLinked = existingCareTeam.includes(String(appointmentData.doctor));
            await assertStarterPlanPatientLimit({
                doctorId: appointmentData.doctor,
                req,
                isNewPatientForDoctor: !isAlreadyLinked,
            });
            if (!isAlreadyLinked && patientObj) {
                await Patient.findByIdAndUpdate(appointmentData.patient, {
                    $addToSet: { careTeamDoctorIds: appointmentData.doctor },
                });
            }
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
    const rawDoctor = typeof req.body.doctor === 'object' ? (req.body.doctor?._id || req.body.doctor?.id) : req.body.doctor;
    const rawPatient = typeof req.body.patient === 'object' ? (req.body.patient?._id || req.body.patient?.id) : req.body.patient;
    const updates = {
        ...req.body,
        reason: req.body.reason || req.body.notes || undefined,
    };
    if (rawDoctor) updates.doctor = String(rawDoctor).trim();
    if (rawPatient) updates.patient = String(rawPatient).trim();

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

        const targetDoctor = updates.doctor || String(existing.doctor || '');
        const targetDate = updates.date || existing.date;
        const targetTime = updates.time || existing.time;

        const formatDateStr = (val) => {
            if (!val) return '';
            const d = new Date(val);
            return Number.isNaN(d.getTime()) ? String(val) : d.toISOString().slice(0, 10);
        };

        const isRescheduling = Boolean(
            (updates.date && formatDateStr(updates.date) !== formatDateStr(existing.date)) ||
            (updates.time && String(updates.time).trim() !== String(existing.time || '').trim())
        );

        if (String(updates.status || existing.status || 'pending').toLowerCase() !== 'cancelled') {
            await assertSmartBookingOrThrow({
                doctorId: targetDoctor,
                date: targetDate,
                time: targetTime,
                excludeAppointmentId: id,
                isRescheduling,
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
