import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    roomName: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      default: "",
      trim: true,
    },
    dailyPatientCap: {
      type: Number,
      default: 30,
      min: 1,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Room", roomSchema);
