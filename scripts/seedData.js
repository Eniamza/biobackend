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
    
    // Check if seed data already exists
    const existingConsolidation = await Consolidation.findOne({ consolidationId: 0 });
    
    if (existingConsolidation) {
      console.log('Seed data already exists - Consolidation 0 found');
      await mongoose.disconnect();
      return;
    }
    
    // Create first consolidation with cell 0
    const cell0 = new Cell({
      cellId: 0,
      parentEntityIds: [], // Empty as it's the origin cell
      potentialTrait: "origin", // Special trait for the origin cell
      energyLevel: 100, // Starting with high energy
      status: "normal"
    });
    
    const savedCell0 = await cell0.save();
    console.log('Created cell 0:', savedCell0._id);
    
    const consolidation0 = new Consolidation({
      consolidationId: 0, // First consolidation
      originCellId: savedCell0._id,
      cellIds: [savedCell0._id],
      state: "transparent"
    });
    
    const savedConsolidation0 = await consolidation0.save();
    console.log('Created consolidation 0:', savedConsolidation0._id);
    
    // Update cell 0 with the consolidation ID
    savedCell0.consolidationId = savedConsolidation0._id;
    await savedCell0.save();
    console.log('Updated cell 0 with consolidation ID');
    
    // Create second consolidation with cell 0
    const cell0_second = new Cell({
      cellId: 0, // This is cell 0 of the second consolidation
      parentEntityIds: [], // Empty as it's the origin cell
      potentialTrait: "resilience", // Different trait for variety
      energyLevel: 100, // Starting with high energy
      status: "normal"
    });
    
    const savedCell0Second = await cell0_second.save();
    console.log('Created second cell 0:', savedCell0Second._id);
    
    const consolidation1 = new Consolidation({
      consolidationId: 1, // Second consolidation
      originCellId: savedCell0Second._id,
      cellIds: [savedCell0Second._id],
      state: "transparent"
    });
    
    const savedConsolidation1 = await consolidation1.save();
    console.log('Created consolidation 1:', savedConsolidation1._id);
    
    // Update second cell 0 with the consolidation ID
    savedCell0Second.consolidationId = savedConsolidation1._id;
    await savedCell0Second.save();
    console.log('Updated second cell 0 with consolidation ID');
    
    console.log('✅ Seed data created successfully:');
    console.log('   - 2 Consolidations (ID: 0, 1)');
    console.log('   - 2 Cells (both Cell 0 in their respective consolidations)');
    console.log('   - Ready for cell division and growth');
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
