import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import Doctor from "../models/doctor.model.js";
import Patient from "../models/patient.model.js";
import { patientActiveQuery } from "../services/patient.service.js";
import { uploadToCloudinary } from "../services/cloudinary.service.js";
import { appointmentExistsForDoctorPatient } from "../services/appointment.service.js";
import {
  buildUserConversationsQuery,
  userMayAccessConversationType,
} from "../utils/conversationAccess.js";

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

    // ✅ Allow patient + doctor + admin
    const allowedRoles = ["patient", "doctor", "admin"];

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: "Only patient, doctor, or admin can start a patient-doctor conversation.",
      });
    }

    // ✅ If user is patient, enforce ownership rule
    if (role === "patient") {
      if (String(patientId) !== String(userId)) {
        return res.status(403).json({ error: "Forbidden." });
      }
    }

    if (role === "doctor") {
      if (String(doctorId) !== String(userId)) {
        return res.status(403).json({ error: "Forbidden." });
      }
      const doctorProfile = await Doctor.findOne({ userId }).select("_id").lean();
      const patientProfile = await Patient.findOne({
        userId: patientId,
        ...patientActiveQuery,
      })
        .select("_id")
        .lean();
      if (!doctorProfile || !patientProfile) {
        return res.status(403).json({ error: "Forbidden." });
      }
      const hasAppointment = await appointmentExistsForDoctorPatient(
        String(doctorProfile._id),
        String(patientProfile._id),
      );
      if (!hasAppointment) {
        return res.status(403).json({
          error: "Conversation allowed only for patients with prior appointments.",
        });
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

async function attachParticipantAvatars(conversations = []) {
  const rows = Array.isArray(conversations) ? conversations : [];
  const userIds = [
    ...new Set(
      rows
        .flatMap((c) => (Array.isArray(c?.participants) ? c.participants : []))
        .map((p) => String(p?._id || ""))
        .filter(Boolean),
    ),
  ];
  if (!userIds.length) {
    return rows.map((conversation) => {
      const plainConversation = conversation?.toObject ? conversation.toObject() : conversation;
      const participants = Array.isArray(plainConversation?.participants) ? plainConversation.participants : [];
      return {
        ...plainConversation,
        participants: participants.map((participant) => ({
          ...participant,
          avatarUrl: String(participant?.picture || ""),
        })),
      };
    });
  }

  const [doctors, patients] = await Promise.all([
    Doctor.find({ userId: { $in: userIds } }).select("userId photoUrl").lean(),
    Patient.find({ userId: { $in: userIds } }).select("userId photoUrl").lean(),
  ]);

  const avatarByUserId = new Map();
  doctors.forEach((d) => {
    if (d?.userId && d?.photoUrl) avatarByUserId.set(String(d.userId), String(d.photoUrl));
  });
  patients.forEach((p) => {
    if (!p?.userId || !p?.photoUrl) return;
    const key = String(p.userId);
    if (!avatarByUserId.has(key)) avatarByUserId.set(key, String(p.photoUrl));
  });

  return rows.map((conversation) => {
    const plainConversation = conversation?.toObject ? conversation.toObject() : conversation;
    const participants = Array.isArray(plainConversation?.participants) ? plainConversation.participants : [];
    return {
      ...plainConversation,
      participants: participants.map((participant) => {
        const uid = String(participant?._id || "");
        return {
          ...participant,
          avatarUrl: avatarByUserId.get(uid) || String(participant?.picture || ""),
        };
      }),
    };
  });
}

export const getUserConversations = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const filter = isAdmin(req) ? {} : buildUserConversationsQuery(req.user);

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("participants", "firstName lastName email role picture");

    const serializedConversations = await attachParticipantAvatars(conversations);
    return res.status(200).json({ conversations: serializedConversations });
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
    let conversation = null;
    if (!isAdmin(req)) {
      conversation = await assertUserIsParticipantOrAdmin({
        req,
        conversationId,
      });
      if (!conversation) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (
        !userMayAccessConversationType(req.user?.role, conversation.conversationType)
      ) {
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

    const {
      conversationId,
      patientId,
      doctorId,
      message,
      fileData,
      attachmentName,
      attachmentType,
    } = req.body || {};

    const text = typeof message === "string" ? message.trim() : "";
    if (!text && !fileData) {
      return res.status(400).json({ error: "Message or attachment is required." });
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
      if (
        !userMayAccessConversationType(req.user?.role, conversation.conversationType)
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    let upload = null;
    if (fileData) {
      upload = await uploadToCloudinary(fileData, {
        folder: "drmeet/messages",
        resource_type: "auto",
      });
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      message: text,
      attachmentUrl: upload?.secure_url || "",
      attachmentName: attachmentName || "",
      attachmentType: attachmentType || "",
      readBy: [userId],
    });

    // Populate sender for the frontend display logic.
    await newMessage.populate("senderId", "firstName lastName role email");

    const updatedConversation = await Conversation.findByIdAndUpdate(
      conversation._id,
      {
        lastMessage: newMessage.message || (newMessage.attachmentName ? `📎 ${newMessage.attachmentName}` : "📎 Attachment"),
        lastMessageAt: new Date(),
      },
      { new: true },
    ).populate("participants", "firstName lastName email role picture");
    const [serializedConversation] = await attachParticipantAvatars([updatedConversation]);

    return res.status(201).json({
      conversationId: conversation._id,
      message: newMessage,
      conversation: serializedConversation,
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
      if (
        !userMayAccessConversationType(req.user?.role, conversation.conversationType)
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

