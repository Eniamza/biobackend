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
    // Entities are now only created through consolidation evolution (not direct generation)
    this.traitOptions = [
      'strength', 'intelligence', 'agility', 'resilience', 'creativity',
      'adaptability', 'energy', 'speed', 'endurance', 'wisdom'
    ];
  }

  getRandomTrait() {
    return this.traitOptions[Math.floor(Math.random() * this.traitOptions.length)];
  }

  async getNextCellId() {
    const lastCell = await Cell.findOne().sort({ cellId: -1 });
    return lastCell ? lastCell.cellId + 1 : 1;
  }

  async getNextEntityId() {
    const lastEntity = await Entity.findOne().sort({ entityId: -1 });
    return lastEntity ? lastEntity.entityId + 1 : 1;
  }

  async getNextConsolidationId() {
    const lastConsolidation = await Consolidation.findOne().sort({ consolidationId: -1 });
    return lastConsolidation ? lastConsolidation.consolidationId + 1 : 1;
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
      const newCellId = await this.getNextCellId();
      
      const newCell = new Cell({
        cellId: 0, // This is Cell 0 of the new consolidation
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

      console.log(`🧬 Bond completed: Created cell 0 (ID: ${savedCell.cellId}) in consolidation ${newConsolidationId} from entities ${entityAId} and ${entityBId}`);
      
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
            : 1;
          
          // Create new cell from division
          const newCell = new Cell({
            cellId: nextCellIdInConsolidation,
            parentEntityIds: cell.parentEntityIds, // Inherit parent entities
            consolidationId: cell.consolidationId,
            potentialTrait: this.getRandomTrait(),
            energyLevel: Math.floor(cell.energyLevel / 2), // Split energy
            status: 'normal'
          });

          // Reduce parent cell energy and mark as dividing temporarily
          cell.energyLevel = Math.floor(cell.energyLevel / 2);
          cell.status = 'dividing';
          
          await cell.save();
          const savedNewCell = await newCell.save();
          
          // Update consolidation to include new cell
          await Consolidation.findByIdAndUpdate(
            cell.consolidationId,
            { $push: { cellIds: savedNewCell._id } }
          );

          // Reset parent cell status after short delay and regenerate some energy
          setTimeout(async () => {
            cell.status = 'normal';
            // Regenerate some energy to keep cells active
            cell.energyLevel = Math.min(100, cell.energyLevel + 20);
            await cell.save();
          }, 15000); // 15 seconds (reduced from 30)
          
          console.log(`🔬 Cell division: Cell ${cell.cellId} created new cell ${nextCellIdInConsolidation} in consolidation ${consolidation.consolidationId}`);

          // Check if consolidation should evolve to entity
          // Pass boost mode if we're behind target
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

  // Entities are now ONLY created through consolidation evolution
  // This method has been removed - entities must evolve from consolidations with 50+ cells

  async checkConsolidationEvolution(consolidationId, boostMode = false) {
    try {
      const consolidation = await Consolidation.findById(consolidationId).populate('cellIds');
      
      // If consolidation has 50+ cells, it can evolve to an entity
      // Only check transparent consolidations (not already evolving)
      if (consolidation && consolidation.cellIds.length >= 50 && consolidation.state === 'transparent') {
        // Dynamic evolution chance - boost if behind target
        const baseChance = 0.25;
        const evolutionChance = boostMode ? Math.min(0.45, baseChance * 1.8) : baseChance;
        
        if (Math.random() < evolutionChance) {
          // Mark consolidation as dense (pre-evolution state)  
          consolidation.state = 'dense';
          await consolidation.save();
          
          console.log(`🔄 Consolidation ${consolidation.consolidationId} evolved to dense state (${consolidation.cellIds.length} cells)`);
          
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
      
      console.log(`Consolidation ${consolidation.consolidationId} evolved into Entity ${newEntityId} with trait: ${savedEntity.trait}`);
      
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
      console.log(`📈 Updated multiplier: ${multiplier.toFixed(2)} (Market Cap: ${marketCap.toLocaleString()})`);
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
      const consolidationCount = await Consolidation.countDocuments();
      const bondCount = await Bond.countDocuments();
      
      console.log(`📊 Current totals - Entities: ${entityCount}, Cells: ${cellCount}, Consolidations: ${consolidationCount}, Bonds: ${bondCount}`);
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
    
    // Schedule to run every 4 minutes
    cron.schedule('*/4 * * * *', async () => {
      await this.runSimulationCycle();
    });

    // Run immediately on start for testing (after 15 seconds to allow DB connection)
    setTimeout(() => {
      this.runSimulationCycle();
    }, 15000);
  }

  stop() {
    console.log('🛑 Stopping simulation scheduler');
    cron.destroy();
  }
}

export default SimulationScheduler;
