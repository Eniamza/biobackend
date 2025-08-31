import { Hono } from 'hono';
import { dbConnect } from '../../lib/db.js';
import Entity from '../../models/Cell.js';
import mongoose from 'mongoose';

export const cell = new Hono()
  .get('/:id', async (c) => {
    const { id } = c.req.param();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return c.text('Invalid cell ID', 400);
    }
    const db = await dbConnect();
    const cell = await Entity.findById(id);

    if (!cell) {
      return c.notFound('Cell not found');
    }

    return c.json(cell);
  });