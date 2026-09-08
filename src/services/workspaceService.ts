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
import {
  ModelRegistryItem,
  WorkspacePreset,
  WorkspaceDraft,
  UserPreferences,
  CompiledPromptResult,
  WorkspaceReference,
  GenerationMode,
  PromptImproveObjective,
  GenerationRequestDraft,
  PricingEntry,
} from '../types/index.js';

export const workspaceService = {
  // --- Models ---
  async listModels(): Promise<ModelRegistryItem[]> {
    return apiRequest<ModelRegistryItem[]>('/api/models');
  },

  async getModel(modelId: string): Promise<ModelRegistryItem> {
    return apiRequest<ModelRegistryItem>(`/api/models/${modelId}`);
  },

  // --- Pricing ---
  async listPricing(): Promise<PricingEntry[]> {
    try {
      const res = await apiRequest<PricingEntry[]>('/api/catalog/pricing');
      return res || [];
    } catch {
      return [];
    }
  },

  // --- Presets (Firestore) ---
  async listPresets(): Promise<WorkspacePreset[]> {
    const user = auth.currentUser;
    const presetsMap = new Map<string, WorkspacePreset>();

    // Add default system presets first
    for (const p of DEFAULT_SYSTEM_PRESETS) {
      presetsMap.set(p.preset_id, p as WorkspacePreset);
    }

    if (user) {
      try {
        const presetsCol = collection(db, 'workspace_presets');
        const q = query(presetsCol, where('user_id', 'in', ['system', user.uid]));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const data = d.data() as WorkspacePreset;
          presetsMap.set(data.preset_id, data);
        });
      } catch (fsErr) {
        console.warn('[WorkspaceService] Firestore presets fallback:', fsErr);
        try {
          const apiPresets = await apiRequest<WorkspacePreset[]>('/api/presets');
          for (const p of apiPresets) {
            presetsMap.set(p.preset_id, p);
          }
        } catch {
          // Keep defaults
        }
      }
    }

    const list = Array.from(presetsMap.values());
    return list.sort((a, b) => {
      if (a.user_id === 'system' && b.user_id !== 'system') return -1;
      if (b.user_id === 'system' && a.user_id !== 'system') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  },

  async createPreset(data: Partial<WorkspacePreset>): Promise<WorkspacePreset> {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado.');

    const presetId = `prs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newPreset: WorkspacePreset = {
      preset_id: presetId,
      user_id: user.uid,
      name: (data.name || 'Novo Preset').trim(),
      description: data.description || '',
      category: data.category || 'Personalizado',
      prompt_template: data.prompt_template || '',
      negative_prompt_template: data.negative_prompt_template,
      generation_settings: data.generation_settings || {
        mode: 'TEXT_TO_VIDEO',
        duration_seconds: 5,
        resolution: '720p',
        aspect_ratio: '16:9',
      },
      reference_rules_template: data.reference_rules_template,
      included_asset_ids: data.included_asset_ids,
      created_at: now,
      updated_at: now,
    };

    try {
      await setDoc(doc(db, 'workspace_presets', presetId), newPreset);
    } catch (err) {
      console.warn('[WorkspaceService] Firestore createPreset fallback to API:', err);
      return apiRequest<WorkspacePreset>('/api/presets', {
        method: 'POST',
        body: JSON.stringify(newPreset),
      });
    }

    return newPreset;
  },

  async deletePreset(presetId: string): Promise<void> {
    const user = auth.currentUser;
    if (user) {
      try {
        await deleteDoc(doc(db, 'workspace_presets', presetId));
        return;
      } catch (err) {
        console.warn('[WorkspaceService] Firestore deletePreset fallback to API:', err);
      }
    }

    await apiRequest(`/api/presets/${presetId}`, {
      method: 'DELETE',
    });
  },

  // --- Drafts (Firestore) ---
  async getLatestDraft(): Promise<WorkspaceDraft | null> {
    const user = auth.currentUser;
    if (user) {
      try {
        const draftsCol = collection(db, 'workspace_drafts');
        const q = query(
          draftsCol,
          where('user_id', '==', user.uid),
          orderBy('updated_at', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs[0].data() as WorkspaceDraft;
        }

        // Direct user draft doc fallback
        const singleDoc = await getDoc(doc(db, 'workspace_drafts', `dft_${user.uid}`));
        if (singleDoc.exists()) {
          return singleDoc.data() as WorkspaceDraft;
        }
      } catch (err) {
        console.warn('[WorkspaceService] Firestore getLatestDraft fallback to API:', err);
      }
    }

    try {
      return await apiRequest<WorkspaceDraft | null>('/api/drafts/latest');
    } catch {
      return null;
    }
  },

  async saveDraft(draft: Partial<WorkspaceDraft>): Promise<WorkspaceDraft> {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado.');

    const draftId = draft.draft_id || `dft_${user.uid}`;
    const now = new Date().toISOString();

    const fullDraft: WorkspaceDraft = {
      draft_id: draftId,
      user_id: user.uid,
      model_id: draft.model_id || 'wan-2-1-video',
      mode: draft.mode || 'TEXT_TO_VIDEO',
      prompt: draft.prompt || '',
      negative_prompt: draft.negative_prompt,
      references: draft.references || [],
      settings: draft.settings || {
        duration_seconds: 5,
        resolution: '720p',
        aspect_ratio: '16:9',
        number_of_outputs: 1,
        seed: null,
      },
      preset_id: draft.preset_id,
      created_at: draft.created_at || now,
      updated_at: now,
    };

    try {
      await setDoc(doc(db, 'workspace_drafts', draftId), fullDraft, { merge: true });
    } catch (err) {
      console.warn('[WorkspaceService] Firestore saveDraft fallback to API:', err);
      return apiRequest<WorkspaceDraft>('/api/drafts', {
        method: 'POST',
        body: JSON.stringify(fullDraft),
      });
    }

    return fullDraft;
  },

  async deleteDraft(draftId: string): Promise<void> {
    const user = auth.currentUser;
    if (user) {
      try {
        await deleteDoc(doc(db, 'workspace_drafts', draftId));
        return;
      } catch (err) {
        console.warn('[WorkspaceService] Firestore deleteDraft fallback to API:', err);
      }
    }

    await apiRequest(`/api/drafts/${draftId}`, {
      method: 'DELETE',
    });
  },

  // --- User Preferences (Firestore) ---
  async getUserPreferences(): Promise<UserPreferences> {
    const user = auth.currentUser;
    const defaultPrefs: UserPreferences = {
      user_id: user?.uid || 'guest',
      favorite_model_ids: ['wan-2-1-video'],
      recent_model_ids: ['wan-2-1-video', 'kling-v1-5'],
      last_used_mode: 'TEXT_TO_VIDEO',
      updated_at: new Date().toISOString(),
    };

    if (user) {
      try {
        const prefDoc = await getDoc(doc(db, 'user_preferences', user.uid));
        if (prefDoc.exists()) {
          return prefDoc.data() as UserPreferences;
        } else {
          // Initialize in Firestore
          await setDoc(doc(db, 'user_preferences', user.uid), defaultPrefs);
          return defaultPrefs;
        }
      } catch (err) {
        console.warn('[WorkspaceService] Firestore getUserPreferences fallback to API:', err);
      }
    }

    try {
      return await apiRequest<UserPreferences>('/api/user/preferences');
    } catch {
      return defaultPrefs;
    }
  },

  async toggleFavoriteModel(modelId: string): Promise<UserPreferences> {
    const user = auth.currentUser;
    const current = await this.getUserPreferences();
    const set = new Set(current.favorite_model_ids || []);

    if (set.has(modelId)) {
      set.delete(modelId);
    } else {
      set.add(modelId);
    }

    const updated: UserPreferences = {
      ...current,
      favorite_model_ids: Array.from(set),
      updated_at: new Date().toISOString(),
    };

    if (user) {
      try {
        await setDoc(doc(db, 'user_preferences', user.uid), updated, { merge: true });
        return updated;
      } catch (err) {
        console.warn('[WorkspaceService] Firestore toggleFavorite fallback to API:', err);
      }
    }

    return apiRequest<UserPreferences>('/api/user/preferences/toggle-favorite', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId }),
    });
  },

  async trackRecentModel(modelId: string, mode?: GenerationMode): Promise<UserPreferences> {
    const user = auth.currentUser;
    const current = await this.getUserPreferences();
    const recents = [modelId, ...(current.recent_model_ids || []).filter((id) => id !== modelId)].slice(0, 5);

    const updated: UserPreferences = {
      ...current,
      recent_model_ids: recents,
      last_used_mode: mode || current.last_used_mode,
      updated_at: new Date().toISOString(),
    };

    if (user) {
      try {
        await setDoc(doc(db, 'user_preferences', user.uid), updated, { merge: true });
        return updated;
      } catch (err) {
        console.warn('[WorkspaceService] Firestore trackRecent fallback to API:', err);
      }
    }

    return apiRequest<UserPreferences>('/api/user/preferences/track-recent', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId, mode }),
    });
  },

  // --- Compilation & Improve Prompt (Server routes) ---
  async compilePrompt(params: {
    original_prompt: string;
    references: WorkspaceReference[];
    negative_prompt?: string;
    generation_settings: {
      model_id: string;
      mode: GenerationMode;
      duration_seconds: number;
      resolution: string;
      aspect_ratio: string;
    };
  }): Promise<CompiledPromptResult> {
    return apiRequest<CompiledPromptResult>('/api/workspace/compile-prompt', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async improvePrompt(params: {
    prompt: string;
    objective?: PromptImproveObjective;
    references?: Array<{ alias: string; type?: string; category?: string }>;
    model_name?: string;
  }): Promise<{
    original_prompt: string;
    improved_prompt: string;
    objective: PromptImproveObjective;
    enhancement_summary: string;
  }> {
    return apiRequest('/api/workspace/improve-prompt', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async validateAndPreview(params: {
    model_id: string;
    mode: GenerationMode;
    prompt: string;
    negative_prompt?: string;
    references: WorkspaceReference[];
    settings: {
      duration_seconds: number;
      resolution: string;
      aspect_ratio: string;
      number_of_outputs: number;
      seed?: number | null;
      motion_strength?: number;
    };
  }): Promise<{
    request_draft: GenerationRequestDraft & {
      has_sufficient_funds: boolean;
      balance_after_generation_cents: number;
    };
    notice: string;
  }> {
    return apiRequest('/api/workspace/validate-and-preview', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};
