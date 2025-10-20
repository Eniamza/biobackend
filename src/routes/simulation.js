import { Hono } from 'hono';
import { dbConnect } from '../../lib/db.js';
import Cell from '../../models/Cell.js';
import Bond from '../../models/Bond.js';
import Consolidation from '../../models/Consolidation.js';
import Entity from '../../models/Entity.js';
import Multiplier from '../../models/Multiplier.js';

export const simulation = new Hono()
  // Get all simulation data
  .get('/all', async (c) => {
    try {
      await dbConnect();

      // Fetch all data in parallel
      const [cells, bonds, consolidations, entities, multiplier] = await Promise.all([
        Cell.find({}).lean(),
        Bond.find({}).lean(),
        Consolidation.find({}).populate('cellIds', 'cellId status energyLevel').populate('originCellId', 'cellId').lean(),
        Entity.find({}).lean(),
        Multiplier.findOne().sort({ timestamp: -1 }).lean()
      ]);

      // Calculate stats
      const stats = {
        totalCells: cells.length,
        totalBonds: bonds.length,
        totalConsolidations: consolidations.length,
        totalEntities: entities.length,
        activeBonds: bonds.filter(bond => bond.status === 'active').length,
        formingCells: cells.filter(cell => cell.status === 'forming').length,
        dividingCells: cells.filter(cell => cell.status === 'dividing').length,
        transparentConsolidations: consolidations.filter(cons => cons.state === 'transparent').length,
        denseConsolidations: consolidations.filter(cons => cons.state === 'dense').length,
        currentMultiplier: multiplier?.multiplier || 1.0,
        marketCap: multiplier?.marketCap || 0,
        lastUpdated: new Date().toISOString()
      };

      return c.json({
        success: true,
        timestamp: new Date().toISOString(),
        stats,
        data: {
          cells,
          bonds,
          consolidations,
          entities,
          multiplier
        }
      });

    } catch (error) {
      console.error('Error fetching simulation data:', error);
      return c.json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }, 500);
    }
  })

  // Get only cells
  .get('/cells', async (c) => {
    try {
      await dbConnect();
      const cells = await Cell.find({}).lean();
      
      return c.json({
        success: true,
        count: cells.length,
        data: cells
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error.message
      }, 500);
    }
  })

  // Get only bonds
  .get('/bonds', async (c) => {
    try {
      await dbConnect();
      const bonds = await Bond.find({}).lean();
      
      return c.json({
        success: true,
        count: bonds.length,
        data: bonds
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error.message
      }, 500);
    }
  })

  // Get only consolidations
  .get('/consolidations', async (c) => {
    try {
      await dbConnect();
      const consolidations = await Consolidation.find({})
        .populate('cellIds', 'cellId status energyLevel')
        .populate('originCellId', 'cellId')
        .lean();
      
      return c.json({
        success: true,
        count: consolidations.length,
        data: consolidations
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error.message
      }, 500);
    }
  })

  // Get only entities
  .get('/entities', async (c) => {
    try {
      await dbConnect();
      const entities = await Entity.find({}).lean();
      
      return c.json({
        success: true,
        count: entities.length,
        data: entities
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error.message
      }, 500);
    }
  })

  // Get current stats only
  .get('/stats', async (c) => {
    try {
      await dbConnect();

      const [
        totalCells,
        totalBonds,
        totalConsolidations,
        totalEntities,
        activeBonds,
        formingCells,
        dividingCells,
        transparentConsolidations,
        denseConsolidations,
        multiplier
      ] = await Promise.all([
        Cell.countDocuments(),
        Bond.countDocuments(),
        Consolidation.countDocuments(),
        Entity.countDocuments(),
        Bond.countDocuments({ status: 'active' }),
        Cell.countDocuments({ status: 'forming' }),
        Cell.countDocuments({ status: 'dividing' }),
        Consolidation.countDocuments({ state: 'transparent' }),
        Consolidation.countDocuments({ state: 'dense' }),
        Multiplier.findOne().sort({ timestamp: -1 }).lean()
      ]);

      const stats = {
        totalCells,
        totalBonds,
        totalConsolidations,
        totalEntities,
        activeBonds,
        formingCells,
        dividingCells,
        transparentConsolidations,
        denseConsolidations,
        currentMultiplier: multiplier?.multiplier || 1.0,
        marketCap: multiplier?.marketCap || 0,
        lastUpdated: new Date().toISOString()
      };

      return c.json({
        success: true,
        stats
      });

    } catch (error) {
      return c.json({
        success: false,
        error: error.message
      }, 500);
    }
  });
