import mongoose from "mongoose";

const EntitySchema = new mongoose.Schema({
  entityId: { type: Number, required: true, unique: true }, // serial number
  trait: { type: String, required: true }, // predefined assigned trait
  currentlyBondingWith: { type: Number, default: null }, // another Entity ID or null
  age: { type: Number, default: 0 }, // seconds since creation
  originTimestamp: { type: Date, default: Date.now },
  bondHistory: [
    {
      partnerEntityId: Number,
      cellsProduced: { type: Number, default: 0 }
    }
  ],
  generation: { type: Number, default: 1 }, // Gen 1, Gen 2, etc.
});

const Entity = mongoose.model("Entity", EntitySchema);
export default Entity;
