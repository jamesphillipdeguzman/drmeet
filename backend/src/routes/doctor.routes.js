import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';
import {
  getAllDoctors,
  getDoctorById,
  postDoctor,
  updateDoctor,
  deleteDoctor,
} from '../controllers/doctor.controller.js';
import { validateDoctor } from '../middlewares/doctor.validation.middleware.js';
import { validateMongoIdParam } from '../middlewares/common.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/doctors:
 *  get:
 *    summary: Get all doctors
 *    tags:
 *      - Doctors
 *    responses:
 *      200:
 *        description: A list of all doctors
 *      500:
 *        description: An error occurred while fetching doctors
 */
router.get('/', hybridAuth, getAllDoctors);

/**
 * @swagger
 * /api/doctors/{id}:
 *  get:
 *    summary: Get a doctor by ID
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: The unique ID of the doctor
 *    tags:
 *      - Doctors
 *    responses:
 *      200:
 *        description: The doctor with the specified ID
 *      400:
 *        description: Invalid doctor ID format
 *      404:
 *        description: Doctor not found
 *      500:
 *        description: An error occurred while fetching the doctor
 */
router.get('/:id', hybridAuth, validateMongoIdParam, getDoctorById);

/**
 * @swagger
 * /api/doctors:
 *  post:
 *    summary: Create a new doctor
 *    tags:
 *      - Doctors
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
 *              - specialization
 *            properties:
 *              firstName:
 *                type: string
 *              lastName:
 *                type: string
 *              email:
 *                type: string
 *              specialization:
 *                type: string
 *              phone:
 *                type: string
 *              address:
 *                type: string
 *    responses:
 *      201:
 *        description: A new doctor created
 *      400:
 *        description: Failed to create doctor
 *      500:
 *        description: An error occurred while creating the doctor
 */
router.post('/', hybridAuth, validateDoctor, postDoctor);

/**
 * @swagger
 * /api/doctors/{id}:
 *  put:
 *    summary: Update a doctor by ID
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: The unique ID of the doctor
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
 *              specialization:
 *                type: string
 *              phone:
 *                type: string
 *              address:
 *                type: string
 *    tags:
 *      - Doctors
 *    responses:
 *      200:
 *        description: Doctor updated
 *      400:
 *        description: Invalid doctor ID format
 *      404:
 *        description: Doctor not found
 *      500:
 *        description: An error occurred while updating the doctor
 */
router.put(
  '/:id',
  hybridAuth,
  validateMongoIdParam,
  validateDoctor,
  updateDoctor,
);

/**
 * @swagger
 * /api/doctors/{id}:
 *  delete:
 *    summary: Deletes a doctor by ID
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: The unique ID of the doctor
 *    tags:
 *      - Doctors
 *    responses:
 *      200:
 *        description: Doctor was deleted successfully
 *      400:
 *        description: Invalid doctor ID format
 *      404:
 *        description: Doctor not found
 *      500:
 *        description: An error occurred while deleting the doctor
 */
router.delete('/:id', hybridAuth, validateMongoIdParam, deleteDoctor);

export default router;
