import { Router } from 'express';
import { featureFlagService } from '../services/featureFlagService.js';

export const systemRouter = Router();

systemRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

systemRouter.get('/feature-flags/public', async (req, res) => {
  try {
    const flags = await featureFlagService.getPublicFlags();
    res.json({ success: true, data: flags });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Erro ao consultar feature flags.' } });
  }
});

// ==========================================
// AUTHENTICATED USER ENDPOINTS
// ==========================================
