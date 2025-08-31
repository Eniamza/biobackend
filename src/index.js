// index.js
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { entity } from './routes/entity.js';


const app = new Hono()
  .route('/api/v1/entity', entity)

const server = serve({ fetch: app.fetch, port: 8787 });
console.log('Listening on http://localhost:8787');

process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})
