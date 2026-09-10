import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { presetRepository } from '../repositories/presetRepository.js';
import { draftRepository } from '../repositories/draftRepository.js';
import { userPreferencesRepository } from '../repositories/userPreferencesRepository.js';
import { promptCompilerService } from '../services/promptCompilerService.js';
import { promptImproveService } from '../services/promptImproveService.js';

export const workspaceRouter = Router();

workspaceRouter.get('/presets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const presets = await presetRepository.listPresets(uid);
    res.json({ success: true, data: presets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PRESETS_LIST_ERROR', message: 'Erro ao listar presets.' } });
  }
});

workspaceRouter.post('/presets', requireAuth, async (req: AuthenticatedRequest, res) => {
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

workspaceRouter.delete('/presets/:presetId', requireAuth, async (req: AuthenticatedRequest, res) => {
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

workspaceRouter.get('/drafts/latest', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const draft = await draftRepository.getLatestDraft(uid);
    res.json({ success: true, data: draft });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DRAFT_GET_ERROR', message: 'Erro ao recuperar rascunho.' } });
  }
});

workspaceRouter.post('/drafts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const saved = await draftRepository.saveDraft(uid, req.body);
    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'DRAFT_SAVE_ERROR', message: err.message } });
  }
});

workspaceRouter.delete('/drafts/:draftId', requireAuth, async (req: AuthenticatedRequest, res) => {
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

workspaceRouter.get('/user/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const prefs = await userPreferencesRepository.getPreferences(uid);
    res.json({ success: true, data: prefs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PREFS_GET_ERROR', message: 'Erro ao carregar preferências.' } });
  }
});

workspaceRouter.post('/user/preferences/toggle-favorite', requireAuth, async (req: AuthenticatedRequest, res) => {
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

workspaceRouter.post('/user/preferences/track-recent', requireAuth, async (req: AuthenticatedRequest, res) => {
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

workspaceRouter.post('/workspace/compile-prompt', requireAuth, async (req: AuthenticatedRequest, res) => {
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

workspaceRouter.post('/workspace/improve-prompt', requireAuth, async (req: AuthenticatedRequest, res) => {
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

// ==========================================
// ETAPA 3: PROVIDER ASSET STREAMING
// ==========================================

/**
 * Secure temporary asset stream endpoint for external AI providers.
 * Validates HMAC token signature and expiration.
 * Streams private asset bytes directly with appropriate MIME headers.
 */
