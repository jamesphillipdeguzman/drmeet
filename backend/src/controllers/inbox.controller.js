import { getInboxMessages, pushInboxMessage } from "../services/inbox.service.js";

export const getUnifiedInbox = async (req, res) => {
  try {
    return res.status(200).json({ messages: getInboxMessages() });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch inbox messages." });
  }
};

export const postSendMessage = async (req, res) => {
  const { patientId, patientName, content, channel } = req.body || {};
  if (!patientId || !content) {
    return res.status(400).json({ error: "patientId and content are required." });
  }
  const message = pushInboxMessage({
    patientId,
    patientName,
    body: content,
    channel: channel || "sms",
    status: "confirmed",
    read: true,
  });
  return res.status(201).json({ message, messages: getInboxMessages() });
};

export const postInboundEmail = async (req, res) => {
  const { patientId, patientName, subject, body } = req.body || {};
  if (!patientId || !body) {
    return res.status(400).json({ error: "patientId and body are required." });
  }
  const message = pushInboxMessage({
    patientId,
    patientName,
    title: subject || "Inbound email",
    body,
    channel: "email",
    status: "pending",
    typing: false,
    read: false,
  });
  return res.status(201).json({
    message,
    messages: getInboxMessages(),
    note: "Inbound email accepted and pushed to Unified Inbox feed.",
  });
};

