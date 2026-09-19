import { Router } from 'express';
import { providerHealthService } from './providerHealthService.js';
import { routingV2Repository } from './repository.js';

const router = Router();

// GET /admin/routing-v2/providers/health - listar health de todos os providers
router.get('/providers/health', async (req, res) => {
  try {
    const results = await providerHealthService.checkAllCore();
    res.json({
      checked_at: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    res.status(500).json({
      error: String(error?.message || error),
    });
  }
});

// GET /admin/routing-v2/providers/:id/health - check específico de um provider
router.get('/providers/:id/health', async (req, res) => {
  try {
    const result = await providerHealthService.checkByProviderId(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({
      error: String(error?.message || error),
    });
  }
});

// POST /admin/routing-v2/providers/:id/health/check - força um check imediato
router.post('/providers/:id/health/check', async (req, res) => {
  try {
    const result = await providerHealthService.checkByProviderId(req.params.id);
    res.json({
      forced_check: true,
      result,
    });
  } catch (error: any) {
    res.status(400).json({
      error: String(error?.message || error),
    });
  }
});

// GET /admin/routing-v2/health/status - resumo de health de todos os providers
router.get('/health/status', async (req, res) => {
  try {
    const providers = await routingV2Repository.listProviders();
    const status = providers.map(p => ({
      provider_id: p.provider_id,
      name: p.name,
      health_status: p.health_status,
      last_health_check_at: p.last_health_check_at,
      is_configured: Boolean(p.adapter_id),
    }));

    const summary = {
      total: status.length,
      healthy: status.filter(s => s.health_status === 'HEALTHY').length,
      degraded: status.filter(s => s.health_status === 'DEGRADED').length,
      unavailable: status.filter(s => s.health_status === 'UNAVAILABLE').length,
      unknown: status.filter(s => s.health_status === 'UNKNOWN').length,
      checked_at: new Date().toISOString(),
      providers: status,
    };

    res.json(summary);
  } catch (error: any) {
    res.status(500).json({
      error: String(error?.message || error),
    });
  }
});

export const routingV2HealthAdminRoutes = router;
