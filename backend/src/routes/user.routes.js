import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';
import { validateMongoIdParam } from '../middlewares/common.middleware.js';
import {
  getAllUsers,
  getUserById,
  postUser,
  updateUser,
  deleteUser,
  exportUsersCsv,
} from '../controllers/user.controller.js';
import {
} from '../middlewares/user.validation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/users/export/csv:
 *   get:
 *     summary: Export all users as a CSV file (Admin only)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search keyword filtering by name, email, or phone
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter users by role
 *     responses:
 *       200:
 *         description: CSV file download containing user list
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       403:
 *         description: Forbidden (Admin only)
 *       500:
 *         description: Server error
 */
router.get('/export/csv', hybridAuth, exportUsersCsv);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Scoped based on roles)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query matching firstName, lastName, email, or phone
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter results by user role
 *     responses:
 *       200:
 *         description: A list of users matching filters and access scopes
 *       500:
 *         description: Server error
 */
router.get('/', hybridAuth, getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the user
 *     responses:
 *       200:
 *         description: User object
 *       400:
 *         description: Invalid ID format
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/:id', hybridAuth, validateMongoIdParam, getUserById);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - role
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [admin, doctor, patient, receptionist]
 *               title:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               specialty:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid data or user already exists
 *       403:
 *         description: Forbidden (Admin only)
 *       500:
 *         description: Server error
 */
router.post('/', hybridAuth, postUser);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update a user by ID (Admin or self)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               title:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               specialty:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  hybridAuth,
  validateMongoIdParam,
  updateUser,
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Soft delete a user by ID (Admin or self)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the user
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Invalid ID format
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', hybridAuth, validateMongoIdParam, deleteUser);

export default router;
