import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    doctor: {
      type: String,
      required: true,
    },
    patient: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: false,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Index to optimize doctor + date queries (e.g., checking availability)
appointmentSchema.index({ doctor: 1, date: 1 });

export default mongoose.model("Appointment", appointmentSchema);
