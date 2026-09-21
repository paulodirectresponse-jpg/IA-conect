import { apiRequest, apiRequestCached, invalidateApiCache } from './apiClient.js';
import {
  ModelRegistryItem,
  WorkspacePreset,
  WorkspaceDraft,
  UserPreferences,
  CompiledPromptResult,
  WorkspaceReference,
  GenerationMode,
  PromptImproveObjective,
} from '../types/index.js';

export interface SafeModelProviderRoute{
  model_id:string;
  provider_id:string;
  provider_name:string;
  provider_model_identifier:string;
  capabilities:string[];
}

export const workspaceService={
  async listModels():Promise<ModelRegistryItem[]>{
    const rows=await apiRequestCached<ModelRegistryItem[]>('/api/catalog/models',60_000);
    return Array.isArray(rows)?rows:[];
  },

  async listModelRoutes(capabilityId?:string):Promise<SafeModelProviderRoute[]>{
    const query=capabilityId?`?capability_id=${encodeURIComponent(capabilityId)}`:'';
    return apiRequestCached<SafeModelProviderRoute[]>(`/api/catalog/model-routes${query}`,60_000);
  },

  async getModel(modelId:string):Promise<ModelRegistryItem>{
    const models=await this.listModels();
    const model=models.find((item)=>item.model_id===modelId);
    if(!model)throw new Error('Modelo não encontrado.');
    return model;
  },

  listPresets():Promise<WorkspacePreset[]>{
    return apiRequestCached<WorkspacePreset[]>('/api/presets',10_000);
  },

  async createPreset(data:Partial<WorkspacePreset>):Promise<WorkspacePreset>{
    const created=await apiRequest<WorkspacePreset>('/api/presets',{method:'POST',body:JSON.stringify(data)});
    invalidateApiCache('/api/presets');
    return created;
  },

  async deletePreset(presetId:string):Promise<void>{
    await apiRequest(`/api/presets/${encodeURIComponent(presetId)}`,{method:'DELETE'});
    invalidateApiCache('/api/presets');
  },

  getLatestDraft():Promise<WorkspaceDraft|null>{
    return apiRequest<WorkspaceDraft|null>('/api/drafts/latest');
  },

  saveDraft(draft:Partial<WorkspaceDraft>):Promise<WorkspaceDraft>{
    return apiRequest<WorkspaceDraft>('/api/drafts',{method:'POST',body:JSON.stringify(draft)});
  },

  async deleteDraft(draftId:string):Promise<void>{
    await apiRequest(`/api/drafts/${encodeURIComponent(draftId)}`,{method:'DELETE'});
  },

  getUserPreferences():Promise<UserPreferences>{
    return apiRequestCached<UserPreferences>('/api/user/preferences',10_000);
  },

  async toggleFavoriteModel(modelId:string):Promise<UserPreferences>{
    const next=await apiRequest<UserPreferences>('/api/user/preferences/toggle-favorite',{method:'POST',body:JSON.stringify({model_id:modelId})});
    invalidateApiCache('/api/user/preferences');
    return next;
  },

  async trackRecentModel(modelId:string,mode?:GenerationMode):Promise<UserPreferences>{
    const next=await apiRequest<UserPreferences>('/api/user/preferences/track-recent',{method:'POST',body:JSON.stringify({model_id:modelId,mode})});
    invalidateApiCache('/api/user/preferences');
    return next;
  },

  compilePrompt(params:{
    original_prompt:string;
    references:WorkspaceReference[];
    negative_prompt?:string;
    generation_settings:{model_id:string;mode:GenerationMode;duration_seconds:number;resolution:string;aspect_ratio:string};
  }):Promise<CompiledPromptResult>{
    return apiRequest<CompiledPromptResult>('/api/workspace/compile-prompt',{method:'POST',body:JSON.stringify(params)});
  },

  improvePrompt(params:{
    prompt:string;
    objective?:PromptImproveObjective;
    references?:Array<{alias:string;type?:string;category?:string}>;
    model_name?:string;
  }):Promise<{original_prompt:string;improved_prompt:string;objective:PromptImproveObjective;enhancement_summary:string}>{
    return apiRequest('/api/workspace/improve-prompt',{method:'POST',body:JSON.stringify(params)});
  },
};
