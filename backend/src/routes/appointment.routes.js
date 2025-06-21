import express from 'express';
const router = express.Router();

router.post('/', (req, res) => {
  res.send('Create new appointment');
});

export default router;
