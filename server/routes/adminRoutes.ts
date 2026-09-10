import { Router } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { adminService } from '../services/adminService.js';
import { featureFlagService } from '../services/featureFlagService.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { assetReferenceResolver } from '../services/assetReferenceResolver.js';
import { smartRouterService } from '../services/smartRouterService.js';
import { generationRepository } from '../repositories/generationRepository.js';

export const adminRouter = Router();

adminRouter.get('/admin/dashboard-stats', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ADMIN_STATS_ERROR', message: 'Erro ao carregar estatísticas do painel.' } });
  }
});

adminRouter.get('/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const search = req.query.search as string;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = await adminService.listUsers({ search, limit, offset });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ADMIN_USERS_ERROR', message: 'Erro ao listar usuários.' } });
  }
});

adminRouter.get('/admin/users/:userId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const details = await adminService.getUserDetails(req.params.userId);
    res.json({ success: true, data: details });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message || 'Usuário não encontrado.' } });
  }
});

adminRouter.post('/admin/users/:userId/status', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const { status, reason } = req.body;

    const updated = await adminService.updateUserStatus({
      adminId: req.user!.uid,
      adminEmail: req.user!.email,
      targetUserId,
      status,
      reason: reason || 'Alteração administrativa de status',
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'STATUS_UPDATE_ERROR', message: err.message } });
  }
});

// Admin Model Registry management
adminRouter.post('/admin/models', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const saved = await catalogRepository.saveModel({
      ...req.body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'MODEL_CREATE_ERROR', message: err.message } });
  }
});

adminRouter.patch('/admin/models/:modelId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await catalogRepository.getModel(req.params.modelId);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Modelo não encontrado' } });
    }
    const updated = await catalogRepository.saveModel({
      ...existing,
      ...req.body,
      updated_at: new Date().toISOString(),
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'MODEL_UPDATE_ERROR', message: err.message } });
  }
});

// Admin Provider Registry management
adminRouter.post('/admin/providers', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const saved = await catalogRepository.saveProvider({
      ...req.body,
      is_configured: false, // Secrets never stored in registry!
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PROVIDER_CREATE_ERROR', message: err.message } });
  }
});

adminRouter.patch('/admin/providers/:providerId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await catalogRepository.getProvider(req.params.providerId);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Provedor não encontrado' } });
    }
    // is_configured is server-authoritative and cannot be spoofed by frontend
    const { is_configured: _ignored, ...allowedFields } = req.body || {};
    const updated = await catalogRepository.saveProvider({
      ...existing,
      ...allowedFields,
      is_configured: false, // In Etapa 1, adapters/secrets do not exist
      updated_at: new Date().toISOString(),
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PROVIDER_UPDATE_ERROR', message: err.message } });
  }
});

// Admin Promotions management
adminRouter.post('/admin/promotions', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const saved = await catalogRepository.savePromotion({
      ...req.body,
      verified_at: new Date().toISOString(),
    });
    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PROMOTION_ERROR', message: err.message } });
  }
});

adminRouter.patch('/admin/promotions/:promotionId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await catalogRepository.getPromotion(req.params.promotionId);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Promoção não encontrada' } });
    }
    const updated = await catalogRepository.savePromotion({
      ...existing,
      ...req.body,
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PROMOTION_ERROR', message: err.message } });
  }
});

// Admin Feature Flags management
adminRouter.get('/admin/feature-flags', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const flags = await featureFlagService.getAllFlags();
    res.json({ success: true, data: flags });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FEATURE_FLAGS_ERROR', message: 'Erro ao listar flags.' } });
  }
});

adminRouter.post('/admin/feature-flags/toggle', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { flag_key, is_enabled, reason } = req.body;
    const updated = await featureFlagService.toggleFlag({
      adminId: req.user!.uid,
      adminEmail: req.user!.email,
      flagKey: flag_key,
      isEnabled: is_enabled,
      reason: reason || 'Alteração administrativa de feature flag',
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'FLAG_TOGGLE_ERROR', message: err.message } });
  }
});

// Admin Audit Logs
adminRouter.get('/admin/audit-logs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const entityType = req.query.entity_type as string;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = await auditRepository.list({ entity_type: entityType, limit, offset });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'AUDIT_LOGS_ERROR', message: 'Erro ao carregar logs de auditoria.' } });
  }
});

// ==========================================
// STAGE 2: MODELS & CAPABILITIES
// ==========================================

adminRouter.get('/admin/storage-diagnostic', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const diagnostic = await assetReferenceResolver.runStorageDiagnostic();
    res.json({ success: true, data: diagnostic });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DIAGNOSTIC_ERROR', message: err.message } });
  }
});

/**
 * Lists recent routing logs and decisions for Smart Router audit.
 */
adminRouter.get('/admin/routing-logs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit || 50));
    const logs = await smartRouterService.listRoutingLogs(limit);
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ROUTING_LOGS_ERROR', message: err.message } });
  }
});

/**
 * Admin audit: lists all generations created across the entire platform.
 */
adminRouter.get('/admin/generations', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = Math.min(200, Number(req.query.limit || 100));
    const list = await generationRepository.listAllGenerations(limit);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ADMIN_GENERATIONS_ERROR', message: err.message } });
  }
});
