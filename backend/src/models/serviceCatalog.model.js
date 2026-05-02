import mongoose from "mongoose";

const serviceCatalogSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category: {
      type: String,
      enum: ["laboratory", "imaging", "procedure", "consultation", "other"],
      default: "other",
    },
    unitPrice: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

serviceCatalogSchema.index({ code: 1 }, { unique: false, sparse: true });
serviceCatalogSchema.index({ name: "text", code: "text" });

export default mongoose.model("ServiceCatalog", serviceCatalogSchema);
