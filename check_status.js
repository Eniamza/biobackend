import { dbConnect } from './lib/db.js';
import Entity from './models/Entity.js';
import Cell from './models/Cell.js';
import Bond from './models/Bond.js';
import Consolidation from './models/Consolidation.js';

await dbConnect();

const entityCount = await Entity.countDocuments();
const cellCount = await Cell.countDocuments();
const bondCount = await Bond.countDocuments();
const consolidationCount = await Consolidation.countDocuments();

console.log('=== Current Status ===');
console.log('Entities:', entityCount);
console.log('Cells:', cellCount);
console.log('Bonds:', bondCount);
console.log('Consolidations:', consolidationCount);

// Check for cells with high energy
const highEnergyCells = await Cell.countDocuments({ energyLevel: { $gt: 60 }, status: 'normal' });
console.log('\nCells with energy > 60 and normal status:', highEnergyCells);

// Check for available entities
const availableEntities = await Entity.countDocuments({ currentlyBondingWith: null });
console.log('Available entities (not bonding):', availableEntities);

// Check recent cells
const recentCells = await Cell.find().sort({ _id: -1 }).limit(5);
console.log('\nRecent cells:');
recentCells.forEach(c => console.log(`  Cell ${c.cellId}: energy=${c.energyLevel}, status=${c.status}`));

process.exit(0);
