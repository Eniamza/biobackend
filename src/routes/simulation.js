import { Hono } from 'hono';
import { dbConnect } from '../../lib/db.js';
import Cell from '../../models/Cell.js';
import Bond from '../../models/Bond.js';
import Consolidation from '../../models/Consolidation.js';
import Entity from '../../models/Entity.js';
import Multiplier from '../../models/Multiplier.js';

let activeAllCacheString = null;
let activeAllCacheTime = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes in milliseconds
let isUpdatingCache = false;

const updateActiveAllCache = async () => {
  if (isUpdatingCache) return;
  isUpdatingCache = true;
  try {
    const now = Date.now();
    await dbConnect();

    // Fetch all active data in parallel
    const [cells, bonds, consolidations, entities, multiplier] = await Promise.all([
      Cell.find({
        status: { $in: ['normal', 'forming', 'dividing'] },
        inactiveReason: { $ne: 'consolidation_evolved' }
      }).select('level energyLevel consolidationId status').lean(),
      Bond.find({ status: 'active' }).select('entityA entityB status').lean(),
      Consolidation.find({ state: { $in: ['transparent', 'dense'] } })
        .select('consolidationId cellIds state').lean(),
      Entity.find({}).select('entityId trait originTimestamp age').lean(),
      Multiplier.findOne().sort({ timestamp: -1 }).lean()
    ]);

    // Calculate stats
    const stats = {
      totalCells: cells.length,
      totalBonds: bonds.length,
      totalConsolidations: consolidations.length,
      totalEntities: entities.length,
      activeBonds: bonds.length,
      formingCells: cells.filter(cell => cell.status === 'forming').length,
      dividingCells: cells.filter(cell => cell.status === 'dividing').length,
      transparentConsolidations: consolidations.filter(cons => cons.state === 'transparent').length,
      denseConsolidations: consolidations.filter(cons => cons.state === 'dense').length,
      currentMultiplier: multiplier?.multiplier || 1.0,
      marketCap: multiplier?.marketCap || 0,
      lastUpdated: new Date().toISOString()
    };

    const responseData = {
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
    };

    activeAllCacheString = JSON.stringify(responseData);
    activeAllCacheTime = now;
    console.log(`[Cache] /active/all cache refreshed successfully.`);
  } catch (error) {
    console.error('Error background updating active cache:', error);
  } finally {
    isUpdatingCache = false;
  }
};

// Initial background update and periodic interval checking
updateActiveAllCache();
setInterval(() => {
  const now = Date.now();
  if (!activeAllCacheTime || (now - activeAllCacheTime >= CACHE_TTL)) {
    updateActiveAllCache();
  }
}, 10000); // Check every 10 seconds if it needs updating

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
  })

  // Get all active data (cells, bonds, consolidations)
  .get('/active/all', async (c) => {
    try {
      if (!activeAllCacheString) {
        // Fallback waiting for cache or building on the fly if incredibly eager
        await updateActiveAllCache();
      }

      if (activeAllCacheString) {
        c.header('Content-Type', 'application/json; charset=utf-8');
        return c.body(activeAllCacheString);
      }

      return c.json({ success: false, error: 'Cache warm-up failed' }, 500);
    } catch (error) {
      console.error('Error serving active data cache:', error);
      return c.json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }, 500);
    }
  })

  // Get active cells only
  .get('/active/cells', async (c) => {
    try {
      await dbConnect();
      const cells = await Cell.find({
        status: { $in: ['normal', 'forming', 'dividing'] },
        inactiveReason: { $ne: 'consolidation_evolved' }
      }).lean();

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

  // Get active consolidations only
  .get('/active/consolidations', async (c) => {
    try {
      await dbConnect();
      const consolidations = await Consolidation.find({ state: { $in: ['transparent', 'dense'] } })
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

  // Get active bonds only
  .get('/active/bonds', async (c) => {
    try {
      await dbConnect();
      const bonds = await Bond.find({ status: 'active' }).lean();

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
  });
