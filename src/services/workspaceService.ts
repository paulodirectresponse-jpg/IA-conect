import { apiRequest } from './apiClient.js';
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
} from '../types/index.js';

export const workspaceService = {
  // --- Models ---
  async listModels(): Promise<ModelRegistryItem[]> {
    return apiRequest<ModelRegistryItem[]>('/api/models');
  },

  async getModel(modelId: string): Promise<ModelRegistryItem> {
    return apiRequest<ModelRegistryItem>(`/api/models/${modelId}`);
  },

  // --- Presets ---
  async listPresets(): Promise<WorkspacePreset[]> {
    return apiRequest<WorkspacePreset[]>('/api/presets');
  },

  async createPreset(data: Partial<WorkspacePreset>): Promise<WorkspacePreset> {
    return apiRequest<WorkspacePreset>('/api/presets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deletePreset(presetId: string): Promise<void> {
    await apiRequest(`/api/presets/${presetId}`, {
      method: 'DELETE',
    });
  },

  // --- Drafts ---
  async getLatestDraft(): Promise<WorkspaceDraft | null> {
    return apiRequest<WorkspaceDraft | null>('/api/drafts/latest');
  },

  async saveDraft(draft: Partial<WorkspaceDraft>): Promise<WorkspaceDraft> {
    return apiRequest<WorkspaceDraft>('/api/drafts', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  },

  async deleteDraft(draftId: string): Promise<void> {
    await apiRequest(`/api/drafts/${draftId}`, {
      method: 'DELETE',
    });
  },

  // --- Preferences ---
  async getUserPreferences(): Promise<UserPreferences> {
    return apiRequest<UserPreferences>('/api/user/preferences');
  },

  async toggleFavoriteModel(modelId: string): Promise<UserPreferences> {
    return apiRequest<UserPreferences>('/api/user/preferences/toggle-favorite', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId }),
    });
  },

  async trackRecentModel(modelId: string, mode?: GenerationMode): Promise<UserPreferences> {
    return apiRequest<UserPreferences>('/api/user/preferences/track-recent', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId, mode }),
    });
  },

  // --- Compilation & Improve Prompt ---
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
