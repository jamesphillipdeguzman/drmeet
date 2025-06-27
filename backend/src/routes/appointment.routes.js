import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';
import {
  getAllAppointments,
  getAppointmentById,
  postAppointment,
  updateAppointment,
  deleteAppointment,
} from '../controllers/appointment.controller.js';
import { validateAppointment } from '../middlewares/appointment.validation.middleware.js';
import { validateMongoIdParam } from '../middlewares/common.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/appointments:
 *  get:
 *    summary: Get all appointments
 *    tags:
 *      - Appointments
 *    responses:
 *      200:
 *        description: A list of all appointments
 *      500:
 *        description: An error occurred while fetching appointments
 */
router.get('/', hybridAuth, getAllAppointments);

/**
 * @swagger
 * /api/appointments/{id}:
 *  get:
 *    summary: Get an appointment by ID
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: The unique ID of the appointment
 *    tags:
 *      - Appointments
 *    responses:
 *      200:
 *        description: The appointment with the specified ID
 *      400:
 *        description: Invalid appointment ID format
 *      404:
 *        description: Appointment not found
 *      500:
 *        description: An error occurred while fetching the appointment
 */
router.get('/:id', hybridAuth, validateMongoIdParam, getAppointmentById);

/**
 * @swagger
 * /api/appointments:
 *  post:
 *    summary: Create a new appointment
 *    tags:
 *      - Appointments
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - doctor
 *              - patient
 *              - date
 *              - time
 *            properties:
 *              doctor:
 *                type: string
 *              patient:
 *                type: string
 *              date:
 *                type: string
 *                format: date
 *              time:
 *                type: string
 *              notes:
 *                type: string
 *              status:
 *                type: string
 *                enum: [pending, confirmed, cancelled, completed]
 *    responses:
 *      201:
 *        description: A new appointment created
 *      400:
 *        description: Failed to create appointment
 *      500:
 *        description: An error occurred while creating the appointment
 */
router.post('/', hybridAuth, validateAppointment, postAppointment);

/**
 * @swagger
 * /api/appointments/{id}:
 *  put:
 *    summary: Update an appointment by ID
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: The unique ID of the appointment
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              doctor:
 *                type: string
 *              patient:
 *                type: string
 *              date:
 *                type: string
 *                format: date
 *              time:
 *                type: string
 *              notes:
 *                type: string
 *              status:
 *                type: string
 *                enum: [pending, confirmed, cancelled, completed]
 *    tags:
 *      - Appointments
 *    responses:
 *      200:
 *        description: Appointment updated
 *      400:
 *        description: Invalid appointment ID format
 *      404:
 *        description: Appointment not found
 *      500:
 *        description: An error occurred while updating the appointment
 */
router.put(
  '/:id',
  hybridAuth,
  validateMongoIdParam,
  validateAppointment,
  updateAppointment,
);

/**
 * @swagger
 * /api/appointments/{id}:
 *  delete:
 *    summary: Deletes an appointment by ID
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: The unique ID of the appointment
 *    tags:
 *      - Appointments
 *    responses:
 *      200:
 *        description: Appointment was deleted successfully
 *      400:
 *        description: Invalid appointment ID format
 *      404:
 *        description: Appointment not found
 *      500:
 *        description: An error occurred while deleting the appointment
 */
router.delete('/:id', hybridAuth, validateMongoIdParam, deleteAppointment);

export default router;
