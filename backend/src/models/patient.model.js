import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      unique: true,
      sparse: true,
    },
    accountOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    relationshipToAccountHolder: {
      type: String,
      default: "",
    },
    firstName: {
      type: String,
      default: "unknown",
      required: true,
    },
    lastName: {
      type: String,
      default: "unknown",
      required: true,
    },
    email: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    birthdate: {
      type: Date,
    },

    address: {
      address1: String,
      address2: String,
      city: String,
      province: String,
      postcode: String,
      country: String,
    },

    emergencyContact: {
      name: String,
      relation: String,
      phone: String,
    },

    medicalHistory: [String],
    notes: {
      type: String,
      default: "",
    },
    documents: [
      {
        name: { type: String, default: "" },
        url: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    careTeamDoctorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Patient", patientSchema);
