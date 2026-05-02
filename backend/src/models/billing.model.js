import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["service", "medication", "supply", ""],
      default: "",
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "consultation",
        "laboratory",
        "imaging",
        "medication",
        "supplies",
        "procedure",
      ],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    unitPrice: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: true },
);

const insuranceInfoSchema = new mongoose.Schema(
  {
    payer: {
      type: String,
      enum: ["HMO", "PhilHealth", "Private", "None"],
      default: "None",
    },
    coverageAmount: { type: Number, default: 0, min: 0 },
    coPay: { type: Number, default: 0, min: 0 },
    claimStatus: {
      type: String,
      enum: ["not_filed", "pending", "approved", "rejected"],
      default: "not_filed",
    },
  },
  { _id: false },
);

const billingSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    encounterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },
    lineItems: [lineItemSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },
    insuranceInfo: { type: insuranceInfoSchema, default: () => ({}) },
  },
  { timestamps: true },
);

billingSchema.index({ patientId: 1, encounterId: 1 });
billingSchema.index({ doctorId: 1, createdAt: -1 });

export default mongoose.model("Billing", billingSchema);
export { lineItemSchema, insuranceInfoSchema };
