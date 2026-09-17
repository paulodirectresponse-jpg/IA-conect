import { apiRequest } from './apiClient.js';

export type VoiceJobStatus='DRAFT'|'QUOTED'|'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
export interface VoiceCapability{ id:string; controls:string[]; }
export interface VoiceProviderOption{provider_id:string;name:string;}
export interface VoiceModel{ model_id:string; name:string; category:string; capabilities:VoiceCapability[]; providers?:VoiceProviderOption[]; }
export interface VoiceJob{
  job_id:string;
  status:VoiceJobStatus;
  request:any;
  quote?:{credit_price:number;selected_model_id:string;routing_mode:'MANUAL'|'AUTO';expires_at:string}|null;
  error_message?:string|null;
  result_asset_ids?:string[];
}

function key(scope:string){
  const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `voice:${scope}:${id}`;
}
function mutation(jobId:string,path:string,scope:string){
  return apiRequest<VoiceJob>(`/api/voice/jobs/${encodeURIComponent(jobId)}/${path}`,{
    method:'POST',headers:{'Idempotency-Key':key(scope)},
  });
}

export const voiceGenerationClient={
  async catalog(){
    const data=await apiRequest<{models:VoiceModel[]}>('/api/voice/catalog');
    return data.models||[];
  },
  create(request:{model_id:string;prompt:string;controls:{language:string;voice:string;output_format:string;pricing_options?:Record<string,string|number|boolean|null|undefined>}}){
    return apiRequest<VoiceJob>('/api/voice/jobs',{
      method:'POST',headers:{'Idempotency-Key':key('create')},body:JSON.stringify(request),
    });
  },
  get(jobId:string){return apiRequest<VoiceJob>(`/api/voice/jobs/${encodeURIComponent(jobId)}`);},
  quote(jobId:string){return mutation(jobId,'quote','quote');},
  queue(jobId:string){return mutation(jobId,'queue','queue');},
};
