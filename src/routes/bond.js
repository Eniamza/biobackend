import { Hono } from 'hono';
import { dbConnect } from '../../lib/db.js';
import Bond from '../../models/Bond.js';
import mongoose from 'mongoose';

export const bond = new Hono()
  .get('/:id', async (c) => {
    const { id } = c.req.param();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return c.text('Invalid bond ID', 400);
    }
    const db = await dbConnect();
    const bond = await Bond.findById(id);

    if (!bond) {
      return c.notFound('Bond not found');
    }

    return c.json(bond);
  });