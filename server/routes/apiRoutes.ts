import { Router } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { authService } from '../services/authService.js';
import { walletService } from '../services/walletService.js';
import { adminService } from '../services/adminService.js';
import { pricingService } from '../services/pricingService.js';
import { featureFlagService } from '../services/featureFlagService.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { assetRepository } from '../repositories/assetRepository.js';
import { assetService } from '../services/assetService.js';
import { presetRepository } from '../repositories/presetRepository.js';
import { draftRepository } from '../repositories/draftRepository.js';
import { userPreferencesRepository } from '../repositories/userPreferencesRepository.js';
import { promptCompilerService } from '../services/promptCompilerService.js';
import { promptImproveService } from '../services/promptImproveService.js';

export const apiRouter = Router();

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.get('/feature-flags/public', async (req, res) => {
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

apiRouter.post('/auth/register-profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || req.body.email;
    const displayName = req.body.display_name || req.user!.name;
    const avatarUrl = req.body.avatar_url;

    const result = await authService.registerOrSyncProfile({
      userId: uid,
      email,
      displayName,
      avatarUrl,
    });

    const wallet = await walletService.getSummary(uid);

    res.json({
      success: true,
      data: {
        user: result.user,
        wallet,
        is_new: result.isNew,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: err.code || 'AUTH_PROFILE_ERROR', message: err.message || 'Falha ao registrar perfil.' },
    });
  }
});

apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    let user = req.userProfile;
    if (!user) {
      const syncResult = await authService.registerOrSyncProfile({
        userId: uid,
        email: req.user!.email,
        displayName: req.user!.name,
      });
      user = syncResult.user;
    }

    const wallet = await walletService.getSummary(uid);

    res.json({
      success: true,
      data: {
        user,
        wallet,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'AUTH_ME_ERROR', message: 'Erro ao carregar dados do usuário autenticado.' },
    });
  }
});

apiRouter.post('/admin/bootstrap', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const bootstrapSecret = (req.body?.bootstrap_secret || req.headers['x-bootstrap-secret']) as string | undefined;
    const updated = await authService.bootstrapFirstAdmin(uid, bootstrapSecret);
    res.json({
      success: true,
      data: {
        user: updated,
        message: 'Bootstrap concluído: você agora é Administrador da plataforma.',
      },
    });
  } catch (err: any) {
    res.status(403).json({
      success: false,
      error: { code: err.code || 'BOOTSTRAP_FORBIDDEN', message: err.message || 'Bootstrap não permitido.' },
    });
  }
});

apiRouter.get('/wallet/summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const summary = await walletService.getSummary(uid);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'WALLET_SUMMARY_ERROR', message: 'Não foi possível obter o resumo da carteira.' },
    });
  }
});

apiRouter.get('/wallet/transactions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = await walletService.listTransactions(uid, { limit, offset });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'WALLET_TRANSACTIONS_ERROR', message: 'Não foi possível carregar o histórico do ledger.' },
    });
  }
});

apiRouter.get('/catalog/models', requireAuth, async (req, res) => {
  try {
    const models = await catalogRepository.listModels();
    res.json({ success: true, data: models });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CATALOG_ERROR', message: 'Erro ao listar modelos.' } });
  }
});

apiRouter.get('/catalog/providers', requireAuth, async (req, res) => {
  try {
    const providers = await catalogRepository.listProviders();
    res.json({ success: true, data: providers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CATALOG_ERROR', message: 'Erro ao listar provedores.' } });
  }
});

apiRouter.get('/catalog/pricing', requireAuth, async (req, res) => {
  try {
    const pricing = await catalogRepository.listPricing();
    res.json({ success: true, data: pricing });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CATALOG_ERROR', message: 'Erro ao listar precificação.' } });
  }
});

apiRouter.get('/catalog/promotions', requireAuth, async (req, res) => {
  try {
    const promotions = await catalogRepository.listPromotions();
    res.json({ success: true, data: promotions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CATALOG_ERROR', message: 'Erro ao listar promoções.' } });
  }
});

// ==========================================
// ADMIN ENDPOINTS (Strictly protected)
// ==========================================

apiRouter.get('/admin/dashboard-stats', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ADMIN_STATS_ERROR', message: 'Erro ao carregar estatísticas do painel.' } });
  }
});

apiRouter.get('/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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

apiRouter.get('/admin/users/:userId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const details = await adminService.getUserDetails(req.params.userId);
    res.json({ success: true, data: details });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message || 'Usuário não encontrado.' } });
  }
});

