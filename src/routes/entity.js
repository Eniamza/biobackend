import { Hono } from 'hono';
import { dbConnect } from '../../lib/db.js';
import Entity from '../../models/Entity.js';
import mongoose from 'mongoose';

export const entity = new Hono()
  .get('/:id', async (c) => {
    const { id } = c.req.param();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return c.text('Invalid entity ID', 400);
    }
    const db = await dbConnect();
    const entity = await Entity.findById(id);

    if (!entity) {
      return c.notFound('Entity not found');
    }

    return c.json(entity);
  });