import { createStableLaunchSnapshot, readyCapabilitiesForModel } from './stableLaunchReadinessService.js';

export interface SafeProviderRoute{
  model_id:string;
  provider_id:string;
  provider_name:string;
  provider_model_identifier:string;
  capabilities:string[];
}

export const providerRouteCatalogService={
  async listSafeRoutes(capabilityId?:string):Promise<SafeProviderRoute[]>{
    const data=await createStableLaunchSnapshot();
    const modelById=new Map(data.models.map(model=>[model.model_id,model] as const));
    return data.mappings.flatMap(mapping=>{
      if(mapping.status!=='ACTIVE')return[];
      const model=modelById.get(mapping.model_id);
      if(!model||model.status!=='ACTIVE'||model.beta_only===true)return[];
      const ready=readyCapabilitiesForModel(model,data).map(String);
      const exposed=(model.beta_capability_ids?.length?model.beta_capability_ids.map(String):ready).filter(cap=>ready.includes(cap));
      if(capabilityId&&!exposed.includes(capabilityId))return[];
      const provider=data.providerById.get(String(mapping.provider_id));
      if(!provider||provider.status!=='ACTIVE'||!data.configured.get(String(mapping.provider_id)))return[];
      const caps=(mapping.capabilities?.length?mapping.capabilities.map(String):exposed).filter(cap=>exposed.includes(cap));
      const selected=capabilityId?caps.filter(cap=>cap===capabilityId):caps;
      if(!selected.length)return[];
      return[{model_id:mapping.model_id,provider_id:String(mapping.provider_id),provider_name:provider.name,provider_model_identifier:mapping.provider_model_identifier,capabilities:selected}];
    });
  },
};
