// src/routes/entity.js
import { Hono } from 'hono';
import {dbConnect} from '../../lib/db.js'
import Entity from '../../models/Entity.js'

export const entity = new Hono()



    .get('/:id', async (c) => {
        const { id } = c.req.param();
        const db = await dbConnect();
        const entity = await Entity.findById(id);
        return c.json(entity);

    })

    
