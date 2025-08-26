// seedData.js - Script to seed initial data for the biobackend
import { dbConnect } from '../lib/db.js';
import mongoose from 'mongoose';
import 'dotenv/config';
import Cell from '../models/Cell.js';
import Consolidation from '../models/Consolidation.js';

const seedData = async () => {
  try {
    // Connect to the database
    await dbConnect();
    
    console.log('Connected to the database');
    
    // Check if cell 0 already exists
    const existingCell = await Cell.findOne({ cellId: 0 });
    
    if (existingCell) {
      console.log('Cell 0 already exists:', existingCell._id);
      await mongoose.disconnect();
      return;
    }
    
    // Create cell 0 (the origin cell)
    const cell0 = new Cell({
      cellId: 0,
      parentEntityIds: [], // Empty as it's the original cell
      potentialTrait: "origin", // Special trait for the origin cell
      energyLevel: 100, // Starting with high energy
      status: "normal"
    });
    
    // Save cell 0
    const savedCell = await cell0.save();
    console.log('Created cell 0:', savedCell._id);
    
    // Create the first consolidation that contains cell 0
    const consolidation = new Consolidation({
      consolidationId: 0, // First consolidation
      originCellId: savedCell._id,
      cellIds: [savedCell._id],
      state: "transparent"
    });
    
    // Save consolidation
    const savedConsolidation = await consolidation.save();
    console.log('Created initial consolidation:', savedConsolidation._id);
    
    // Update cell 0 with the consolidation ID
    savedCell.consolidationId = savedConsolidation._id;
    await savedCell.save();
    console.log('Updated cell 0 with consolidation ID');
    
    console.log('Seed data created successfully');
    await mongoose.disconnect();
    console.log('Disconnected from database');
    
  } catch (error) {
    console.error('Error seeding data:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Execute the seeding function
seedData().catch(console.error);
