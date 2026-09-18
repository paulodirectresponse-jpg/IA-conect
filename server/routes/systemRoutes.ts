import { Router } from 'express';
import { featureFlagService } from '../services/featureFlagService.js';
import { runtimeDependencyHealthService } from '../services/runtimeDependencyHealthService.js';

export const systemRouter = Router();

systemRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

systemRouter.get('/runtime-health', async (_req, res) => {
  try {
    const snapshot = await runtimeDependencyHealthService.snapshot();
    res.status(snapshot.status === 'ERROR' ? 503 : 200).json({ success: snapshot.status !== 'ERROR', data: snapshot });
  } catch (error: any) {
    console.error('[RuntimeHealth] Unexpected diagnostic failure:', error?.message || error);
    res.status(503).json({ success:false, error:{ code:'RUNTIME_HEALTH_FAILED', message:'Não foi possível verificar as dependências do runtime.' } });
  }
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
