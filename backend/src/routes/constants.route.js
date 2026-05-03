import express from 'express';

const router = express.Router();

router.get('/facilities', (req, res) => {
  const data = require('../constants/doctors.cleaned.json');

  const facilities = [
    ...new Set(
      (data.providers || []).map((p) => p.hospitalName).filter(Boolean),
    ),
  ];

  res.json({ facilities });
});

export default router;
