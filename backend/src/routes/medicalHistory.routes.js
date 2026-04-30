import express from 'express';
import { hybridAuth, requireRoles } from '../middlewares/auth.middleware.js';
import {
  uploadMedicalHistory,
  getMedicalHistory,
} from '../controllers/medicalHistory.controller.js';

const router = express.Router();

router.get('/', hybridAuth, requireRoles(['patient', 'doctor', 'receptionist', 'admin']), getMedicalHistory);
router.post('/', hybridAuth, requireRoles(['patient', 'doctor', 'receptionist']), uploadMedicalHistory);

export default router;
