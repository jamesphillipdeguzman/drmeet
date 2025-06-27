import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';

import {
  getAllPatients,
  getPatientById,
  postPatient,
  updatePatient,
  deletePatient,
} from '../controllers/patient.controller.js';
import {
  validatePatient,
} from '../middlewares/patient.validation.middleware.js';

import { validateMongoIdParam } from '../middlewares/common.middleware.js';

const router = express.Router();

// Get all patients
/**
 * @swagger
 * /api/patients:
 *  get:
 *    summary: Get all patients
 *    tags:
 *      - Patients
 *    responses:
 *      200:
 *        description: A list of all patients
 *      500:
 *        description: An error occurred while fetching patients
 *
 */
router.get('/', hybridAuth, getAllPatients);

// Get a patient by Id
/**
 * @swagger
 * /api/patients/{id}:
 *  get:
 *    summary: Get a patient by ID
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: The unique ID of the patient
 *    tags:
 *      - Patients
 *    responses:
 *      200:
 *        description: The patient with the specified ID
 *      400:
 *        description: Invalid patient ID format
 *      404:
 *        description: Patient not found
 *      500:
 *        description: An error occurred while fetching the patient
 *
 */
router.get('/:id', hybridAuth, validateMongoIdParam, getPatientById);

// Create a new patient
/**
 * @swagger
 * /api/patients:
 *  post:
 *    summary: Create a new patient
 *    tags:
 *      - Patients
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - firstName
 *              - lastName
 *              - email
 *            properties:
 *              firstName:
 *                type: string
 *              lastName:
 *                type: string
 *              email:
 *                type: string
 *              phone:
 *                type: string
 *              address:
 *                type: string
 *              dateOfBirth:
 *                type: string
 *                format: date
 *    responses:
 *      201:
 *        description: A new patient created
 *      400:
 *        description: Failed to create patient
 *      500:
 *        description: An error occurred while creating the patient
 *
 */
router.post('/', hybridAuth, validatePatient, postPatient);

// Update a patient
/**
 * @swagger
 * /api/patients/{id}:
 *  put:
 *    summary: Update a patient by ID
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: The unique ID of the patient
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              firstName:
 *                type: string
 *              lastName:
 *                type: string
 *              email:
 *                type: string
 *              phone:
 *                type: string
 *              address:
 *                type: string
 *              dateOfBirth:
 *                type: string
 *                format: date
 *    tags:
 *      - Patients
 *    responses:
 *      200:
 *        description: Patient updated
 *      400:
 *        description: Invalid patient ID format
 *      404:
 *        description: Patient not found
 *      500:
 *        description: An error occurred while updating the patient
 *
 */
router.put(
  '/:id',
  hybridAuth,
  validateMongoIdParam,
  validatePatient,
  updatePatient,
);

// Delete a patient
/**
 * @swagger
 * /api/patients/{id}:
 *  delete:
 *    summary: Deletes a patient by ID
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: The unique ID of the patient
 *    tags:
 *      - Patients
 *    responses:
 *      200:
 *        description: Patient was deleted successfully
 *      400:
 *        description: Invalid patient ID format
 *      404:
 *        description: Patient not found
 *      500:
 *        description: An error occurred while deleting the patient
 */
router.delete('/:id', hybridAuth, validateMongoIdParam, deletePatient);

export default router;
