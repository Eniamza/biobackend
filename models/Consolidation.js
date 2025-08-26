import mongoose from "mongoose";

const ConsolidationSchema = new mongoose.Schema({
  consolidationId: { type: Number, required: true, unique: true },
  originCellId: { type: mongoose.Schema.Types.ObjectId, ref: "Cell" }, // Cell 0
  cellIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cell" }],
  state: { 
    type: String, 
    enum: ["transparent", "dense", "entity_forming"], 
    default: "transparent" 
  },
  createdAt: { type: Date, default: Date.now },
  evolvedToEntityId: { type: Number, default: null } // if turned into entity
});

const Consolidation = mongoose.model("Consolidation", ConsolidationSchema);
export default Consolidation;
