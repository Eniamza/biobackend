import mongoose from "mongoose";

const MultiplierSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  marketCap: { type: Number, required: true },
  multiplier: { type: Number, default: 1.0 } // applied to cell division, etc.
});

const Multiplier = mongoose.model("Multiplier", MultiplierSchema);
export default Multiplier;
