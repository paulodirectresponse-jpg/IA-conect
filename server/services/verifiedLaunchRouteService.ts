import { ModelRegistryItem, ProviderModelMapping } from '../../src/types/index.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { catalogPolicyRepository } from '../beta/catalog/catalogPolicyRepository.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { providerCatalogService } from './providerCatalogService.js';
import { providerPricingCatalogService, ProviderPricingRule } from './providerPricingCatalogService.js';

export type VerifiedLaunchRouteKey='voice-minimax-speech-2-6-turbo'|'music-ace-step'|'three-d-hunyuan3d-v3';

type LaunchPricing=Pick<ProviderPricingRule,'capability_id'|'unit'|'unit_price_usd'|'minimum_usd'|'source'>;
interface VerifiedLaunchRouteDefinition{
  key:VerifiedLaunchRouteKey;
  label:string;
  media:'VOICE'|'MUSIC'|'THREE_D';
  model_id:string;
  model_name:string;
  provider_id:'provider-wavespeed';
  provider_model_identifier:string;
  capability_ids:string[];
  pricing:LaunchPricing[];
  pricing_label:string;
  source_url:string;
  model_patch:Partial<ModelRegistryItem>;
}

const VERIFIED_AT='2026-09-18T00:00:00.000Z';

export const VERIFIED_LAUNCH_ROUTES:VerifiedLaunchRouteDefinition[]=[
  {
    key:'voice-minimax-speech-2-6-turbo',
    label:'Voz · MiniMax Speech 2.6 Turbo',
    media:'VOICE',
    model_id:'minimax-speech-2-6-turbo',
    model_name:'MiniMax Speech 2.6 Turbo',
    provider_id:'provider-wavespeed',
    provider_model_identifier:'minimax/speech-2.6-turbo',
    capability_ids:['text-to-speech'],
    pricing:[{capability_id:'text-to-speech',unit:'CHARACTER',unit_price_usd:0.00006,source:'PROVIDER_DOCS'}],
    pricing_label:'US$ 0,06 / 1.000 caracteres',
    source_url:'https://wavespeed.ai/docs/docs-api/minimax/minimax-speech-2.6-turbo',
    model_patch:{status:'ACTIVE',beta_only:false,max_prompt_length:10000,beta_capability_ids:['text-to-speech']},
  },
  {
    key:'music-ace-step',
    label:'Música · ACE-Step',
    media:'MUSIC',
    model_id:'ace-step-music',
    model_name:'ACE-Step',
    provider_id:'provider-wavespeed',
    provider_model_identifier:'wavespeed-ai/ace-step/prompt-to-audio',
    capability_ids:['music'],
    pricing:[{capability_id:'music',unit:'SECOND',unit_price_usd:0.0002,source:'PROVIDER_DOCS'}],
    pricing_label:'US$ 0,0002 / segundo',
    source_url:'https://wavespeed.ai/docs/docs-api/wavespeed-ai/ace-step-prompt-to-audio',
    model_patch:{
      status:'ACTIVE',beta_only:false,supports_seed:true,
      supported_durations:[5,15,30,60,90,120,180,240],
      beta_capability_ids:['music'],
    },
  },
  {
    key:'three-d-hunyuan3d-v3',
    label:'3D · Hunyuan3D V3',
    media:'THREE_D',
    model_id:'hunyuan3d-v3',
    model_name:'Hunyuan3D V3',
    provider_id:'provider-wavespeed',
    provider_model_identifier:'wavespeed-ai/hunyuan3d-v3',
    capability_ids:['text-to-3d','image-to-3d','multi-image-to-3d'],
    pricing:[
      {capability_id:'text-to-3d',unit:'REQUEST',unit_price_usd:0.25,source:'PROVIDER_DOCS'},
      {capability_id:'image-to-3d',unit:'REQUEST',unit_price_usd:0.25,source:'PROVIDER_DOCS'},
      {capability_id:'multi-image-to-3d',unit:'REQUEST',unit_price_usd:0.25,source:'PROVIDER_DOCS'},
    ],
    pricing_label:'a partir de US$ 0,25 / execução · preço final cotado ao vivo',
    source_url:'https://wavespeed.ai/docs/docs-api/wavespeed-ai/hunyuan3d-v3-image-to-3d',
    model_patch:{
      status:'ACTIVE',beta_only:false,
      supported_modes:['TEXT_TO_3D','IMAGE_TO_3D','MULTI_IMAGE_TO_3D'],
      supports_image_reference:true,supports_multiple_images:true,max_reference_images:4,
      beta_capability_ids:['text-to-3d','image-to-3d','multi-image-to-3d'],
    },
  },
];

const byKey=new Map(VERIFIED_LAUNCH_ROUTES.map(route=>[route.key,route]));
const mappingId=(route:VerifiedLaunchRouteDefinition)=>`map-verified-${route.model_id}-${route.provider_id.replace('provider-','')}`;

function pricingReady(pricing:ProviderPricingRule[],route:VerifiedLaunchRouteDefinition){
  return route.capability_ids.every(capability=>pricing.some(row=>
    row.verified&&row.provider_id===route.provider_id&&row.provider_model_identifier===route.provider_model_identifier&&
    (!row.capability_id||row.capability_id===capability)
  ));
}

