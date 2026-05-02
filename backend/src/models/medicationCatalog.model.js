import mongoose from "mongoose";

const medicationCatalogSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    genericName: { type: String, default: "", trim: true },
    form: { type: String, default: "", trim: true },
    strength: { type: String, default: "", trim: true },
    unitPrice: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

medicationCatalogSchema.index({ code: 1 }, { sparse: true });
medicationCatalogSchema.index({ name: "text" });

export default mongoose.model("MedicationCatalog", medicationCatalogSchema);
