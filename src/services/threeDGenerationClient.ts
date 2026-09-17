import { apiRequest } from './apiClient.js';
import { Asset } from '../types/index.js';

export type ThreeDCapability='text-to-3d'|'image-to-3d'|'multi-image-to-3d';
export type ThreeDJobStatus='DRAFT'|'QUOTED'|'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
export interface ThreeDProviderOption{provider_id:string;name:string;capability_ids:ThreeDCapability[];}
export interface ThreeDCapabilityView{id:ThreeDCapability;controls:string[];}
export interface ThreeDModel{model_id:string;name:string;category:string;capabilities:ThreeDCapabilityView[];providers?:ThreeDProviderOption[];}
export interface ThreeDJob{
 job_id:string;status:ThreeDJobStatus;request:any;
 quote?:{credit_price:number;selected_model_id:string;routing_mode:'MANUAL'|'AUTO';expires_at:string}|null;
 error_message?:string|null;result_asset_ids?:string[];
}

function key(scope:string){const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;return `3d:${scope}:${id}`;}
function mutation(jobId:string,path:string,scope:string){return apiRequest<ThreeDJob>(`/api/3d/jobs/${encodeURIComponent(jobId)}/${path}`,{method:'POST',headers:{'Idempotency-Key':key(scope)}});}

export const threeDGenerationClient={
 async catalog(){const data=await apiRequest<{models:ThreeDModel[]}>('/api/3d/catalog');return data.models||[];},
 create(request:{capability_id:ThreeDCapability;model_id:string;prompt:string;references:Array<{asset_id:string;slot_type:'GENERAL'}>;controls:{output_format:string;mesh_mode:'TEXTURED'|'LOW_POLY'|'GEOMETRY';pbr:boolean;target_faces:number;topology:'TRIANGLE'|'QUAD';pricing_options?:Record<string,string|number|boolean|null|undefined>}}){return apiRequest<ThreeDJob>('/api/3d/jobs',{method:'POST',headers:{'Idempotency-Key':key('create')},body:JSON.stringify(request)});},
 get(jobId:string){return apiRequest<ThreeDJob>(`/api/3d/jobs/${encodeURIComponent(jobId)}`);},
 asset(assetId:string){return apiRequest<Asset>(`/api/3d/assets/${encodeURIComponent(assetId)}`);},
 quote(jobId:string){return mutation(jobId,'quote','quote');},
 queue(jobId:string){return mutation(jobId,'queue','queue');},
};
