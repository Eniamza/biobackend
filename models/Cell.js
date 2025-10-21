import mongoose from "mongoose";

const CellSchema = new mongoose.Schema({
  cellId: { type: Number, required: true }, // serial within consolidation
  parentEntityIds: [{ type: Number }], // 2 entities if created by bond, empty if original Cell 0
  consolidationId: { type: mongoose.Schema.Types.ObjectId, ref: "Consolidation" },
  potentialTrait: { type: String }, // randomly assigned from trait sheet
  lastUpdated: { type: Number, default: Date.now }, // seconds since creation
  originTimestamp: { type: Date, default: Date.now },
  energyLevel: { type: Number, default: 0 }, // arbitrary number
  status: {
    type: String,
    enum: ["normal", "forming", "dividing"],
    default: "normal"
  },
  divisionDuration: { type: Number }, // Duration in milliseconds (60000-360000 = 1-6 minutes)
  divisionStartTime: { type: Date }, // ISO timestamp when division started
  resultingCellId: { type: mongoose.Schema.Types.ObjectId, ref: "Cell" } // The new cell created from division
});

const Cell = mongoose.model("Cell", CellSchema);
export default Cell;
