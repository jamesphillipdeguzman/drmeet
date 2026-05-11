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
    /** false + deletedAt set = removed from clinic lists; User row unchanged. */
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
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
    title: {
      type: String,
      default: "",
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
        fileUrl: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
        uploaderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        uploaderRole: {
          type: String,
          default: "",
        },
        receiverId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    photoUrl: {
      type: String,
      default: "",
    },
    careTeamDoctorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
      },
    ],
    isInsured: {
      type: Boolean,
      default: false,
    },
    hmoProvider: {
      type: String,
      default: "",
      trim: true,
    },
    registrationFacility: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

patientSchema.index({ deletedAt: 1, isActive: 1 });

export default mongoose.model("Patient", patientSchema);
