import mongoose from 'mongoose';

import {
    findAllAppointments,
    findAppointmentById,
    createAppointment as createAppointmentService,
    updateAppointmentById as updateAppointmentByIdService,
    deleteAppointmentById as deleteAppointmentByIdService,
} from '../services/appointment.service.js';
/**
 * @route GET /api/appointments
 * @desc Fetch all appointments
 */
export const getAllAppointments = async (req, res) => {
    try {
        const appointments = await findAllAppointments();
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
        const appointmentData = req.body;
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
    const updates = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid appointment ID format.' });
    }

    try {
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
