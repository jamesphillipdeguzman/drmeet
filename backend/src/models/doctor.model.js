import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
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

    title: {
      type: String,
      enum: ["Dr.", "MD", "DO", "Consultant"],
    },
    specialty: {
      type: String,
      required: true,
      enum: [
        "General Medicine",
        "Pediatrics",
        "Dermatology",
        "Cardiology",
        "Neurology",
        "Psychiatry",
        "OB-GYN",
        "ENT",
        "Orthopedics",
        "Surgery",
        "Family Medicine",
        "Radiology",
        "Pathology",
        "Urology",
        "Dentistry",
        "Ophthalmology",
      ],
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
    experienceYears: { type: Number },
    email: {
      type: String,
      required: true,
    },
    phone: { type: String },

    availability: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
          required: true,
        },

        startTime: {
          type: String,
          enum: [
            "08:00",
            "08:30",
            "09:00",
            "09:30",
            "10:00",
            "10:30",
            "11:00",
            "11:30",
            "12:00",
            "12:30",
            "13:00",
            "13:30",
            "14:00",
            "14:30",
            "15:00",
            "15:30",
            "16:00",
            "16:30",
            "17:00",
          ],
          required: true,
        },
        endTime: {
          type: String,
          enum: [
            "08:30",
            "09:00",
            "09:30",
            "10:00",
            "10:30",
            "11:00",
            "11:30",
            "12:00",
            "12:30",
            "13:00",
            "13:30",
            "14:00",
            "14:30",
            "15:00",
            "15:30",
            "16:00",
            "16:30",
            "17:00",
            "17:30",
          ],
          required: true,
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
