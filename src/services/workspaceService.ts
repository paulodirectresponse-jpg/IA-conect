import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase.js';
import { apiRequest } from './apiClient.js';
import { DEFAULT_SYSTEM_PRESETS } from '../config/constants.js';
import { STUDIO_FALLBACK_MODELS, STUDIO_FALLBACK_PRICING } from '../config/studioCatalog.js';
import {
  ModelRegistryItem,
  WorkspacePreset,
  WorkspaceDraft,
  UserPreferences,
  CompiledPromptResult,
  WorkspaceReference,
  GenerationMode,
  PromptImproveObjective,
  PricingEntry,
} from '../types/index.js';

export const workspaceService = {
  async listModels(): Promise<ModelRegistryItem[]> {
    try {
      const rows = await apiRequest<ModelRegistryItem[]>('/api/catalog/models');
      return rows?.length ? rows : STUDIO_FALLBACK_MODELS;
    } catch (err) {
      console.warn('[WorkspaceService] catalog models fallback:', err);
      return STUDIO_FALLBACK_MODELS;
    }
  },

  async getModel(modelId: string): Promise<ModelRegistryItem> {
    const models = await this.listModels();
    const model = models.find((item) => item.model_id === modelId);
    if (!model) throw new Error('Modelo não encontrado.');
    return model;
  },

  async listPricing(): Promise<PricingEntry[]> {
    try {
      const rows = await apiRequest<PricingEntry[]>('/api/catalog/pricing');
      return rows?.length ? rows : STUDIO_FALLBACK_PRICING;
    } catch (err) {
      console.warn('[WorkspaceService] catalog pricing fallback:', err);
      return STUDIO_FALLBACK_PRICING;
    }
  },

  async listPresets(): Promise<WorkspacePreset[]> {
    const user = auth.currentUser;
    const presetsMap = new Map<string, WorkspacePreset>();
    for (const p of DEFAULT_SYSTEM_PRESETS) presetsMap.set(p.preset_id, p as WorkspacePreset);

    if (user) {
      try {
        const q = query(collection(db, 'workspace_presets'), where('user_id', 'in', ['system', user.uid]));
        const snap = await getDocs(q);
        snap.forEach((item) => {
          const data = item.data() as WorkspacePreset;
          presetsMap.set(data.preset_id, data);
        });
      } catch (err) {
        console.warn('[WorkspaceService] Firestore presets fallback:', err);
        try {
          const apiPresets = await apiRequest<WorkspacePreset[]>('/api/presets');
          apiPresets.forEach((p) => presetsMap.set(p.preset_id, p));
        } catch {}
      }
    }

    return Array.from(presetsMap.values()).sort((a, b) => {
      if (a.user_id === 'system' && b.user_id !== 'system') return -1;
      if (b.user_id === 'system' && a.user_id !== 'system') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  },

  async createPreset(data: Partial<WorkspacePreset>): Promise<WorkspacePreset> {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado.');
    const now = new Date().toISOString();
    const presetId = `prs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const value: WorkspacePreset = {
      preset_id: presetId,
      user_id: user.uid,
      name: (data.name || 'Novo Preset').trim(),
      description: data.description || '',
      category: data.category || 'Personalizado',
      prompt_template: data.prompt_template || '',
      negative_prompt_template: data.negative_prompt_template,
      generation_settings: data.generation_settings || {
        mode: 'TEXT_TO_VIDEO', duration_seconds: 5, resolution: '720p', aspect_ratio: '16:9',
      },
      reference_rules_template: data.reference_rules_template,
      included_asset_ids: data.included_asset_ids,
      created_at: now,
      updated_at: now,
    };
    try {
      await setDoc(doc(db, 'workspace_presets', presetId), value);
      return value;
    } catch (err) {
      console.warn('[WorkspaceService] Firestore createPreset fallback:', err);
      return apiRequest<WorkspacePreset>('/api/presets', { method: 'POST', body: JSON.stringify(value) });
    }
  },

  async deletePreset(presetId: string): Promise<void> {
    const user = auth.currentUser;
    if (user) {
      try { await deleteDoc(doc(db, 'workspace_presets', presetId)); return; }
      catch (err) { console.warn('[WorkspaceService] Firestore deletePreset fallback:', err); }
    }
    await apiRequest(`/api/presets/${presetId}`, { method: 'DELETE' });
  },

  async getLatestDraft(): Promise<WorkspaceDraft | null> {
    const user = auth.currentUser;
    if (user) {
      try {
        const q = query(collection(db, 'workspace_drafts'), where('user_id', '==', user.uid), orderBy('updated_at', 'desc'), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0].data() as WorkspaceDraft;
        const direct = await getDoc(doc(db, 'workspace_drafts', `dft_${user.uid}`));
        if (direct.exists()) return direct.data() as WorkspaceDraft;
      } catch (err) {
        console.warn('[WorkspaceService] Firestore getLatestDraft fallback:', err);
      }
    }
    try { return await apiRequest<WorkspaceDraft | null>('/api/drafts/latest'); }
    catch { return null; }
  },

  async saveDraft(draft: Partial<WorkspaceDraft>): Promise<WorkspaceDraft> {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado.');
    const draftId = draft.draft_id || `dft_${user.uid}`;
    const now = new Date().toISOString();
    const value: WorkspaceDraft = {
      draft_id: draftId,
      user_id: user.uid,
      model_id: draft.model_id || 'AUTO',
      mode: draft.mode || 'TEXT_TO_VIDEO',
      prompt: draft.prompt || '',
      negative_prompt: draft.negative_prompt,
      references: draft.references || [],
      settings: draft.settings || {
        duration_seconds: 5, resolution: '720p', aspect_ratio: '16:9', number_of_outputs: 1, seed: null,
      },
      preset_id: draft.preset_id,
      created_at: draft.created_at || now,
      updated_at: now,
    };
    try {
      await setDoc(doc(db, 'workspace_drafts', draftId), value, { merge: true });
      return value;
    } catch (err) {
      console.warn('[WorkspaceService] Firestore saveDraft fallback:', err);
      return apiRequest<WorkspaceDraft>('/api/drafts', { method: 'POST', body: JSON.stringify(value) });
    }
  },

  async deleteDraft(draftId: string): Promise<void> {
    const user = auth.currentUser;
    if (user) {
      try { await deleteDoc(doc(db, 'workspace_drafts', draftId)); return; }
      catch (err) { console.warn('[WorkspaceService] Firestore deleteDraft fallback:', err); }
    }
    await apiRequest(`/api/drafts/${draftId}`, { method: 'DELETE' });
  },

  async getUserPreferences(): Promise<UserPreferences> {
    const user = auth.currentUser;
    const defaults: UserPreferences = {
      user_id: user?.uid || 'guest', favorite_model_ids: [], recent_model_ids: [], last_used_mode: 'TEXT_TO_VIDEO', updated_at: new Date().toISOString(),
    };
    if (user) {
      try {
        const snapshot = await getDoc(doc(db, 'user_preferences', user.uid));
        if (snapshot.exists()) return snapshot.data() as UserPreferences;
        await setDoc(doc(db, 'user_preferences', user.uid), defaults);
        return defaults;
      } catch (err) { console.warn('[WorkspaceService] preferences fallback:', err); }
    }
    try { return await apiRequest<UserPreferences>('/api/user/preferences'); }
    catch { return defaults; }
  },

  async toggleFavoriteModel(modelId: string): Promise<UserPreferences> {
    const user = auth.currentUser;
    const current = await this.getUserPreferences();
    const set = new Set(current.favorite_model_ids || []);
    set.has(modelId) ? set.delete(modelId) : set.add(modelId);
    const updated = { ...current, favorite_model_ids: Array.from(set), updated_at: new Date().toISOString() };
    if (user) {
      try { await setDoc(doc(db, 'user_preferences', user.uid), updated, { merge: true }); return updated; }
      catch (err) { console.warn('[WorkspaceService] toggleFavorite fallback:', err); }
    }
    return apiRequest<UserPreferences>('/api/user/preferences/toggle-favorite', { method: 'POST', body: JSON.stringify({ model_id: modelId }) });
  },

  async trackRecentModel(modelId: string, mode?: GenerationMode): Promise<UserPreferences> {
    const user = auth.currentUser;
    const current = await this.getUserPreferences();
    const updated: UserPreferences = {
      ...current,
      recent_model_ids: [modelId, ...(current.recent_model_ids || []).filter((id) => id !== modelId)].slice(0, 5),
      last_used_mode: mode || current.last_used_mode,
      updated_at: new Date().toISOString(),
    };
    if (user) {
      try { await setDoc(doc(db, 'user_preferences', user.uid), updated, { merge: true }); return updated; }
      catch (err) { console.warn('[WorkspaceService] trackRecent fallback:', err); }
    }
    return apiRequest<UserPreferences>('/api/user/preferences/track-recent', { method: 'POST', body: JSON.stringify({ model_id: modelId, mode }) });
  },

  async compilePrompt(params: {
    original_prompt: string; references: WorkspaceReference[]; negative_prompt?: string;
    generation_settings: { model_id: string; mode: GenerationMode; duration_seconds: number; resolution: string; aspect_ratio: string; };
  }): Promise<CompiledPromptResult> {
    return apiRequest<CompiledPromptResult>('/api/workspace/compile-prompt', { method: 'POST', body: JSON.stringify(params) });
  },

  async improvePrompt(params: {
    prompt: string; objective?: PromptImproveObjective; references?: Array<{ alias: string; type?: string; category?: string }>; model_name?: string;
  }): Promise<{ original_prompt: string; improved_prompt: string; objective: PromptImproveObjective; enhancement_summary: string }> {
    return apiRequest('/api/workspace/improve-prompt', { method: 'POST', body: JSON.stringify(params) });
  },

};
