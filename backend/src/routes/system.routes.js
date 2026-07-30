import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';
import {
  getDiagnostics,
  getVisitorCount,
  incrementVisitorCount,
} from '../controllers/system.controller.js';

const router = express.Router();

router.get('/diagnostics', hybridAuth, getDiagnostics);
router.get('/visitor-count', getVisitorCount);
router.post('/visitor-count', incrementVisitorCount);

export default router;
