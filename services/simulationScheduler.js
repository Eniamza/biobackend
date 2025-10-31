import cron from 'node-cron';
import { dbConnect } from '../lib/db.js';
import Cell from '../models/Cell.js';
import Consolidation from '../models/Consolidation.js';
import Entity from '../models/Entity.js';
import Multiplier from '../models/Multiplier.js';
import Bond from '../models/Bond.js';

class SimulationScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null; // Using setInterval instead of cron
    // Entities are now only created through consolidation evolution (not direct generation)
    this.traitOptions = [
      'strength', 'intelligence', 'agility', 'resilience', 'creativity',
      'adaptability', 'energy', 'speed', 'endurance', 'wisdom'
    ];
  }

  getRandomTrait() {
    return this.traitOptions[Math.floor(Math.random() * this.traitOptions.length)];
  }

  async getNextEntityId() {
    const lastEntity = await Entity.findOne().sort({ entityId: -1 });
    return lastEntity ? lastEntity.entityId + 1 : 1;
  }

  async getNextConsolidationId() {
    const lastConsolidation = await Consolidation.findOne().sort({ consolidationId: -1 });
    return lastConsolidation ? lastConsolidation.consolidationId + 1 : 1;
  }

  async debugCellStatus() {
    try {
      const cells = await Cell.find().select('cellId status energyLevel consolidationId').limit(5);
      
      console.log('🔍 Sample cell status:');
      for (const cell of cells) {
        console.log(`  Cell ${cell.cellId}: status=${cell.status}, energy=${cell.energyLevel}, consolidation=${cell.consolidationId || 'NONE'}`);
      }
      
      const cellsWithConsolidation = await Cell.countDocuments({ consolidationId: { $exists: true, $ne: null } });
      const cellsWithoutConsolidation = await Cell.countDocuments({ $or: [{ consolidationId: { $exists: false } }, { consolidationId: null }] });
      
      console.log(`  Cells with consolidation: ${cellsWithConsolidation}`);
      console.log(`  Cells without consolidation: ${cellsWithoutConsolidation}`);
      
    } catch (error) {
      console.error('Error debugging cells:', error);
    }
  }

  async fixExistingCells() {
    try {
      await dbConnect();
      
      // Find cells without consolidationId
      const orphanedCells = await Cell.find({
        $or: [
          { consolidationId: { $exists: false } },
          { consolidationId: null }
        ]
      });
      
      if (orphanedCells.length === 0) {
        console.log('✅ All cells have consolidations');
        return;
      }
      
      console.log(`🔧 Found ${orphanedCells.length} cells without consolidations`);
      
      // Get existing consolidations or create one if none exist
      let consolidations = await Consolidation.find().sort({ consolidationId: 1 });
      
      if (consolidations.length === 0) {
        console.log('📦 Creating initial consolidation...');
        const consolidationId = await this.getNextConsolidationId();
        const newConsolidation = new Consolidation({
          consolidationId: consolidationId,
          cellIds: [],
          state: 'transparent'
        });
        const savedConsolidation = await newConsolidation.save();
        consolidations = [savedConsolidation];
      }
      
      // Group cells by consolidation for proper ID assignment
      const consolidationGroups = {};
      for (let i = 0; i < orphanedCells.length; i++) {
        const consolidationIndex = i % consolidations.length;
        const consolidation = consolidations[consolidationIndex];
        
        if (!consolidationGroups[consolidation._id]) {
          consolidationGroups[consolidation._id] = {
            consolidation: consolidation,
            cells: []
          };
        }
        consolidationGroups[consolidation._id].cells.push(orphanedCells[i]);
      }
      
      // Assign cells to consolidations with proper IDs
      for (const [consolidationId, group] of Object.entries(consolidationGroups)) {
        const { consolidation, cells } = group;
        
        // Get highest existing cell ID in this consolidation
        const existingCells = await Cell.find({ 
          consolidationId: consolidation._id 
        }).sort({ cellId: -1 });
        
        let nextCellId = existingCells.length > 0 ? existingCells[0].cellId + 1 : 0;
        
        for (const cell of cells) {
          cell.consolidationId = consolidation._id;
          cell.cellId = nextCellId++; // Assign consolidation-specific ID
          await cell.save();
          
          // Add cell to consolidation's cellIds array
          await Consolidation.findByIdAndUpdate(
            consolidation._id,
            { $push: { cellIds: cell._id } }
          );
          
          console.log(`✅ Assigned cell to consolidation ${consolidation.consolidationId} as Cell ${cell.cellId}`);
        }
      }
      
    } catch (error) {
      console.error('Error fixing cells:', error);
    }
  }

  async regenerateCellEnergy() {
    try {
      // Increase energy for all normal cells (simulating feeding/rest)
      const energyBoost = 10; // Gain 10 energy per cycle
      
      await Cell.updateMany(
        { 
          status: 'normal',
          energyLevel: { $lt: 100 } // Don't exceed 100
        },
        { 
          $inc: { energyLevel: energyBoost }
        }
      );
      
      // Cap energy at 100
      await Cell.updateMany(
        { energyLevel: { $gt: 100 } },
        { $set: { energyLevel: 100 } }
      );
      
      const boostedCount = await Cell.countDocuments({ status: 'normal', energyLevel: { $lte: 90 } });
      if (boostedCount > 0) {
        console.log(`⚡ Regenerated energy for ${boostedCount} cells (+${energyBoost} energy)`);
      }
    } catch (error) {
      console.error('Error regenerating energy:', error);
    }
  }

  async bootstrapSimulation() {
    try {
      await dbConnect();
      
      // Check if we need to bootstrap
      const consolidationCount = await Consolidation.countDocuments();
      const cellCount = await Cell.countDocuments();
      
      if (consolidationCount > 0 || cellCount > 0) {
        console.log('✅ Consolidations/cells already exist, skipping bootstrap');
        return;
      }
      
      console.log('🚀 Bootstrapping simulation with initial consolidations and cells...');
      
      // Create 5 initial consolidations, each with 10-20 cells
      for (let i = 0; i < 5; i++) {
        const consolidationId = await this.getNextConsolidationId();
        
        // Create consolidation
        const newConsolidation = new Consolidation({
          consolidationId: consolidationId,
          cellIds: [],
          state: 'transparent'
        });
        
        const savedConsolidation = await newConsolidation.save();
        
        // Create 10-20 cells for this consolidation
        const cellCount = Math.floor(Math.random() * 11) + 10; // 10-20 cells
        const cellIds = [];
        
        for (let j = 0; j < cellCount; j++) {
          const cell = new Cell({
            cellId: j, // Consolidation-specific ID starting from 0
            consolidationId: savedConsolidation._id,
            parentEntityIds: [], // Bootstrap cells have no parent entities
            potentialTrait: this.getRandomTrait(),
            energyLevel: Math.floor(Math.random() * 40) + 60, // 60-100 energy
            status: 'normal'
          });
          
          const savedCell = await cell.save();
          cellIds.push(savedCell._id);
        }
        
        // Update consolidation with cell IDs
        savedConsolidation.cellIds = cellIds;
        if (cellIds.length > 0) {
          savedConsolidation.originCellId = cellIds[0]; // First cell is origin
        }
        await savedConsolidation.save();
        
        console.log(`📦 Created consolidation ${consolidationId} with ${cellCount} cells (Cell 0 to Cell ${cellCount - 1})`);
      }
      
      console.log('✅ Bootstrap complete! Created 5 consolidations with cells ready to divide');
    } catch (error) {
      console.error('Error bootstrapping simulation:', error);
    }
  }

  async generateBonds() {
    try {
      // Get entities that are not currently bonding
      const availableEntities = await Entity.find({ 
        currentlyBondingWith: null 
      }).limit(10);
      
      if (availableEntities.length < 2) {
        console.log('Not enough entities available to form bonds');
        return;
      }

      // Get current multiplier to affect bond formation chance
      const latestMultiplier = await Multiplier.findOne().sort({ createdAt: -1 });
      const multiplierValue = latestMultiplier ? latestMultiplier.multiplier : 1.0;
      
      // Base chance is 40%, multiplier scales it up to 80% (at 2.0x multiplier)
      const baseBondChance = 0.40;
      const bondChance = Math.min(0.80, baseBondChance * multiplierValue);
      
      // Random chance of bond formation - affected by multiplier
      if (Math.random() > bondChance) {
        return;
      }

      // Randomly select 2 entities to bond
      const entity1 = availableEntities[Math.floor(Math.random() * availableEntities.length)];
      let entity2 = availableEntities[Math.floor(Math.random() * availableEntities.length)];
      
      // Ensure different entities
      while (entity1._id.toString() === entity2._id.toString() && availableEntities.length > 1) {
        entity2 = availableEntities[Math.floor(Math.random() * availableEntities.length)];
      }

      if (entity1._id.toString() === entity2._id.toString()) {
        return;
      }

      // Create bond record
      const bond = new Bond({
        entityA: entity1.entityId,
        entityB: entity2.entityId,
        duration: Math.floor(Math.random() * 300000) + 60000, // 1-5 minutes
        status: 'active'
      });

      // Update entities to show they're bonding
      entity1.currentlyBondingWith = entity2.entityId;
      entity2.currentlyBondingWith = entity1.entityId;

      await Promise.all([
        bond.save(),
        entity1.save(),
        entity2.save()
      ]);

      console.log(`🔗 Bond formed between entities ${entity1.entityId} and ${entity2.entityId} (chance: ${(bondChance * 100).toFixed(1)}% with ${multiplierValue.toFixed(2)}x multiplier)`);

      // Schedule bond completion and cell creation
      setTimeout(async () => {
        await this.completeBond(bond._id, entity1.entityId, entity2.entityId);
      }, bond.duration);

      return bond;
    } catch (error) {
      console.error('Error generating bonds:', error);
    }
  }

  async completeBond(bondId, entityAId, entityBId) {
    try {
      await dbConnect();
      
      // Create a new cell from the completed bond (this becomes Cell 0 of new consolidation)
      const newCell = new Cell({
        cellId: 0, // Always Cell 0 for new consolidation from bond
        parentEntityIds: [entityAId, entityBId],
        potentialTrait: this.getRandomTrait(),
        energyLevel: Math.floor(Math.random() * 50) + 50, // 50-100 energy
        status: 'forming' // Initially in forming state
      });

      const savedCell = await newCell.save();

      // Create new consolidation with this cell as origin
      const newConsolidationId = await this.getNextConsolidationId();
      const newConsolidation = new Consolidation({
        consolidationId: newConsolidationId,
        originCellId: savedCell._id,
        cellIds: [savedCell._id],
        state: 'transparent'
      });

      const savedConsolidation = await newConsolidation.save();

      // Update cell with consolidation reference
      savedCell.consolidationId = savedConsolidation._id;
      savedCell.status = 'normal'; // Now ready for division
      await savedCell.save();

      // Update bond status
      await Bond.findByIdAndUpdate(bondId, {
        status: 'completed',
        resultingCellId: savedCell._id
      });

      // Free up entities and update bond history
      await Entity.updateMany(
        { entityId: { $in: [entityAId, entityBId] } },
        { 
          currentlyBondingWith: null,
          $push: {
            bondHistory: {
              partnerEntityId: entityAId === entityAId ? entityBId : entityAId,
              cellsProduced: 1
            }
          }
        }
      );

      console.log(`🧬 Bond completed: Created cell 0 in consolidation ${newConsolidationId} from entities ${entityAId} and ${entityBId}`);
      
    } catch (error) {
      console.error('Error completing bond:', error);
    }
  }

  async generateCells() {
    try {
      // Get current multiplier to affect cell division chance
      const latestMultiplier = await Multiplier.findOne().sort({ createdAt: -1 });
      const multiplierValue = latestMultiplier ? latestMultiplier.multiplier : 1.0;
      
      // Base chance is 50%, multiplier scales it up to 100% (at 2.0x multiplier)
      const baseDivisionChance = 0.50;
      const divisionChance = Math.min(1.0, baseDivisionChance * multiplierValue);
      
      // Get cells that might divide (high energy, normal status, within consolidations)
      const dividingCells = await Cell.find({ 
        status: 'normal', 
        energyLevel: { $gt: 40 }, // Further lowered threshold for faster divisions
        consolidationId: { $exists: true, $ne: null }
      }).limit(15); // Increased limit for more potential divisions

      if (dividingCells.length > 0) {
        console.log(`🔬 Checking ${dividingCells.length} cells for division (${(divisionChance * 100).toFixed(1)}% chance with ${multiplierValue.toFixed(2)}x multiplier)`);
      }

      for (const cell of dividingCells) {
        // Random chance of division - affected by multiplier
        if (Math.random() < divisionChance) {
          // Get consolidation to determine next cell ID within it
          const consolidation = await Consolidation.findById(cell.consolidationId).populate('cellIds');
          if (!consolidation) continue;

          // Find the highest cellId in this consolidation
          const cellsInConsolidation = await Cell.find({ 
            consolidationId: cell.consolidationId 
          }).sort({ cellId: -1 });
          
          const nextCellIdInConsolidation = cellsInConsolidation.length > 0 
            ? cellsInConsolidation[0].cellId + 1 
            : 0; // Start from 0 if no cells (which shouldn't happen)
          
          // Generate random division duration (1-6 minutes, unaffected by multiplier)
          const divisionDuration = Math.floor(Math.random() * 300000) + 60000; // 60000-360000 ms
          
          // Create placeholder cell IMMEDIATELY with status: 'forming'
          const newCell = new Cell({
            cellId: nextCellIdInConsolidation, // Use consolidation-specific ID
            parentEntityIds: cell.parentEntityIds, // Inherit parent entities
            consolidationId: cell.consolidationId,
            potentialTrait: this.getRandomTrait(),
            energyLevel: Math.floor(cell.energyLevel / 2), // Split energy
            status: 'forming', // Forming until division completes
            divisionStartTime: new Date(), // ISO timestamp
            divisionDuration: divisionDuration
          });

          const savedNewCell = await newCell.save();

          // Reduce parent cell energy and mark as dividing
          cell.energyLevel = Math.floor(cell.energyLevel / 2);
          cell.status = 'dividing';
          cell.divisionDuration = divisionDuration;
          cell.divisionStartTime = new Date();
          cell.resultingCellId = savedNewCell._id; // Reference to placeholder cell
          
          await cell.save();
          
          // Update consolidation to include placeholder cell (but it's not active yet)
          await Consolidation.findByIdAndUpdate(
            cell.consolidationId,
            { $push: { cellIds: savedNewCell._id } }
          );
          
          console.log(`🔬 Cell ${cell.cellId} started division in consolidation ${consolidation.consolidationId} (duration: ${(divisionDuration / 60000).toFixed(1)} min, resulting cell: ${nextCellIdInConsolidation})`);

          // Schedule division completion
          setTimeout(async () => {
            await this.completeDivision(cell._id, savedNewCell._id);
          }, divisionDuration);
          
          // Check if consolidation should evolve to entity
          const currentEntityCount = await Entity.countDocuments();
          const targetEntitiesPerDay = 90;
          const currentDate = new Date();
          const expectedEntitiesByNow = Math.floor(targetEntitiesPerDay * (currentDate.getHours() * 60 + currentDate.getMinutes()) / 1440);
          const boostMode = currentEntityCount < expectedEntitiesByNow * 0.8; // Boost if we're at <80% of target
          
          await this.checkConsolidationEvolution(consolidation._id, boostMode);
        }
      }
    } catch (error) {
      console.error('Error generating cells:', error);
    }
  }

  // NEW METHOD: Complete cell division
  async completeDivision(parentCellId, newCellId) {
    try {
      await dbConnect();
      
      const parentCell = await Cell.findById(parentCellId);
      const newCell = await Cell.findById(newCellId);
      
      if (!parentCell || parentCell.status !== 'dividing') {
        console.log(`⚠️ Parent cell ${parentCellId} division completion skipped - not in dividing state`);
        return;
      }

      if (!newCell) {
        console.log(`⚠️ New cell ${newCellId} not found for division completion`);
        return;
      }

      // Mark new cell as normal (fully formed and ready to divide)
      newCell.status = 'normal';
      await newCell.save();
      
      // Reset parent cell status and regenerate energy
      parentCell.status = 'normal';
      parentCell.energyLevel = Math.min(100, parentCell.energyLevel + 20);
      await parentCell.save();
      
      console.log(`✅ Cell division completed: Cell ${parentCell.cellId} → Cell ${newCell.cellId} is now normal (can divide)`);
      
    } catch (error) {
      console.error('Error completing division:', error);
    }
  }

  // Entities are now ONLY created through consolidation evolution
  // This method has been removed - entities must evolve from consolidations with 50+ cells

  async recoverStuckCells() {
    try {
      const now = new Date();
      const maxDuration = 360000; // 6 minutes (max division duration)
      const cutoffTime = new Date(now - maxDuration);
      
      // Find parent cells stuck in dividing state
      const stuckParents = await Cell.find({
        status: 'dividing',
        divisionStartTime: { $lt: cutoffTime }
      });
      
      // Find new cells stuck in forming state
      const stuckChildren = await Cell.find({
        status: 'forming',
        divisionStartTime: { $lt: cutoffTime }
      });
      
      if (stuckParents.length > 0 || stuckChildren.length > 0) {
        console.log(`🔧 Recovering ${stuckParents.length} stuck parent cells and ${stuckChildren.length} stuck child cells`);
        
        // Complete stuck divisions
        for (const parent of stuckParents) {
          if (parent.resultingCellId) {
            await this.completeDivision(parent._id, parent.resultingCellId);
          }
        }
        
        // Handle orphaned forming cells (parent lost)
        for (const child of stuckChildren) {
          child.status = 'normal';
          await child.save();
          console.log(`🔧 Recovered orphaned cell ${child.cellId}`);
        }
      }
    } catch (error) {
      console.error('Error recovering stuck cells:', error);
    }
  }

  async checkConsolidationEvolution(consolidationId, boostMode = false) {
    try {
      const consolidation = await Consolidation.findById(consolidationId).populate('cellIds');
      
      // Count only normal cells (not forming/dividing) for evolution requirement
      const normalCellsCount = await Cell.countDocuments({
        consolidationId: consolidationId,
        status: 'normal'
      });
      
      // If consolidation has 50+ normal cells, it can evolve to an entity
      // Only check transparent consolidations (not already evolving)
      if (consolidation && normalCellsCount >= 50 && consolidation.state === 'transparent') {
        // Dynamic evolution chance - boost if behind target
        const baseChance = 0.25;
        const evolutionChance = boostMode ? Math.min(0.45, baseChance * 1.8) : baseChance;
        
        if (Math.random() < evolutionChance) {
          // Mark consolidation as dense (pre-evolution state)  
          consolidation.state = 'dense';
          await consolidation.save();
          
          console.log(`🔄 Consolidation ${consolidation.consolidationId} evolved to dense state (${normalCellsCount} normal cells)`);
          
          // Schedule entity creation after some time (shorter than cycle interval)
          setTimeout(async () => {
            await this.evolveConsolidationToEntity(consolidationId);
          }, Math.random() * 120000 + 60000); // 1-3 minutes
        }
      }
    } catch (error) {
      console.error('Error checking consolidation evolution:', error);
    }
  }

  async evolveConsolidationToEntity(consolidationId) {
    try {
      await dbConnect();
      
      const consolidation = await Consolidation.findById(consolidationId);
      // Prevent duplicate evolution - only evolve if still in 'dense' state
      if (!consolidation || consolidation.state !== 'dense') {
        console.log(`⚠️ Consolidation ${consolidationId} evolution skipped - already processed`);
        return;
      }

      const newEntityId = await this.getNextEntityId();
      
      // Create new entity from consolidation
      const newEntity = new Entity({
        entityId: newEntityId,
        trait: this.getRandomTrait(),
        generation: 1 // New entities start as Gen 1
      });

      const savedEntity = await newEntity.save();
      
      // Update consolidation
      consolidation.state = 'entity_forming';
      consolidation.evolvedToEntityId = newEntityId;
      await consolidation.save();
      
      console.log(`✨ Consolidation ${consolidation.consolidationId} evolved into Entity ${newEntityId} with trait: ${savedEntity.trait}`);
      
    } catch (error) {
      console.error('Error evolving consolidation to entity:', error);
    }
  }

  async updateMultiplier() {
    try {
      // Simple logic: create random market conditions
      const marketCap = Math.floor(Math.random() * 1000000) + 100000; // 100K to 1.1M
      const multiplier = 0.5 + (Math.random() * 1.5); // 0.5 to 2.0 multiplier
      
      const newMultiplier = new Multiplier({
        marketCap,
        multiplier
      });
      
      await newMultiplier.save();
      console.log(`📈 Updated multiplier: ${multiplier.toFixed(2)}x (Market Cap: $${marketCap.toLocaleString()})`);
    } catch (error) {
      console.error('Error updating multiplier:', error);
    }
  }

  async runSimulationCycle() {
    if (this.isRunning) {
      console.log('Simulation already running, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      console.log(`\n[${new Date().toISOString()}] 🔄 Running simulation cycle...`);
      
      await dbConnect();
      
      // Debug current state
      await this.debugCellStatus();
      
      // Fix any cells without consolidations
      await this.fixExistingCells();
      
      // Recover any stuck cells from previous crashes/restarts
      await this.recoverStuckCells();
      
      // Regenerate energy for cells
      await this.regenerateCellEnergy();
      
      // Check current entity count for balancing
      const currentEntityCount = await Entity.countDocuments();
      const targetEntitiesPerDay = 90;
      const currentDate = new Date();
      const dayOfYear = Math.floor((currentDate - new Date(currentDate.getFullYear(), 0, 0)) / 86400000);
      const expectedEntitiesByNow = Math.floor(targetEntitiesPerDay * (dayOfYear + (currentDate.getHours() * 60 + currentDate.getMinutes()) / 1440));
      
      console.log(`📈 Entity Progress: ${currentEntityCount}/${expectedEntitiesByNow} expected (${targetEntitiesPerDay}/day target)`);
      
      // Update multiplier occasionally (every ~6 cycles = ~24 minutes)
      if (Math.random() < 0.16) {
        await this.updateMultiplier();
      }
      
      // Run generation processes in order
      // Note: Entities are now ONLY created through consolidation evolution
      await this.generateBonds();
      await this.generateCells();
      
      // Get current counts
      const entityCount = await Entity.countDocuments();
      const cellCount = await Cell.countDocuments();
      const normalCellCount = await Cell.countDocuments({ status: 'normal' });
      const formingCellCount = await Cell.countDocuments({ status: 'forming' });
      const dividingCellCount = await Cell.countDocuments({ status: 'dividing' });
      const consolidationCount = await Consolidation.countDocuments();
      const bondCount = await Bond.countDocuments();
      
      console.log(`📊 Current totals - Entities: ${entityCount}, Cells: ${cellCount} (${normalCellCount} normal, ${formingCellCount} forming, ${dividingCellCount} dividing), Consolidations: ${consolidationCount}, Bonds: ${bondCount}`);
      console.log('✅ Simulation cycle completed\n');
      
    } catch (error) {
      console.error('❌ Error in simulation cycle:', error);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    console.log('🚀 Starting simulation scheduler - runs every 4 minutes');
    console.log('🧬 Entities can ONLY be created through consolidation evolution (50+ cells)');
    console.log('🎯 Target: ~90 entities per day through biological evolution');
    console.log('⚡ Dynamic balancing: Boost mode activates when behind target');
    
    // Bootstrap on first start if needed
    this.bootstrapSimulation().then(() => {
      // Use setInterval instead of cron for reliability
      this.intervalId = setInterval(async () => {
        await this.runSimulationCycle();
      }, 4 * 60 * 1000); // 4 minutes in milliseconds

      // Run first cycle after bootstrap (15 seconds delay)
      setTimeout(() => {
        this.runSimulationCycle();
      }, 15000);
    });
  }

  stop() {
    console.log('🛑 Stopping simulation scheduler');
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export default SimulationScheduler;