import express from "express";
import { hybridAuth } from "../middlewares/auth.middleware.js";
import {
  getUnifiedInbox,
  postInboundEmail,
  postSendMessage,
} from "../controllers/inbox.controller.js";

const router = express.Router();

router.get("/", hybridAuth, getUnifiedInbox);
router.post("/send", hybridAuth, postSendMessage);
router.post("/email/inbound", postInboundEmail);

export default router;

