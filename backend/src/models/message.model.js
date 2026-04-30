import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    attachmentUrl: {
      type: String,
      default: "",
      trim: true,
    },
    attachmentName: {
      type: String,
      default: "",
      trim: true,
    },
    attachmentType: {
      type: String,
      default: "",
      trim: true,
    },
    readBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr),
        message: "readBy must be an array of userIds.",
      },
    },
  },
  { timestamps: true },
);

// Efficient fetch + ordered conversation views.
MessageSchema.index({ conversationId: 1 });

export default mongoose.model("Message", MessageSchema);

