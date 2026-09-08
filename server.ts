import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/apiRoutes.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser for JSON requests with standard size limit
  app.use(express.json({ limit: '2mb' }));

  // Mount backend API routes FIRST
  app.use('/api', apiRouter);

  // Health route
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ai-generation-foundation-stage1' });
  });

  // Vite middleware in development vs static file serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Platform Stage 1] Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error during server startup:', err);
  process.exit(1);
});
