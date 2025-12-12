import { dbConnect } from '../lib/db.js';
import Cell from '../models/Cell.js';

await dbConnect();

const result = await Cell.updateMany(
  { inactiveReason: 'consolidation_evolved', status: { $ne: 'inactive' } },
  { status: 'inactive' }
);

console.log(`Fixed ${result.modifiedCount} cells to inactive status.`);
process.exit(0);