import mongoose from "mongoose";

export function getUserIdFromAuthPayload(user) {
  if (!user) return null;
  const raw = user._id ?? user.id;
  if (raw == null) return null;
  const id = String(raw);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

/**
 * Mongo query for conversations the user may list or join over Socket.IO.
 */
export function buildUserConversationsQuery(user) {
  const userId = getUserIdFromAuthPayload(user);
  const role = String(user?.role || "").toLowerCase();

  if (role === "admin") return {};
  if (!userId) return { _id: { $exists: false } };

  if (role === "patient") {
    return {
      participants: userId,
      conversationType: { $in: ["patient-doctor", "patient-receptionist"] },
    };
  }

  if (role === "doctor") {
    return {
      participants: userId,
      conversationType: "patient-doctor",
    };
  }

  if (role === "receptionist") {
    return {
      participants: userId,
      conversationType: "patient-receptionist",
    };
  }

  return { _id: { $exists: false } };
}

export function userMayAccessConversationType(role, conversationType) {
  const r = String(role || "").toLowerCase();
  const t = String(conversationType || "");

  if (r === "admin") return true;
  if (r === "patient") {
    return t === "patient-doctor" || t === "patient-receptionist";
  }
  if (r === "doctor") return t === "patient-doctor";
  if (r === "receptionist") return t === "patient-receptionist";
  return false;
}
