// index.js
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { users } from './src/routes/users.js';
import { auth } from './src/routes/auth.js';
import { posts } from './src/routes/posts/index.js';

const app = new Hono()
  .route('/api/v1/auth', auth)
  .route('/api/v1/users', users)
  .route('/api/v1/posts', posts);

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
