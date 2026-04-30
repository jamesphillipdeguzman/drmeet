import express from 'express';
import { hybridAuth, requireRoles } from '../middlewares/auth.middleware.js';
import {
  postPrescription,
  getPrescriptions,
  getPrescription,
  putPrescription,
  removePrescription,
} from '../controllers/prescription.controller.js';

const router = express.Router();

router.get('/', hybridAuth, getPrescriptions);
router.get('/:id', hybridAuth, getPrescription);
router.post('/', hybridAuth, requireRoles(['doctor', 'receptionist']), postPrescription);
router.put('/:id', hybridAuth, requireRoles(['doctor', 'receptionist']), putPrescription);
router.delete('/:id', hybridAuth, requireRoles(['doctor', 'receptionist']), removePrescription);

export default router;
