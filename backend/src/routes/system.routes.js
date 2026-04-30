import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';
import { getDiagnostics } from '../controllers/system.controller.js';

const router = express.Router();

router.get('/diagnostics', hybridAuth, getDiagnostics);

export default router;
