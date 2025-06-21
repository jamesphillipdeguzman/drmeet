import express from 'express';
const router = express.Router();

// Example protected route
router.get('/', (req, res) => {
  res.send('List of doctors');
});

export default router;
