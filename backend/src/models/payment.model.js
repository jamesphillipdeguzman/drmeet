import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    billingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Billing",
      required: true,
      index: true,
    },
    method: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    referenceNumber: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ billingId: 1, status: 1 });

export default mongoose.model("Payment", paymentSchema);
