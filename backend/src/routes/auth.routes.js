import express from "express";
const router = express.Router();

// Dummy route for login
router.post("/", (req, res) => {
  res.send("Login logic here");
});

export default router;
