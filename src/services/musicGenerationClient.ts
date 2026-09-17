import { apiRequest } from './apiClient.js';

export type MusicJobStatus='DRAFT'|'QUOTED'|'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
export interface MusicCapability{ id:string; controls:string[]; supported_durations?:number[]; }
export interface MusicProviderOption{provider_id:string;name:string;}
export interface MusicModel{ model_id:string; name:string; category:string; supported_durations?:number[]; capabilities:MusicCapability[]; providers?:MusicProviderOption[]; }
export interface MusicJob{
  job_id:string;
  status:MusicJobStatus;
  request:any;
  quote?:{credit_price:number;selected_model_id:string;routing_mode:'MANUAL'|'AUTO';expires_at:string}|null;
  error_message?:string|null;
  result_asset_ids?:string[];
}

function key(scope:string){
  const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `music:${scope}:${id}`;
}
function mutation(jobId:string,path:string,scope:string){
  return apiRequest<MusicJob>(`/api/music/jobs/${encodeURIComponent(jobId)}/${path}`,{
    method:'POST',headers:{'Idempotency-Key':key(scope)},
  });
}

export const musicGenerationClient={
  async catalog(){
    const data=await apiRequest<{models:MusicModel[]}>('/api/music/catalog');
    return data.models||[];
  },
  create(request:{model_id:string;prompt:string;controls:{duration_seconds:number;instrumental:boolean;output_format:string;seed?:number|null;pricing_options?:Record<string,string|number|boolean|null|undefined>}}){
    return apiRequest<MusicJob>('/api/music/jobs',{
      method:'POST',headers:{'Idempotency-Key':key('create')},body:JSON.stringify(request),
    });
  },
  get(jobId:string){return apiRequest<MusicJob>(`/api/music/jobs/${encodeURIComponent(jobId)}`);},
  quote(jobId:string){return mutation(jobId,'quote','quote');},
  queue(jobId:string){return mutation(jobId,'queue','queue');},
};
