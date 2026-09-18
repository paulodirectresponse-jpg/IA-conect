import { ModelRegistryItem, ProviderModelMapping } from '../../src/types/index.js';
import { capabilityIdsForModel, CapabilityId } from '../beta/capabilityRegistry.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { providerCatalogService } from './providerCatalogService.js';
import { providerPricingCatalogService } from './providerPricingCatalogService.js';
import { retailPricingService } from './retailPricingService.js';
import { routePricingProfile } from './routePricingProfileService.js';
import { pricingSignatureService } from './pricingSignatureService.js';

export interface StableLaunchSnapshot{
 models:ModelRegistryItem[];
 mappings:ProviderModelMapping[];
 providerById:Map<string,any>;
 configured:Map<string,boolean>;
 pricing:any[];
 retailHashes:Set<string>;
}

function priceMatches(pricing:any[],providerId:string,identifier:string,capabilityId:string){
 return pricing.some(row=>row?.verified&&row.provider_id===providerId&&row.provider_model_identifier===identifier&&(!row.capability_id||row.capability_id===capabilityId));
}

function baselineHash(model:ModelRegistryItem,mapping:ProviderModelMapping,capabilityId:CapabilityId){
 const profile=routePricingProfile(model,mapping,capabilityId);if(!profile)return null;
 const p=profile.params;
 return pricingSignatureService.create({model_id:p.model_id,mode:p.mode,resolution:p.resolution,duration_seconds:p.mode==='TEXT_TO_SPEECH'?1:p.duration_seconds,aspect_ratio:p.aspect_ratio,number_of_outputs:1,audio_enabled:p.audio_enabled,reference_mode:p.references.length?'reference':'none',reference_count:p.references.length,model_variant:p.model_variant,pricing_options:p.pricing_options}).hash;
}

export async function createStableLaunchSnapshot():Promise<StableLaunchSnapshot>{
 const[models,providers,mappings,pricing,retail]=await Promise.all([catalogRepository.listModels(),providerCatalogService.listProviders(),catalogRepository.listMappings(),providerPricingCatalogService.list(),retailPricingService.listActive()]);
 return{models,mappings,providerById:new Map(providers.map(provider=>[String(provider.provider_id),provider])),configured:new Map(providerRegistry.listAdapters().map(adapter=>[String(adapter.providerId),adapter.isConfigured()])),pricing,retailHashes:new Set(retail.filter(row=>row.active&&Number(row.retail_credit_price)>0).map(row=>row.pricing_signature_hash))};
}

export function readyRoutesForCapability(model:ModelRegistryItem,capabilityId:CapabilityId,data:StableLaunchSnapshot){
 return data.mappings.filter(mapping=>{
  if(mapping.model_id!==model.model_id||mapping.status!=='ACTIVE')return false;
  if(mapping.capabilities?.length&&!mapping.capabilities.includes(capabilityId))return false;
  const providerId=String(mapping.provider_id),provider=data.providerById.get(providerId);
  if(!provider||provider.status!=='ACTIVE'||!data.configured.get(providerId))return false;
  if(!priceMatches(data.pricing,providerId,mapping.provider_model_identifier,capabilityId))return false;
  const hash=baselineHash(model,mapping,capabilityId);
  return Boolean(hash&&data.retailHashes.has(hash));
 });
}

export function readyCapabilitiesForModel(model:ModelRegistryItem,data:StableLaunchSnapshot):CapabilityId[]{
 return capabilityIdsForModel(model).filter(capabilityId=>readyRoutesForCapability(model,capabilityId,data).length>0);
}