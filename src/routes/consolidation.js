import { Hono } from 'hono';
import { dbConnect } from '../../lib/db.js';
import Consolidation from '../../models/Consolidation.js';
import mongoose from 'mongoose';

export const consolidation = new Hono()
  .get('/:id', async (c) => {
    const { id } = c.req.param();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return c.text('Invalid consolidation ID', 400);
    }
    const db = await dbConnect();
    const consolidation = await Consolidation.findById(id);

    if (!consolidation) {
      return c.notFound('Consolidation not found');
    }

    return c.json(consolidation);
  });