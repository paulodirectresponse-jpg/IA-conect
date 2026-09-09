import { handleAsNodeRequest } from 'cloudflare:node';
import express from 'express';
import { apiRouter } from '../server/routes/apiRoutes.js';
import { runtimeRouter } from '../server/routes/runtimeRoutes.js';
import { generationRuntimeRouter } from '../server/routes/generationRuntimeRoutes.js';
import { providerFinanceRouter } from '../server/routes/providerFinanceRoutes.js';
import { pricingRuntimeRouter } from '../server/routes/pricingRuntimeRoutes.js';
import { pricingSyncService } from '../server/services/pricingSyncService.js';

const app = express();

// Binary/runtime routes must be mounted before the global JSON parser so
// asset uploads keep their raw request body intact.
app.use('/api', runtimeRouter);
app.use(express.json({ limit: '4mb' }));

// Operational/admin routes are isolated from the legacy catalog endpoints.
app.use('/api', providerFinanceRouter);

// Live pricing preview must win over the legacy catalog-based preview route.
app.use('/api', pricingRuntimeRouter);

// Generation dispatch is mounted before the legacy API router so IMAGE/VIDEO
// mode reaches the engine explicitly and reference semantics remain intact.
app.use('/api', generationRuntimeRouter);
app.use('/api', apiRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ia-conect', runtime: 'cloudflare-workers', stage: 4 });
});

app.listen(3000);

export default {
  async fetch(request: Request) {
    return handleAsNodeRequest(3000, request);
  },
  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(
      pricingSyncService.runHourlySync().then((result) => {
        console.log('[PricingSync]', JSON.stringify({
          checked_at: result.checked_at,
          checked: result.checked,
          healthy: result.healthy,
          failed: result.failed,
          fx_rate: result.fx_rate,
        }));
      })
    );
  },
};
