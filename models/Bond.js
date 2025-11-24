import mongoose from "mongoose";

const BondSchema = new mongoose.Schema({
  entityA: { type: Number, required: true },
  entityB: { type: Number, required: true },
  startTime: { type: Date, default: Date.now },
  duration: { type: Number, required: true }, // milliseconds
  status: { type: String, enum: ["active", "completed"], default: "active" },
  createdAt: { type: Date, default: Date.now }, // Changed from Number to Date for consistency
  resultingCellId: { type: mongoose.Schema.Types.ObjectId, ref: "Cell" }
});

const Bond = mongoose.model("Bond", BondSchema);
export default Bond;
