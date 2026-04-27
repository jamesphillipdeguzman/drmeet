import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';
import { validateMongoIdParam } from '../middlewares/common.middleware.js';
import {
  getAllUsers,
  getUserById,
  postUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller.js';
import {
} from '../middlewares/user.validation.middleware.js';

const router = express.Router();

router.get('/', hybridAuth, getAllUsers);
router.get('/:id', hybridAuth, validateMongoIdParam, getUserById);
router.post('/', hybridAuth, postUser);
router.put(
  '/:id',
  hybridAuth,
  validateMongoIdParam,
  updateUser,
);
router.delete('/:id', hybridAuth, validateMongoIdParam, deleteUser);

export default router;
