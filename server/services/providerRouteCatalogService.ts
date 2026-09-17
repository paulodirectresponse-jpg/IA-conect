import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { providerCatalogService } from './providerCatalogService.js';
import { providerPricingCatalogService } from './providerPricingCatalogService.js';

export interface SafeProviderRoute{
  model_id:string;
  provider_id:string;
  provider_name:string;
  provider_model_identifier:string;
  capabilities:string[];
}

function pricingMatches(pricing:any,providerId:string,identifier:string,capabilityId?:string){
  return pricing.some((row:any)=>{
    if(!row.verified||row.provider_id!==providerId||row.provider_model_identifier!==identifier)return false;
    if(capabilityId)return !row.capability_id||row.capability_id===capabilityId;
    return !row.capability_id;
  });
}

export const providerRouteCatalogService={
  async listSafeRoutes(capabilityId?:string):Promise<SafeProviderRoute[]>{
    const[providers,mappings,pricing]=await Promise.all([
      providerCatalogService.listProviders(),
      catalogRepository.listMappings(),
      providerPricingCatalogService.list(),
    ]);
    const providerById=new Map(providers.map(provider=>[String(provider.provider_id),provider]));
    const configured=new Map(providerRegistry.listAdapters().map(adapter=>[String(adapter.providerId),adapter.isConfigured()]));
    return mappings.flatMap(mapping=>{
      if(mapping.status!=='ACTIVE')return[];
      if(capabilityId&&mapping.capabilities?.length&&!mapping.capabilities.includes(capabilityId))return[];
      const provider=providerById.get(String(mapping.provider_id));
      if(!provider||provider.status!=='ACTIVE'||!configured.get(String(mapping.provider_id)))return[];
      if(!pricingMatches(pricing,String(mapping.provider_id),mapping.provider_model_identifier,capabilityId))return[];
      return[{
        model_id:mapping.model_id,
        provider_id:String(mapping.provider_id),
        provider_name:provider.name,
        provider_model_identifier:mapping.provider_model_identifier,
        capabilities:mapping.capabilities||[],
      }];
    });
  },
};
