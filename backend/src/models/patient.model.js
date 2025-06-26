import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
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
      required: true,
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
  },
  { timeStamps: true }
);

export default mongoose.model("Patient", patientSchema);
