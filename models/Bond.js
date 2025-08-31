import mongoose from "mongoose";

const BondSchema = new mongoose.Schema({
  entityA: { type: Number, required: true },
  entityB: { type: Number, required: true },
  startTime: { type: Date, default: Date.now },
  duration: { type: Number, required: true }, // ms or seconds
  status: { type: String, enum: ["active", "completed"], default: "active" },
  createdAt: { type: Number, default: Date.now }, // seconds since creation
  resultingCellId: { type: mongoose.Schema.Types.ObjectId, ref: "Cell" }
});

const Bond = mongoose.model("Bond", BondSchema);
export default Bond;
