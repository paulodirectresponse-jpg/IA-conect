import { Router } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { pricingSyncService } from '../services/pricingSyncService.js';

export const adminPricingRuntimeRouter = Router();

adminPricingRuntimeRouter.get('/admin/pricing/live', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    let result = await pricingSyncService.getLatestSnapshot();
    if (!result.rows.length) result = await pricingSyncService.runHourlySync();
    return res.json({ success:true, data:result });
  } catch (err:any) {
    console.error('[AdminPricingSnapshot]', err?.message || err);
    return res.status(500).json({ success:false, error:{ code:'PRICING_SNAPSHOT_FAILED', message:err?.message || 'Não foi possível executar a verificação dos provedores.' } });
  }
});

adminPricingRuntimeRouter.post('/admin/pricing/sync', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const result = await pricingSyncService.runHourlySync();
    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[AdminPricingSync]', err?.message || err);
    return res.status(500).json({
      success: false,
      error: {
        code: err?.code || 'PRICING_SYNC_FAILED',
        message: err?.message || 'Não foi possível atualizar os preços agora.',
      },
    });
  }
});
