import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
      match: /^\S+@\S+\.\S+$/,
    },
    password: {
      type: String,
      required: false, // Not required for Google OAuth users
    },
    googleId: {
      type: String,
      required: false,
    },
    picture: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ["admin", "doctor", "patient", "user"],
      default: "user",
      required: true,
    },
    phone: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },
    lastLogin: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
