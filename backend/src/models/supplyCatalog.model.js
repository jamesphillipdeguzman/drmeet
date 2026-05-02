import mongoose from "mongoose";

const supplyCatalogSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    unit: { type: String, default: "", trim: true },
    unitPrice: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

supplyCatalogSchema.index({ code: 1 }, { sparse: true });
supplyCatalogSchema.index({ name: "text" });

export default mongoose.model("SupplyCatalog", supplyCatalogSchema);
