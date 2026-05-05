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
    allowReceptionistSendDocuments: {
      type: Boolean,
      default: false,
    },
    availabilityText: {
      type: String,
      default: "",
    },

    /** Professional license identifier (e.g. PRC ID) shown on clinical profile. */
    licenseNumber: {
      type: String,
      default: "",
      trim: true,
    },
    prcLicenseNumber: {
      type: String,
      default: "",
      trim: true,
    },
    prcExpirationDate: {
      type: Date,
      default: null,
    },
    prcIdFileUrl: {
      type: String,
      default: "",
    },

    /**
     * Explicitly pinned patients; merged with appointment/care-team discovery in APIs.
     */
    assignedPatients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
      },
    ],

    notificationPrefs: {
      emailAppointments: { type: Boolean, default: true },
      emailMessages: { type: Boolean, default: true },
    },
    bookingPolicy: {
      maxPatientsPerDay: { type: Number, default: 10, min: 1, max: 200 },
    },

    documents: [
      {
        name: { type: String, default: "" },
        url: { type: String, default: "" },
        fileUrl: { type: String, default: "" },
        docType: { type: String, default: "clinic" },
        uploadedAt: { type: Date, default: Date.now },
        uploaderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        receiverId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

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
