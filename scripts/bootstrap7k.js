import mongoose from 'mongoose';
import { dbConnect } from '../lib/db.js';
import Entity from '../models/Entity.js';
import Cell from '../models/Cell.js';
import Consolidation from '../models/Consolidation.js';
import Bond from '../models/Bond.js';
import Multiplier from '../models/Multiplier.js';
import 'dotenv/config'; // Make sure process.env gets loaded

const traitOptions = [
  'strength', 'intelligence', 'agility', 'resilience', 'creativity',
  'adaptability', 'energy', 'speed', 'endurance', 'wisdom'
];

function getRandomTrait() {
  return traitOptions[Math.floor(Math.random() * traitOptions.length)];
}

async function runBootstrap() {
  console.log('🚀 Starting Bootstrap Process...');
  await dbConnect();

  // Read config from ENV, fallback to the hardcoded bypass spec.
  const TARGET_ENTITIES = parseInt(process.env.BOOTSTRAP_ENTITIES, 10) || 7000;
  const TARGET_CONSOLIDATIONS = parseInt(process.env.BOOTSTRAP_CONSOLIDATIONS, 10) || 100;
  const CELLS_PER_CONSOLIDATION = parseInt(process.env.BOOTSTRAP_CELLS_PER_CONSOLIDATION, 10) || 50;

  console.log('🧹 Wiping existing collections to start fresh...');
  await Entity.deleteMany({});
  await Cell.deleteMany({});
  await Consolidation.deleteMany({});
  await Bond.deleteMany({});
  await Multiplier.deleteMany({});
  console.log('✅ Collections wiped.');

  // ==========================================
  // 1. Generate Target Entities
  // ==========================================
  console.log(`🧬 Generating ${TARGET_ENTITIES} Entities...`);
  const entities = [];
  for (let i = 1; i <= TARGET_ENTITIES; i++) {
    entities.push({
      entityId: i,
      trait: getRandomTrait(),
      generation: 1, // Base generation
      bondHistory: []
    });
  }

  // Insert entities in chunks if scaling above 10-20k to avoid max memory issues
  const chunkSize = 2000;
  for (let i = 0; i < entities.length; i += chunkSize) {
    await Entity.insertMany(entities.slice(i, i + chunkSize), { ordered: false });
  }
  console.log(`✅ Placed ${TARGET_ENTITIES} Entities into the database.`);

  // ==========================================
  // 2. Generate Target Consolidations & Cells
  // ==========================================
  console.log(`📦 Generating ${TARGET_CONSOLIDATIONS} Consolidations with ${CELLS_PER_CONSOLIDATION} Cells each...`);
  const consolidations = [];
  const cells = [];

  for (let i = 1; i <= TARGET_CONSOLIDATIONS; i++) {
    // Generate an ID for the consolidation *before* creating it, so we can attach cells to it
    const consolidationObjId = new mongoose.Types.ObjectId();
    const consolidationCellIds = [];
    let originCellId = null;

    for (let j = 0; j < CELLS_PER_CONSOLIDATION; j++) {
      const cellObjId = new mongoose.Types.ObjectId();
      consolidationCellIds.push(cellObjId);
      
      if (j === 0) originCellId = cellObjId;

      cells.push({
        _id: cellObjId,
        cellId: j,
        consolidationId: consolidationObjId,
        parentEntityIds: [], // Root cells
        potentialTrait: getRandomTrait(),
        energyLevel: Math.floor(Math.random() * 40) + 60, // 60-100 energy
        status: 'normal' // Immediately ready
      });
    }

    consolidations.push({
      _id: consolidationObjId,
      consolidationId: i,
      cellIds: consolidationCellIds,
      originCellId: originCellId,
      state: 'transparent' // Active state ready for evolution or division
    });
  }

  // Batch insert Cells
  console.log(`🔬 Inserting ${cells.length} Cells into the database...`);
  for (let i = 0; i < cells.length; i += chunkSize) {
    await Cell.insertMany(cells.slice(i, i + chunkSize), { ordered: false });
  }

  // Batch insert Consolidations
  await Consolidation.insertMany(consolidations, { ordered: false });

  console.log(`✅ Placed ${TARGET_CONSOLIDATIONS} Consolidations and ${cells.length} Cells.`);

  console.log('🎉 Bootstrap completed successfully bypassing simulation cycles!');
  process.exit(0);
}

runBootstrap().catch(err => {
  console.error('❌ Bootstrap failed with an error:', err);
  process.exit(1);
});