apiRouter.post('/admin/users/:userId/status', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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

apiRouter.post('/admin/users/:userId/adjust-balance', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const { type, amount_cents, reason, idempotency_key } = req.body;

    const result = await walletService.adjustBalance({
      adminId: req.user!.uid,
      adminEmail: req.user!.email,
      targetUserId,
      type,
      amount_cents: parseInt(amount_cents, 10),
      reason,
      idempotency_key: idempotency_key || `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    const statusCode = err.code === 'WALLET_INSUFFICIENT_FUNDS' ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'ADJUST_BALANCE_ERROR',
        message: err.message || 'Não foi possível realizar o ajuste de saldo.',
      },
    });
  }
});

// Admin Model Registry management
apiRouter.post('/admin/models', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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

apiRouter.patch('/admin/models/:modelId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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
apiRouter.post('/admin/providers', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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

apiRouter.patch('/admin/providers/:providerId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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

// Admin Pricing Matrix management
apiRouter.post('/admin/pricing', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { pricing, reason, confirmed_high_variation } = req.body;
    const saved = await pricingService.savePricing({
      adminId: req.user!.uid,
      adminEmail: req.user!.email,
      pricingData: pricing,
      reason,
      confirmed_high_variation: Boolean(confirmed_high_variation),
    });
    res.json({ success: true, data: saved });
  } catch (err: any) {
    const status = err.code === 'PRICE_VARIATION_HIGH' ? 409 : 400;
    res.status(status).json({
      success: false,
      error: { code: err.code || 'PRICING_ERROR', message: err.message, diffPercent: err.diffPercent },
    });
  }
});

// Admin Promotions management
apiRouter.post('/admin/promotions', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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

apiRouter.patch('/admin/promotions/:promotionId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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
apiRouter.get('/admin/feature-flags', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const flags = await featureFlagService.getAllFlags();
    res.json({ success: true, data: flags });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FEATURE_FLAGS_ERROR', message: 'Erro ao listar flags.' } });
  }
});

apiRouter.post('/admin/feature-flags/toggle', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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
apiRouter.get('/admin/audit-logs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
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

apiRouter.get('/models', async (req, res) => {
  try {
    const models = await catalogRepository.listModels();
    res.json({ success: true, data: models });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'MODELS_LIST_ERROR', message: 'Erro ao carregar modelos.' } });
  }
});

apiRouter.get('/models/:modelId', async (req, res) => {
  try {
    const model = await catalogRepository.getModel(req.params.modelId);
    if (!model) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Modelo não encontrado.' } });
    }
    res.json({ success: true, data: model });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'MODEL_GET_ERROR', message: 'Erro ao buscar modelo.' } });
  }
});

// ==========================================
// STAGE 2: ASSETS & REFERENCES
// ==========================================

apiRouter.get('/assets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const type = req.query.type as any;
    const category = req.query.category as any;
    const search = req.query.search as string;

    const assets = await assetRepository.listUserAssets(uid, { type, category, search });
    res.json({ success: true, data: assets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ASSETS_LIST_ERROR', message: err.message || 'Erro ao listar assets.' } });
  }
});

apiRouter.post('/assets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const {
      name,
      alias,
      category,
      mime_type,
      size_bytes,
      filename,
      storage_path,
      public_url,
      width,
      height,
      duration_seconds,
    } = req.body;

    const asset = await assetService.registerAsset({
      userId: uid,
      name,
      alias,
      category,
      mime_type: mime_type || 'image/jpeg',
      size_bytes: size_bytes || 0,
      filename: filename || name || 'asset',
      storage_path,
      public_url,
      width,
      height,
      duration_seconds,
    });

    res.json({ success: true, data: asset });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'ASSET_CREATE_ERROR', message: err.message } });
  }
});

apiRouter.patch('/assets/:assetId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const assetId = req.params.assetId;
    const { name, alias, category, status, public_url } = req.body;

    const updated = await assetRepository.updateAsset(assetId, uid, {
      name,
      alias,
      category,
      status,
      public_url,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'ASSET_UPDATE_ERROR', message: err.message } });
  }
});

apiRouter.delete('/assets/:assetId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const assetId = req.params.assetId;

    await assetRepository.softDeleteAsset(assetId, uid);
    res.json({ success: true, message: 'Asset removido com sucesso.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'ASSET_DELETE_ERROR', message: err.message } });
  }
});

// ==========================================
// STAGE 2: PRESETS
// ==========================================

apiRouter.get('/presets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const presets = await presetRepository.listPresets(uid);
    res.json({ success: true, data: presets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PRESETS_LIST_ERROR', message: 'Erro ao listar presets.' } });
  }
});

apiRouter.post('/presets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const {
      name,
      description,
      category,
      prompt_template,
      negative_prompt_template,
      generation_settings,
      reference_rules_template,
      included_asset_ids,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nome do preset é obrigatório.' } });
    }

    const created = await presetRepository.createPreset(uid, {
      name: name.trim(),
      description: description || '',
      category: category || 'Personalizado',
      prompt_template: prompt_template || '',
      negative_prompt_template,
      generation_settings: generation_settings || {
        mode: 'TEXT_TO_VIDEO',
        duration_seconds: 5,
        resolution: '720p',
        aspect_ratio: '16:9',
      },
      reference_rules_template,
      included_asset_ids,
    });

    res.json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PRESET_CREATE_ERROR', message: err.message } });
  }
});

apiRouter.delete('/presets/:presetId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const presetId = req.params.presetId;

    await presetRepository.deletePreset(presetId, uid);
    res.json({ success: true, message: 'Preset excluído com sucesso.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PRESET_DELETE_ERROR', message: err.message } });
  }
});

// ==========================================
// STAGE 2: DRAFTS & AUTOSAVE
// ==========================================

apiRouter.get('/drafts/latest', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const draft = await draftRepository.getLatestDraft(uid);
    res.json({ success: true, data: draft });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DRAFT_GET_ERROR', message: 'Erro ao recuperar rascunho.' } });
  }
});

apiRouter.post('/drafts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const saved = await draftRepository.saveDraft(uid, req.body);
    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'DRAFT_SAVE_ERROR', message: err.message } });
  }
});

apiRouter.delete('/drafts/:draftId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    await draftRepository.deleteDraft(req.params.draftId, uid);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'DRAFT_DELETE_ERROR', message: err.message } });
  }
});

// ==========================================
// STAGE 2: USER PREFERENCES
// ==========================================

apiRouter.get('/user/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const prefs = await userPreferencesRepository.getPreferences(uid);
    res.json({ success: true, data: prefs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PREFS_GET_ERROR', message: 'Erro ao carregar preferências.' } });
  }
});

apiRouter.post('/user/preferences/toggle-favorite', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { model_id } = req.body;
    if (!model_id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'model_id obrigatório.' } });
    const prefs = await userPreferencesRepository.toggleFavorite(uid, model_id);
    res.json({ success: true, data: prefs });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PREFS_UPDATE_ERROR', message: err.message } });
  }
});

apiRouter.post('/user/preferences/track-recent', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { model_id, mode } = req.body;
    if (!model_id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'model_id obrigatório.' } });
    const prefs = await userPreferencesRepository.trackRecentModel(uid, model_id, mode);
    res.json({ success: true, data: prefs });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PREFS_UPDATE_ERROR', message: err.message } });
  }
});

// ==========================================
// STAGE 2: WORKSPACE (COMPILER & IMPROVER)
// ==========================================

apiRouter.post('/workspace/compile-prompt', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { original_prompt, references, negative_prompt, generation_settings } = req.body;
    if (!original_prompt || !original_prompt.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Prompt original é obrigatório.' } });
    }

    const compiled = promptCompilerService.compile({
      original_prompt,
      references: references || [],
      negative_prompt,
      generation_settings: generation_settings || {
        model_id: 'wan-2-1-video',
        mode: 'TEXT_TO_VIDEO',
        duration_seconds: 5,
        resolution: '720p',
        aspect_ratio: '16:9',
      },
    });

    res.json({ success: true, data: compiled });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'COMPILATION_ERROR', message: err.message } });
  }
});

apiRouter.post('/workspace/improve-prompt', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { prompt, objective, references, model_name } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Prompt é obrigatório para otimização.' } });
    }

    const result = await promptImproveService.improve({
      prompt,
      objective,
      references,
      model_name,
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PROMPT_IMPROVE_ERROR', message: err.message || 'Falha ao otimizar prompt.' } });
  }
});

apiRouter.post('/workspace/validate-and-preview', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const {
      model_id,
      mode,
      prompt,
      negative_prompt,
      references,
      settings,
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'O prompt é obrigatório para validação.' } });
    }

    const model = await catalogRepository.getModel(model_id || 'wan-2-1-video');
    if (!model) {
      return res.status(400).json({ success: false, error: { code: 'MODEL_NOT_FOUND', message: 'Modelo selecionado inválido.' } });
    }

    // Pricing calculation (without exposing provider costs)
    const pricings = await catalogRepository.listPricing();
    const matchingPricings = pricings.filter(
      (p) => p.active && p.model_id === model.model_id && (p.resolution === settings?.resolution || p.resolution === 'ANY' || !settings?.resolution)
    );

    const hasPricing = matchingPricings.length > 0;
    const customerPriceCents: number | null = hasPricing
      ? matchingPricings.reduce((min, curr) => curr.customer_price_cents < min.customer_price_cents ? curr : min).customer_price_cents
      : null;

    const numberOfOutputs = settings?.number_of_outputs || 1;
    const totalEstimatedCents = customerPriceCents !== null ? customerPriceCents * numberOfOutputs : null;

    // Check wallet balance
    const wallet = await walletService.getSummary(uid);
    const availableCents = wallet.available_balance_cents;
    const hasSufficientFunds = totalEstimatedCents !== null ? availableCents >= totalEstimatedCents : false;

    // Compile prompt
    const compiled = promptCompilerService.compile({
      original_prompt: prompt,
      references: references || [],
      negative_prompt,
      generation_settings: {
        model_id: model.model_id,
        mode: mode || 'TEXT_TO_VIDEO',
        duration_seconds: settings?.duration_seconds || 5,
        resolution: settings?.resolution || '720p',
        aspect_ratio: settings?.aspect_ratio || '16:9',
      },
    });

    const balanceAfter = totalEstimatedCents !== null ? availableCents - totalEstimatedCents : availableCents;

    const requestDraft = {
      request_id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      user_id: uid,
      model_id: model.model_id,
      model_name: model.name,
      mode: mode || 'TEXT_TO_VIDEO',
      prompt: prompt.trim(),
      compiled_prompt: compiled.compiled_prompt,
      prompt_compiler_version: compiled.prompt_compiler_version,
      references: references || [],
      settings: settings || {
        duration_seconds: 5,
        resolution: '720p',
        aspect_ratio: '16:9',
        number_of_outputs: 1,
      },
      has_pricing: hasPricing,
      estimated_cost_cents: totalEstimatedCents,
      customer_balance_available_cents: availableCents,
      balance_after_generation_cents: balanceAfter,
      has_sufficient_funds: hasSufficientFunds,
      created_at: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: {
        request_draft: requestDraft,
        notice: hasPricing
          ? 'Configuração e especificações validadas com sucesso. Nenhum saldo foi debitado nesta simulação.'
          : 'Configuração de preço pendente para este modelo/resolução. Não há cobrança fictícia.',
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_FAILED', message: err.message } });
  }
});
