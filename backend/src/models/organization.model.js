import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    tier: {
      type: String,
      enum: ["enterprise"],
      default: "enterprise",
    },
    departments: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        headDoctor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Doctor",
          default: null,
        },
        orderIndex: {
          type: Number,
          default: 0,
        },
      },
    ],
    maxDoctorSeats: {
      type: Number,
      default: 150,
    },
    maxRooms: {
      type: Number,
      default: 50,
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Organization", organizationSchema);
