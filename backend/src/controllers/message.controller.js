import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

function getUserId(req) {
  const raw = req?.user?.id || req?.user?._id;
  return raw ? String(raw) : null;
}

function isAdmin(req) {
  return String(req?.user?.role || "") === "admin";
}

function assertValidObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error("Invalid id format");
    err.statusCode = 400;
    throw err;
  }
}

async function ensurePatientDoctorConversation({ patientId, doctorId }) {
  assertValidObjectId(patientId);
  assertValidObjectId(doctorId);

  // Because `participants` is constrained to length 2, `$all` is sufficient.
  const existing = await Conversation.findOne({
    conversationType: "patient-doctor",
    participants: { $all: [patientId, doctorId] },
  });

  if (existing) return existing;

  const created = await Conversation.create({
    participants: [patientId, doctorId],
    conversationType: "patient-doctor",
    lastMessage: "",
    lastMessageAt: null,
  });

  return created;
}

export const ensurePatientDoctorConversationId = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { patientId, doctorId } = req.body || {};

    if (!patientId || !doctorId) {
      return res.status(400).json({
        error: "patientId and doctorId are required.",
      });
    }

    assertValidObjectId(patientId);
    assertValidObjectId(doctorId);

    const role = String(req.user?.role || "");

    // ✅ Allow patient + admin
    const allowedRoles = ["patient", "admin"];

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: "Only patient or admin can start a patient-doctor conversation.",
      });
    }

    // ✅ If user is patient, enforce ownership rule
    if (role === "patient") {
      if (String(patientId) !== String(userId)) {
        return res.status(403).json({ error: "Forbidden." });
      }
    }

    // 🛠 Admin can act freely (no ownership restriction)
    const conversation = await ensurePatientDoctorConversation({
      patientId,
      doctorId,
    });

    return res.status(200).json({
      conversationId: conversation._id,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to ensure conversation",
    });
  }
};

async function assertUserIsParticipantOrAdmin({ req, conversationId }) {
  const userId = getUserId(req);
  if (!userId) {
    const err = new Error("Missing user identity");
    err.statusCode = 401;
    throw err;
  }

  assertValidObjectId(conversationId);

  if (isAdmin(req)) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return null;
    return conversation;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  return conversation; // null means either not found or not a participant
}

export const getUserConversations = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const filter = isAdmin(req) ? {} : { participants: userId };

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("participants", "firstName lastName email role");

    return res.status(200).json({ conversations });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to fetch conversations",
    });
  }
};

export const getMessagesByConversation = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { conversationId } = req.params;
    assertValidObjectId(conversationId);

    // Strict security: if user isn't participant -> 403.
    if (!isAdmin(req)) {
      const conversation = await assertUserIsParticipantOrAdmin({
        req,
        conversationId,
      });
      if (!conversation) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else {
      const exists = await Conversation.exists({ _id: conversationId });
      if (!exists) return res.status(404).json({ error: "Not found" });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate("senderId", "firstName lastName email role");

    return res.status(200).json({ messages });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to fetch messages",
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { conversationId, patientId, doctorId, message } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    let conversation = null;

    // Auto-create: patient -> doctor on first message.
    if (!conversationId) {
      assertValidObjectId(patientId);
      assertValidObjectId(doctorId);

      if (String(req.user?.role || "") !== "patient") {
        return res
          .status(403)
          .json({ error: "Only patient can start a patient-doctor conversation." });
      }
      if (String(patientId) !== userId) {
        return res.status(403).json({ error: "Forbidden." });
      }

      conversation = await ensurePatientDoctorConversation({ patientId, doctorId });
    } else {
      assertValidObjectId(conversationId);

      conversation = await assertUserIsParticipantOrAdmin({
        req,
        conversationId,
      });

      if (!conversation) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      message: message.trim(),
      readBy: [userId],
    });

    // Populate sender for the frontend display logic.
    await newMessage.populate("senderId", "firstName lastName role email");

    const updatedConversation = await Conversation.findByIdAndUpdate(
      conversation._id,
      {
        lastMessage: newMessage.message,
        lastMessageAt: new Date(),
      },
      { new: true },
    ).populate("participants", "firstName lastName email role");

    return res.status(201).json({
      conversationId: conversation._id,
      message: newMessage,
      conversation: updatedConversation,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to send message",
    });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { conversationId } = req.params;
    assertValidObjectId(conversationId);

    if (!isAdmin(req)) {
      const conversation = await assertUserIsParticipantOrAdmin({
        req,
        conversationId,
      });
      if (!conversation) return res.status(403).json({ error: "Forbidden" });
    } else {
      const exists = await Conversation.exists({ _id: conversationId });
      if (!exists) return res.status(404).json({ error: "Not found" });
    }

    const result = await Message.updateMany(
      { conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } },
    );

    return res.status(200).json({ updated: result.modifiedCount || 0 });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to mark messages as read",
    });
  }
};

