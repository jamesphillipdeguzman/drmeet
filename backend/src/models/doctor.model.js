import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      unique: true,
      sparse: true,
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
      enum: ["Dr.", "Dra.", "MD", "DO", "Consultant"],
    },
    specialty: {
      type: String,
      required: true,
    },

    department: {
      type: String,
      enum: [
        "Outpatient",
        "Inpatient",
        "Emergency",
        "Surgery",
        "Diagnostics",
        "Telemedicine",
        "Pediatrics",
        "Internal Medicine",
        "Mental Health",
        "Rehabilitation",
        "Specialty Clinics",
      ],
    },

    bio: {
      type: String,
      default: "",
    },
    room: {
      type: String,
      default: "",
    },
    affiliatedClinics: {
      type: String,
      default: "",
    },
    experienceYears: { type: Number },
    email: {
      type: String,
      required: true,
    },
    phone: { type: String },
    receptionistName: {
      type: String,
      default: "",
    },
    receptionistEmail: {
      type: String,
      default: "",
    },
    receptionistPhone: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    photoUrl: {
      type: String,
      default: "",
    },
    availabilityText: {
      type: String,
      default: "",
    },

    availability: [
      {
        day: {
          type: String,
          required: false,
        },

        startTime: {
          type: String,
          required: false,
        },
        endTime: {
          type: String,
          required: false,
        },
        timeRange: {
          type: String,
          default: "",
        },
        location: {
          clinicName: String,
          address1: String,
          address2: String,
          city: String,
          province: String,
          postcode: String,
          country: String,
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Doctor", doctorSchema);
