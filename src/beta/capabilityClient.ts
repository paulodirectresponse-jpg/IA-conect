export type BetaCapabilityMediaType='TEXT'|'IMAGE'|'VIDEO'|'AUDIO'|'MODEL_3D'|'MASK'|'STRUCTURED_DATA';
export interface BetaCapability {
  id:string;
  inputs:BetaCapabilityMediaType[];
  outputs:BetaCapabilityMediaType[];
  controls:string[];
  supported_durations?:number[];
  supported_resolutions?:string[];
  supported_aspect_ratios?:string[];
  control_options?:Record<string,(string|number)[]>;
}
export interface BetaCapabilityModel {
  model_id:string;
  name:string;
  category:string;
  capabilities:BetaCapability[];
  supported_durations?:number[];
  supported_resolutions?:string[];
  supported_aspect_ratios?:string[];
}

function isRecord(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null;
}

function isCapabilityModel(value:unknown):value is BetaCapabilityModel{
  return isRecord(value)
    &&typeof value.model_id==='string'
    &&typeof value.name==='string'
    &&typeof value.category==='string'
    &&Array.isArray(value.capabilities);
}

export async function fetchBetaCapabilities(idToken:string):Promise<BetaCapabilityModel[]>{
  const response=await fetch('/api/beta/capabilities',{headers:{Authorization:`Bearer ${idToken}`}});
  const payload:unknown=await response.json().catch(()=>null);
  const root=isRecord(payload)?payload:null;
  const error=root&&isRecord(root.error)?root.error:null;
  if(!response.ok||root?.success!==true){
    throw new Error(typeof error?.message==='string'?error.message:'Não foi possível carregar as capabilities Beta.');
  }
  const data=isRecord(root.data)?root.data:null;
  return Array.isArray(data?.models)?data.models.filter(isCapabilityModel):[];
}

export function supportsBetaCapability(model:BetaCapabilityModel|undefined,capabilityId:string){
  return Boolean(model?.capabilities.some(capability=>capability.id===capabilityId));
}
