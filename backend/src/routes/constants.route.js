import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/facilities', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../constants/doctors.cleaned.json');

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    const facilities = [
      ...new Set(
        (data.providers || []).map((p) => p.hospitalName).filter(Boolean),
      ),
    ];

    res.json({ facilities });
  } catch (err) {
    console.error('Facilities error:', err);
    res.status(500).json({
      error: 'Failed to load facilities',
      details: err.message,
    });
  }
});

export default router;
