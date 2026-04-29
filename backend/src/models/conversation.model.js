import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: "participants must contain exactly 2 userIds.",
      },
      index: true,
    },
    conversationType: {
      type: String,
      enum: ["patient-doctor", "patient-receptionist"],
      required: true,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Used for efficient lookups: find conversations where a user is a participant.
ConversationSchema.index({ participants: 1 });

export default mongoose.model("Conversation", ConversationSchema);