function mappingReady(mappings:ProviderModelMapping[],route:VerifiedLaunchRouteDefinition){
  return mappings.some(mapping=>
    mapping.model_id===route.model_id&&mapping.provider_id===route.provider_id&&mapping.provider_model_identifier===route.provider_model_identifier&&
    mapping.status==='ACTIVE'&&route.capability_ids.every(capability=>!mapping.capabilities?.length||mapping.capabilities.includes(capability as any))
  );
}

export const verifiedLaunchRouteService={
  definitions(){return VERIFIED_LAUNCH_ROUTES;},

  async listStatus(){
    const[providers,mappings,pricing,pricingPolicies,modelRows,policyRows]=await Promise.all([
      providerCatalogService.listProviders(),
      catalogRepository.listMappings(),
      providerPricingCatalogService.list(),
      catalogPolicyRepository.listPricingPolicies(),
      Promise.all(VERIFIED_LAUNCH_ROUTES.map(route=>catalogRepository.getModel(route.model_id))),
      Promise.all(VERIFIED_LAUNCH_ROUTES.map(route=>catalogPolicyRepository.getModelPolicy(route.model_id))),
    ]);
    const providerById=new Map(providers.map(provider=>[String(provider.provider_id),provider]));
    const modelById=new Map(modelRows.filter(Boolean).map(model=>[model!.model_id,model!]));
    const policyById=new Map(policyRows.filter(Boolean).map(policy=>[policy!.model_id,policy!]));
    const pricingPolicyById=new Map(pricingPolicies.map(policy=>[policy.pricing_policy_id,policy]));
    return VERIFIED_LAUNCH_ROUTES.map(route=>{
      const provider=providerById.get(route.provider_id);
      const adapter=providerRegistry.getAdapter(route.provider_id);
      const model=modelById.get(route.model_id);
      const policy=policyById.get(route.model_id);
      const provider_ready=Boolean(provider?.status==='ACTIVE'&&adapter?.isConfigured());
      const mapping_ready=mappingReady(mappings,route);
      const pricing_ready=pricingReady(pricing,route);
      const pricingPolicy=policy?pricingPolicyById.get(policy.pricing_policy_id):null;
      const policy_ready=Boolean(policy?.enabled&&pricingPolicy?.active&&route.capability_ids.every(capability=>policy.capability_ids.includes(capability as any)));
      const model_ready=Boolean(model?.status==='ACTIVE'&&model?.beta_only!==true);
      return{
        key:route.key,label:route.label,media:route.media,model_id:route.model_id,model_name:route.model_name,
        provider_id:route.provider_id,provider_name:provider?.name||'WaveSpeed AI',
        provider_model_identifier:route.provider_model_identifier,capability_ids:route.capability_ids,
        pricing_label:route.pricing_label,source_url:route.source_url,
        provider_ready,mapping_ready,pricing_ready,policy_ready,model_ready,
        ready:provider_ready&&mapping_ready&&pricing_ready&&policy_ready&&model_ready,
      };
    });
  },

  async apply(key:string,updatedBy?:string){
    const route=byKey.get(key as VerifiedLaunchRouteKey);
    if(!route)throw Object.assign(new Error('Rota verificada desconhecida.'),{code:'VERIFIED_ROUTE_NOT_FOUND'});
    const provider=await providerCatalogService.getProvider(route.provider_id);
    const adapter=providerRegistry.getAdapter(route.provider_id);
    if(!provider||provider.status!=='ACTIVE')throw Object.assign(new Error('O provider desta rota está desativado.'),{code:'PROVIDER_INACTIVE'});
    if(!adapter?.isConfigured())throw Object.assign(new Error('A credencial do provider não está disponível no runtime.'),{code:'PROVIDER_NOT_CONFIGURED'});

    await providerCatalogService.ensureProviderRecord(route.provider_id);
    const seeded=await providerCatalogService.ensureCuratedModel(route.model_id);
    if(!seeded)throw Object.assign(new Error('Modelo não pertence ao acervo curado.'),{code:'MODEL_NOT_CURATED'});
    const model=await catalogRepository.saveModel({...seeded,...route.model_patch,model_id:seeded.model_id,updated_at:new Date().toISOString()});

    for(const rule of route.pricing){
      await providerPricingCatalogService.save({
        provider_id:route.provider_id,
        provider_model_identifier:route.provider_model_identifier,
        capability_id:rule.capability_id||null,
        unit:rule.unit,
        unit_price_usd:rule.unit_price_usd,
        minimum_usd:rule.minimum_usd??null,
        verified:true,
        source:rule.source,
        verified_at:VERIFIED_AT,
      });
    }

    const mapping=await catalogRepository.saveMapping({
      mapping_id:mappingId(route),
      model_id:route.model_id,
      provider_id:route.provider_id,
      provider_model_identifier:route.provider_model_identifier,
      status:'ACTIVE',
      capabilities:route.capability_ids as any,
      updated_at:new Date().toISOString(),
    });

    const policy=await betaCatalogPolicyService.saveModelPolicy(route.model_id,{
      capability_ids:route.capability_ids,
      enabled:true,
      auto_routing_enabled:true,
      reason:'Rota Stable verificada por documentação oficial e pricing governado.',
    },updatedBy);

    return{route_key:route.key,model,mapping,policy,pricing_count:route.pricing.length};
  },
};
