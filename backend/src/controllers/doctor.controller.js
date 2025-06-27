import mongoose from 'mongoose';

import {
    findAllDoctors,
    findDoctorById,
    createDoctor as createDoctorService,
    updateDoctorById as updateDoctorByIdService,
    deleteDoctorById as deleteDoctorByIdService,
} from '../services/doctor.service.js';
/**
 * @route GET /api/doctors
 * @desc Fetch all doctors
 */
export const getAllDoctors = async (req, res) => {
    try {
        const doctors = await findAllDoctors();
        console.log('[DOCTOR]✅ GET /api/doctors was called.');
        return res.status(200).json(doctors);
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
        console.log('Invalid doctor ID format');
        return res.status(400).json({ error: 'Invalid doctor ID format' });
    }
    try {
        const doctor = await findDoctorById(id);
        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found.' });
        }
        console.log(`[DOCTOR]✅ GET /api/doctors/${id} was called`);
        return res.status(200).json(doctor);
    } catch (error) {
        console.log(`Error fetching the doctor with ${id}:`, error);
        return res
            .status(500)
            .json({ error: 'An error occured while fetching the doctor.' });
    }
};

/**
 * @route POST /api/doctors
 * @desc Create a new doctor
 */
export const postDoctor = async (req, res) => {
    try {
        const doctorData = req.body;
        const newDoctor = await createDoctorService(doctorData);
        if (!newDoctor) {
            return res.status(400).json({ error: 'Failed to create doctor.' });
        }
        console.log(
            `[DOCTOR]✅ POST /api/doctors - Doctor ${newDoctor._id} created`,
        );
        return res.status(201).json(newDoctor);
    } catch (error) {
        console.error('Error creating the doctor: ', error);
        return res.status(500).json({
            error: error.message || 'An error occured while creating the doctor.',
        });
    }
};

/**
 * @route PUT /api/doctors/:id
 * @desc Update a doctor by ID
 */
export const updateDoctor = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
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
