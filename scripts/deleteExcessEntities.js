import mongoose from 'mongoose';
import { dbConnect } from '../lib/db.js';
import Entity from '../models/Entity.js';
import 'dotenv/config';

async function runCleanup() {
  console.log('🚀 Starting entity cleanup...');
  await dbConnect();

  const count = await Entity.countDocuments();
  console.log(`Current entity count: ${count}`);

  const TARGET = 7000;
  if (count <= TARGET) {
    console.log(`Entity count is already ${count}, which is <= ${TARGET}. Nothing to delete.`);
    process.exit(0);
  }

  const excess = count - TARGET;
  console.log(`Need to delete ${excess} entities.`);

  // We will delete the entities with the highest entityId
  const entitiesToDelete = await Entity.find({}, { _id: 1 })
    .sort({ entityId: -1 }) // Sort descending by entityId to remove the newest ones
    .limit(excess);

  const idsToDelete = entitiesToDelete.map(e => e._id);

  console.log(`Deleting ${idsToDelete.length} entities...`);

  const result = await Entity.deleteMany({ _id: { $in: idsToDelete } });

  console.log(`✅ Successfully deleted ${result.deletedCount} entities.`);
  
  const newCount = await Entity.countDocuments();
  console.log(`New entity count: ${newCount}`);
  
  process.exit(0);
}

runCleanup().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
