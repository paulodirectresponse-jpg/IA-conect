import express from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { providerFinanceService } from '../services/providerFinanceService.js';

export const providerFinanceRouter = express.Router();

providerFinanceRouter.get(
  '/admin/provider-finance',
  requireAuth,
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const force = String(req.query.refresh || '') === '1';
      const providers = await providerFinanceService.getAll(force);
      const totalBrlCents = providers.reduce((sum, item) => sum + (item.balance_brl_cents || 0), 0);
      res.json({
        success: true,
        data: {
          providers,
          total_brl_cents: totalBrlCents,
          fx_rate_usd_brl: providers[0]?.fx_rate_usd_brl || Number(process.env.PROVIDER_USD_BRL || '5.10'),
          updated_at: new Date().toISOString(),
        },
      });
    } catch (err:any) {
      res.status(500).json({
        success: false,
        error: { code:'PROVIDER_FINANCE_ERROR', message:err?.message || 'Falha ao consultar saldos dos provedores.' },
      });
    }
  }
);
