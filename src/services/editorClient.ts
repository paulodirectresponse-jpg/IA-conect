import { apiRequest } from './apiClient.js';
import { Asset, ModelRegistryItem } from '../types/index.js';

export type EditorCapability='image-edit'|'inpaint-mask'|'background-remove-replace'|'outpaint'|'upscale'|'variations'|'video-extend'|'video-edit';
export interface EditorCapabilityView{ id:EditorCapability; name?:string; controls?:string[]; supported_durations?:number[]; supported_resolutions?:string[]; supported_aspect_ratios?:string[]; }
export interface EditorProviderView{provider_id:string;name:string;capability_ids:EditorCapability[];}
export interface EditorModelView extends ModelRegistryItem{capabilities:EditorCapabilityView[];providers?:EditorProviderView[];}
export interface EditorJobView{job_id:string;status:'DRAFT'|'QUOTED'|'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';request:any;quote?:{credit_price:number;selected_model_id:string;routing_mode:'MANUAL'|'AUTO';expires_at:string}|null;error_message?:string|null;result_asset_ids?:string[];}

function key(scope:string){return `${scope}:${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`}`;}
function mutate(jobId:string,action:string){return apiRequest<EditorJobView>(`/api/editors/jobs/${encodeURIComponent(jobId)}/${action}`,{method:'POST',headers:{'Idempotency-Key':key(action)}});}

export const editorClient={
 async catalog(){const data=await apiRequest<{models:EditorModelView[]}>('/api/editors/catalog');return data.models||[];},
 create(request:any){return apiRequest<EditorJobView>('/api/editors/jobs',{method:'POST',headers:{'Idempotency-Key':key('editor-create')},body:JSON.stringify(request)});},
 get(jobId:string){return apiRequest<EditorJobView>(`/api/editors/jobs/${encodeURIComponent(jobId)}`);},
 quote(jobId:string){return mutate(jobId,'quote');},
 queue(jobId:string){return mutate(jobId,'queue');},
 asset(assetId:string){return apiRequest<Asset>(`/api/editors/assets/${encodeURIComponent(assetId)}`);},
};
