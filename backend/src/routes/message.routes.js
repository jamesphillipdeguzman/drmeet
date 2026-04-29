import express from "express";
import { hybridAuth } from "../middlewares/auth.middleware.js";
import {
  getUserConversations,
  getMessagesByConversation,
  ensurePatientDoctorConversationId,
  markMessagesAsRead,
  sendMessage,
} from "../controllers/message.controller.js";

const router = express.Router();

// Conversations scoped by the authenticated user (admin sees all).
router.get("/conversations", hybridAuth, getUserConversations);

// Messages for a specific conversation (strict participant security).
router.get(
  "/conversations/:conversationId/messages",
  hybridAuth,
  getMessagesByConversation,
);

// Send a message (optionally auto-creates patient->doctor conversation).
router.post("/send", hybridAuth, sendMessage);

// Explicit helper to ensure a patient<->doctor conversation exists.
router.post(
  "/conversations/ensure/patient-doctor",
  hybridAuth,
  ensurePatientDoctorConversationId,
);

// Mark all messages in a conversation as read by the current user.
router.post(
  "/conversations/:conversationId/read",
  hybridAuth,
  markMessagesAsRead,
);

export default router;

