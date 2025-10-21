import { dbConnect } from '../lib/db.js';
import Cell from '../models/Cell.js';
import mongoose from 'mongoose';

const migrateCells = async () => {
  try {
    await dbConnect();
    
    console.log('🔄 Starting cell migration...');
    
    // Add new fields to all existing cells (they're already normal/active)
    const result = await Cell.updateMany(
      { divisionDuration: { $exists: false } },
      { 
        $set: { 
          divisionDuration: null,
          divisionStartTime: null,
          resultingCellId: null
        }
      }
    );
    
    // Remove isFormed field if it exists (no longer needed)
    const cleanupResult = await Cell.updateMany(
      { isFormed: { $exists: true } },
      { 
        $unset: { isFormed: "" }
      }
    );
    
    console.log(`✅ Cell migration completed: ${result.modifiedCount} cells updated, ${cleanupResult.modifiedCount} cleaned up`);
    
    await mongoose.disconnect();
    console.log('Disconnected from database');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

migrateCells().catch(console.error);
