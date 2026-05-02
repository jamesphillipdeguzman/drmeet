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

    /** Per-visit billing & optional HMO claim metadata (clinical dashboard). */
    billing: {
      consultationFee: { type: Number, default: 0 },
      serviceLines: [
        {
          description: { type: String, default: "" },
          amount: { type: Number, default: 0 },
        },
      ],
      totalAmount: { type: Number, default: 0 },
      paymentStatus: {
        type: String,
        enum: ["unpaid", "partial", "paid"],
        default: "unpaid",
      },
      paymentMethod: { type: String, default: "" },

      hmoProvider: { type: String, default: "" },
      hmoMemberId: { type: String, default: "" },
      hmoCoverageStatus: {
        type: String,
        enum: ["", "verified", "partial", "denied"],
        default: "",
      },
      hmoPreAuthorization: { type: String, default: "" },
      hmoClaimStatus: {
        type: String,
        enum: ["", "pending", "submitted", "approved", "rejected", "paid"],
        default: "",
      },
      hmoCoveredAmount: { type: Number, default: 0 },
      hmoPatientCopay: { type: Number, default: 0 },

      /** Statement of account / invoice PDF or image URLs for patient & payer. */
      soaUrl: { type: String, default: "" },
      invoiceUrl: { type: String, default: "" },

      hmoClaimAttachments: [
        {
          name: { type: String, default: "" },
          fileUrl: { type: String, default: "" },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
    },
  },
  { timestamps: true }
);

// Index to optimize doctor + date queries (e.g., checking availability)
appointmentSchema.index({ doctor: 1, date: 1 });

export default mongoose.model("Appointment", appointmentSchema);
