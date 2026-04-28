const inboxState = {
  messages: [
    {
      id: "seed-1",
      patientId: "patient-001",
      patientName: "Maria T.",
      body: "I can do tomorrow morning.",
      status: "pending",
      tags: ["NDIS"],
      channel: "sms",
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      read: true,
      typing: false,
      isNew: false,
    },
  ],
};

function sortRecent(list) {
  return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getInboxMessages() {
  return sortRecent(inboxState.messages);
}

export function pushInboxMessage(message) {
  const payload = {
    id: message.id || `msg-${Date.now()}`,
    patientId: message.patientId || "patient-unknown",
    patientName: message.patientName || "Unknown Patient",
    title: message.title || "Patient message",
    body: message.body || message.content || "",
    tags: Array.isArray(message.tags) ? message.tags : [],
    status: message.status || "pending",
    channel: message.channel || "sms",
    createdAt: message.createdAt || new Date().toISOString(),
    read: Boolean(message.read),
    typing: Boolean(message.typing),
    isNew: true,
  };
  inboxState.messages = sortRecent([payload, ...inboxState.messages]);
  return payload;
}

