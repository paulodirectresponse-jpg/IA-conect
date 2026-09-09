import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import { apiRouter } from '../server/routes/apiRoutes.js';
import { runtimeRouter } from '../server/routes/runtimeRoutes.js';
import { generationRuntimeRouter } from '../server/routes/generationRuntimeRoutes.js';
import { providerFinanceRouter } from '../server/routes/providerFinanceRoutes.js';

const app = express();

// Binary/runtime routes must be mounted before the global JSON parser so
// asset uploads keep their raw request body intact.
app.use('/api', runtimeRouter);
app.use(express.json({ limit: '4mb' }));

// Operational/admin routes are isolated from the legacy catalog endpoints.
app.use('/api', providerFinanceRouter);

// Generation dispatch is mounted before the legacy API router so IMAGE/VIDEO
// mode reaches the engine explicitly and reference semantics remain intact.
app.use('/api', generationRuntimeRouter);
app.use('/api', apiRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ia-conect', runtime: 'cloudflare-workers', stage: 4 });
});

app.listen(3000);

export default httpServerHandler({ port: 3000 });
