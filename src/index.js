// index.js
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { entity } from './routes/entity.js';
import { cell } from './routes/cell.js';
import { consolidation } from './routes/consolidation.js';
import { bond } from './routes/bond.js';
import { simulation } from './routes/simulation.js';
import SimulationScheduler from '../services/simulationScheduler.js';



const app = new Hono()
  .route('/api/v1/entity', entity)
  .route('/api/v1/cell', cell)
  .route('/api/v1/consolidation', consolidation)
  .route('/api/v1/bond', bond)
  .route('/api/v1/simulation', simulation)

// Initialize the simulation scheduler
const scheduler = new SimulationScheduler();

const server = serve({ fetch: app.fetch, port: 8787 });
console.log('Listening on http://localhost:8787');

// Start the simulation scheduler
scheduler.start();

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  scheduler.stop();
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  scheduler.stop();
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})
