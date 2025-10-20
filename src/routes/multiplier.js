import { Hono } from 'hono';
import { dbConnect } from '../../lib/db.js';
import Multiplier from '../../models/Multiplier.js';

export const multiplier = new Hono()
  .get('/', async (c) => {
    await dbConnect();
    const multiplier = await Multiplier.findOne();
    if (!multiplier) {
      return c.notFound('Multiplier not found');
    }
    return c.json(multiplier);
  })
  .put('/', async (c) => {
    await dbConnect();
    const data = await c.req.json();
    const updated = await Multiplier.findOneAndUpdate({}, data, { new: true, upsert: true });
    return c.json(updated);
  });