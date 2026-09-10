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
} from '../types/index.js';

export const workspaceService={
  async listModels():Promise<ModelRegistryItem[]>{
    const rows=await apiRequest<ModelRegistryItem[]>('/api/catalog/models');
    if(!Array.isArray(rows)||!rows.length)throw new Error('Catálogo de modelos indisponível.');
    return rows;
  },

  async getModel(modelId:string):Promise<ModelRegistryItem>{
    const models=await this.listModels();
    const model=models.find((item)=>item.model_id===modelId);
    if(!model)throw new Error('Modelo não encontrado.');
    return model;
  },

  listPresets():Promise<WorkspacePreset[]>{
    return apiRequest<WorkspacePreset[]>('/api/presets');
  },

  createPreset(data:Partial<WorkspacePreset>):Promise<WorkspacePreset>{
    return apiRequest<WorkspacePreset>('/api/presets',{method:'POST',body:JSON.stringify(data)});
  },

  async deletePreset(presetId:string):Promise<void>{
    await apiRequest(`/api/presets/${encodeURIComponent(presetId)}`,{method:'DELETE'});
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
    return apiRequest<UserPreferences>('/api/user/preferences');
  },

  toggleFavoriteModel(modelId:string):Promise<UserPreferences>{
    return apiRequest<UserPreferences>('/api/user/preferences/toggle-favorite',{method:'POST',body:JSON.stringify({model_id:modelId})});
  },

  trackRecentModel(modelId:string,mode?:GenerationMode):Promise<UserPreferences>{
    return apiRequest<UserPreferences>('/api/user/preferences/track-recent',{method:'POST',body:JSON.stringify({model_id:modelId,mode})});
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
