export type BetaCapabilityMediaType='TEXT'|'IMAGE'|'VIDEO'|'AUDIO'|'MODEL_3D'|'MASK'|'STRUCTURED_DATA';
export interface BetaCapability {id:string;inputs:BetaCapabilityMediaType[];outputs:BetaCapabilityMediaType[];controls:string[]}
export interface BetaCapabilityModel {
  model_id:string;
  name:string;
  category:string;
  capabilities:BetaCapability[];
  supported_durations?:number[];
  supported_resolutions?:string[];
  supported_aspect_ratios?:string[];
}

export async function fetchBetaCapabilities(idToken:string):Promise<BetaCapabilityModel[]>{
  const response=await fetch('/api/beta/capabilities',{headers:{Authorization:`Bearer ${idToken}`}});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload?.success)throw new Error(payload?.error?.message||'Não foi possível carregar as capabilities Beta.');
  return Array.isArray(payload.data?.models)?payload.data.models:[];
}

export function supportsBetaCapability(model:BetaCapabilityModel|undefined,capabilityId:string){
  return Boolean(model?.capabilities.some(capability=>capability.id===capabilityId));
}
