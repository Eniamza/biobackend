import mongoose from "mongoose";

const ConsolidationSchema = new mongoose.Schema({
  consolidationId: { type: Number, required: true, unique: true },
  originCellId: { type: mongoose.Schema.Types.ObjectId, ref: "Cell" }, // Cell 0
  cellIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cell" }],
  state: {
    type: String,
    enum: ["transparent", "dense"], // transparent = active, dense = evolved (won't render)
    default: "transparent"
  },
  createdAt: { type: Date, default: Date.now },
  evolvedToEntityId: { type: Number, default: null }, // if turned into entity
  evolvedAt: { type: Date, default: null } // when it evolved into entity
});

ConsolidationSchema.index({ state: 1 });

const Consolidation = mongoose.model("Consolidation", ConsolidationSchema);
export default Consolidation;