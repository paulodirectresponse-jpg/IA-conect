import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import { apiRouter } from '../server/routes/apiRoutes.js';
import { runtimeRouter } from '../server/routes/runtimeRoutes.js';

const app = express();

// Binary/runtime routes must be mounted before the global JSON parser so
// asset uploads keep their raw request body intact.
app.use('/api', runtimeRouter);
app.use(express.json({ limit: '4mb' }));
app.use('/api', apiRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ia-conect', runtime: 'cloudflare-workers', stage: 3 });
});

// Cloudflare's Node HTTP compatibility layer exposes Express through a
// Worker fetch handler while keeping the existing API surface unchanged.
app.listen(3000);

export default httpServerHandler({ port: 3000 });
