import mongoose from 'mongoose';

import Patient from '../models/patient.model.js';
import Conversation from '../models/conversation.model.js';

import {
    findAllDoctors,
    findDoctorById,
    findDoctorByUserId,
    findDoctorsByIds,
    createDoctor as createDoctorService,
    updateDoctorById as updateDoctorByIdService,
    deleteDoctorById as deleteDoctorByIdService,
} from '../services/doctor.service.js';
import { findAppointmentsByPatient } from '../services/appointment.service.js';

function authUserId(req) {
    const id = req.user?._id || req.user?.id;
    return id ? String(id) : null;
}

function authRole(req) {
    return String(req.user?.role || '').toLowerCase();
}

/**
 * Patient-visible doctor Mongo _ids: from appointments and patient–doctor chats.
 */
async function collectDoctorMongoIdsForPatientUser(uid) {
    const ids = new Set();
    const patient = await Patient.findOne({ userId: uid });
    if (patient) {
        const appts = await findAppointmentsByPatient(String(patient._id));
        appts.forEach((a) => {
            if (a.doctor) ids.add(String(a.doctor));
        });
    }

    const convs = await Conversation.find({
        participants: uid,
        conversationType: 'patient-doctor',
    }).populate('participants', 'role');

    for (const c of convs) {
        const parts = Array.isArray(c.participants) ? c.participants : [];
        for (const p of parts) {
            if (String(p._id) === String(uid)) continue;
            if (String(p.role || '').toLowerCase() !== 'doctor') continue;
            const doc = await findDoctorByUserId(p._id);
            if (doc?._id) ids.add(String(doc._id));
        }
    }

    return [...ids].filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
}

async function getScopedDoctors(req) {
    const role = authRole(req);
    const uid = authUserId(req);

    if (role === 'admin' || role === 'receptionist') {
        return findAllDoctors();
    }

    if (role === 'doctor' && uid) {
        const doc = await findDoctorByUserId(uid);
        return doc ? [doc] : [];
    }

    if (role === 'patient' && uid) {
        const doctorIds = await collectDoctorMongoIdsForPatientUser(uid);
        return findDoctorsByIds(doctorIds);
    }

    return [];
}

async function doctorVisibleToRequester(req, doctorDoc) {
    if (!doctorDoc) return false;
    const role = authRole(req);
    const uid = authUserId(req);
    const did = String(doctorDoc._id);

    if (role === 'admin' || role === 'receptionist') return true;

    if (role === 'doctor' && uid) {
        const mine = await findDoctorByUserId(uid);
        return mine && String(mine._id) === did;
    }

    if (role === 'patient' && uid) {
        const allowed = await collectDoctorMongoIdsForPatientUser(uid);
        return allowed.includes(did);
    }

    return false;
}
/**
 * @route GET /api/doctors
 * @desc Fetch all doctors
 */
export const getAllDoctors = async (req, res) => {
    try {
        const doctors = await getScopedDoctors(req);
        const normalizedDoctors = doctors.map((doctor) => {
            const plain = doctor.toObject ? doctor.toObject() : doctor;
            const firstSlot = Array.isArray(plain.availability)
                ? plain.availability[0]
                : null;
            return {
                ...plain,
                specialty: plain.specialty || '',
                affiliatedClinics:
                    plain.affiliatedClinics ||
                    firstSlot?.location?.clinicName ||
                    '',
            };
        });
        console.log('[DOCTOR]✅ GET /api/doctors was called.');
        return res.status(200).json(normalizedDoctors);
    } catch (error) {
        console.log('Error fetching doctors: ', error);
        return res
            .status(500)
            .json({ error: 'An error occured while fetching all doctors.' });
    }
};

/**
 * @route GET /api/doctors/:id
 * @desc Fetch a doctor by ID
 */
export const getDoctorById = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid doctor ID format' });
    }

    try {
        const doctor = await findDoctorById(id);

        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found.' });
        }

        const allowed = await doctorVisibleToRequester(req, doctor);
        if (!allowed) {
            return res.status(403).json({ error: 'Forbidden.' });
        }

        const plainDoctor = doctor.toObject?.() || doctor;

        console.log(`[DOCTOR] GET /api/doctors/${id}`);

        return res.status(200).json(plainDoctor);
    } catch (error) {
        console.error(`Error fetching doctor ${id}:`, error);

        return res.status(500).json({
            error: 'Error fetching doctor',
        });
    }
};

/**
 * @route POST /api/doctors
 * @desc Create a new doctor
 */
export const postDoctor = async (req, res) => {
    try {
        const body = req.body;

        // ✅ normalize fields
        const doctorData = {
            ...body,
            firstName: body.firstName?.trim(),
            lastName: body.lastName?.trim(),
            email: body.email?.trim(),
            specialty: body.specialty,
        };

        if (!doctorData.userId) {
            delete doctorData.userId;
        }

        // ✅ manual validation (IMPORTANT for debugging)
        const missingFields = [];

        if (!doctorData.firstName) missingFields.push("firstName");
        if (!doctorData.lastName) missingFields.push("lastName");
        if (!doctorData.email) missingFields.push("email");
        if (!doctorData.specialty) missingFields.push("specialty");

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: "Missing required fields",
                missingFields,
            });
        }

        const newDoctor = await createDoctorService(doctorData);

        console.log(`[DOCTOR] CREATED: ${newDoctor._id}`);

        return res.status(201).json(newDoctor);
    } catch (error) {
        console.error("Doctor creation failed:", error);

        // ✅ expose mongoose validation errors clearly
        if (error.name === "ValidationError") {
            return res.status(400).json({
                error: "Validation failed",
                details: Object.keys(error.errors).map(
                    (key) => error.errors[key].message
                ),
            });
        }

        return res.status(500).json({
            error: error.message || "Server error while creating doctor",
        });
    }
};

/**
 * @route PUT /api/doctors/:id
 * @desc Update a doctor by ID
 */
export const updateDoctor = async (req, res) => {
    const { id } = req.params;
    const updates = {
        ...req.body,
        specialty: req.body.specialty,
    };
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid doctor ID format.' });
    }

    try {
        const updatedDoctor = await updateDoctorByIdService(id, updates);
        if (!updatedDoctor) {
            return res.status(404).json({ error: 'Doctor not found. ' });
        }
        console.log(`[DOCTOR]✅ PUT /api/doctors/${id} was called`);

        return res.status(200).json(updatedDoctor);
    } catch (error) {
        console.log(`Error updating the doctor with ${id}:`, error);
        return res
            .status(500)
            .json({ error: 'An error occured while updating the doctor.' });
    }
};

/**
 * @route DELETE /api/doctors/:id
 * @desc Delete a doctor by ID
 */
export const deleteDoctor = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid doctor ID format.' });
    }
    try {
        const deletedDoctor = await deleteDoctorByIdService(id);
        if (!deletedDoctor) {
            return res.status(404).json({ error: 'Doctor not found.' });
        }
        console.log(
            `[DOCTOR]✅ DELETE /api/doctors/${id} - Doctor ${deletedDoctor._id} successfully deleted`,
        );

        return res.status(200).json({ message: `Doctor ${id} deleted.` });
    } catch (error) {
        return res
            .status(500)
            .json({ error: 'An error occured while deleting the doctor.' });
    }
};
