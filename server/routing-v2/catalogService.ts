import { CapabilityId, getCapabilityDefinition } from '../beta/capabilityRegistry.js';
import { RoutingV2Model, RoutingV2ProviderRoute } from './domain.js';
import { routingV2Repository } from './repository.js';
import { routingV2RouteService } from './routeService.js';
import { generationModeForCapability } from './generationContract.js';

export interface RoutingV2PublicModel extends RoutingV2Model{
  available_capabilities:CapabilityId[];
}

export const routingV2CatalogService={
  async listPublicModels():Promise<RoutingV2PublicModel[]>{
    const[models,routes]=await Promise.all([
      routingV2Repository.listModels(),
      routingV2RouteService.listReady(),
    ]);
    const readyByModel=new Map<string,Set<CapabilityId>>();
    for(const route of routes){
      const set=readyByModel.get(route.model_id)||new Set<CapabilityId>();
      set.add(route.capability_id);
      readyByModel.set(route.model_id,set);
    }
    return models
      .filter(model=>model.status==='ACTIVE')
      .map(model=>({...model,available_capabilities:[...(readyByModel.get(model.model_id)||new Set<CapabilityId>())]}))
      .filter(model=>model.available_capabilities.length>0);
  },

  async listPublicRoutes(capabilityId?:CapabilityId):Promise<RoutingV2ProviderRoute[]>{
    const routes=await routingV2RouteService.listReady(undefined,capabilityId);
    const models=new Map((await routingV2Repository.listModels()).map(model=>[model.model_id,model] as const));
    return routes.filter(route=>models.get(route.model_id)?.status==='ACTIVE');
  },

  async hasReadyRoute(modelId:string,capabilityId:CapabilityId){
    return (await routingV2RouteService.listReady(modelId,capabilityId)).length>0;
  },

  async listGeneratorModels(){
    const[models,routes,providers]=await Promise.all([this.listPublicModels(),this.listPublicRoutes(),routingV2Repository.listProviders()]);
    const providerNames=new Map(providers.map(provider=>[provider.provider_id,provider.name]));
    const array=(value:unknown)=>Array.isArray(value)?value:[];
    const bool=(controls:Record<string,unknown>,key:string)=>controls[key]===true;
    const number=(controls:Record<string,unknown>,key:string)=>Number.isFinite(Number(controls[key]))?Number(controls[key]):0;
    return models.map(model=>{
      const controls=model.supported_controls||{},modelRoutes=routes.filter(route=>route.model_id===model.model_id);
      const providerMap=new Map<string,Set<string>>();for(const route of modelRoutes){const set=providerMap.get(route.provider_id)||new Set<string>();set.add(route.capability_id);providerMap.set(route.provider_id,set);}
      const prices=modelRoutes.map(route=>Number(route.pricing_snapshot?.retail_price_credits)).filter(value=>Number.isFinite(value)&&value>0);
      return{model_id:model.model_id,name:model.name,slug:model.slug,vendor:model.vendor,category:model.category,description:model.description,status:'ACTIVE' as const,
        capabilities_ready:model.available_capabilities,beta_capability_ids:model.available_capabilities,supported_controls:controls,
        supported_modes:[...new Set(model.available_capabilities.map(capability=>generationModeForCapability(capability)))],
        supported_resolutions:array(controls.supported_resolutions).map(String),supported_durations:array(controls.supported_durations).map(Number).filter(Number.isFinite),supported_aspect_ratios:array(controls.supported_aspect_ratios).map(String),
        supports_image_reference:bool(controls,'supports_image_reference'),supports_multiple_images:bool(controls,'supports_multiple_images'),supports_video_reference:bool(controls,'supports_video_reference'),supports_audio_reference:bool(controls,'supports_audio_reference'),supports_negative_prompt:bool(controls,'supports_negative_prompt'),supports_seed:bool(controls,'supports_seed'),supports_start_end_image:bool(controls,'supports_start_end_image'),supports_camera_control:bool(controls,'supports_camera_control'),supports_motion_strength:bool(controls,'supports_motion_strength'),supports_loop:bool(controls,'supports_loop'),
        max_reference_images:number(controls,'max_reference_images'),max_reference_videos:number(controls,'max_reference_videos'),max_reference_audio:number(controls,'max_reference_audio'),max_prompt_length:number(controls,'max_prompt_length'),
        provider_availability:[...providerMap].map(([provider_id,ids])=>({provider_id,provider_name:providerNames.get(provider_id)||provider_id,capability_ids:[...ids]})),pricing_available:prices.length>0,minimum_credit_price:prices.length?Math.min(...prices):null,readiness:'READY' as const,created_at:model.created_at,updated_at:model.updated_at};
    });
  },

  async listGeneratorRoutes(capabilityId?:CapabilityId){
    const[routes,providers]=await Promise.all([this.listPublicRoutes(capabilityId),routingV2Repository.listProviders()]);
    const names=new Map(providers.map(provider=>[provider.provider_id,provider.name]));
    return routes.map(route=>({model_id:route.model_id,provider_id:route.provider_id,provider_name:names.get(route.provider_id)||route.provider_id,provider_model_identifier:route.provider_model_identifier,capabilities:[route.capability_id]}));
  },

  async listCapabilityModels(capabilityIds:CapabilityId[]){
    const wanted=new Set(capabilityIds);
    const[models,routes,providers]=await Promise.all([routingV2Repository.listModels(),routingV2RouteService.listReady(),routingV2Repository.listProviders()]);
    const providerNames=new Map(providers.map(provider=>[provider.provider_id,provider.name]));
    return models.filter(model=>model.status==='ACTIVE').flatMap(model=>{
      const modelRoutes=routes.filter(route=>route.model_id===model.model_id&&wanted.has(route.capability_id));
      if(!modelRoutes.length)return[];
      const capabilities=[...new Set(modelRoutes.map(route=>route.capability_id))].map(id=>{
        const definition=getCapabilityDefinition(id)!;
        const controls=model.supported_controls||{};
        const durations=Array.isArray(controls.supported_durations)?controls.supported_durations.map(Number).filter(Number.isFinite):[];
        const resolutions=Array.isArray(controls.supported_resolutions)?controls.supported_resolutions.map(String):[];
        const ratios=Array.isArray(controls.supported_aspect_ratios)?controls.supported_aspect_ratios.map(String):[];
        const declared:Record<string,string>={aspect_ratio:'supported_aspect_ratios',resolution:'supported_resolutions',duration:'supported_durations',language:'supported_languages',voice:'supported_voices',output_format:'supported_output_formats',style:'supported_styles',mesh_mode:'supported_mesh_modes',topology:'supported_topologies'};
        const flags:Record<string,string>={seed:'supports_seed',negative_prompt:'supports_negative_prompt',reference_image:'supports_image_reference',first_frame:'supports_start_end_image',last_frame:'supports_start_end_image',instrumental:'supports_instrumental',pbr:'supports_pbr',target_faces:'supports_target_faces',guidance:'supports_guidance',timestamps:'supports_timestamps',source_language:'supports_source_language',target_language:'supports_target_language',voice_clone_consent:'supports_voice_clone_consent',voice_label:'supports_voice_label',background_mode:'supports_background_mode',variation_strength:'supports_variation_strength'};
        const allowed=definition.controls.filter(control=>declared[control]?Array.isArray(controls[declared[control]])&&(controls[declared[control]] as unknown[]).length>0:flags[control]?controls[flags[control]]===true:false);
        const control_options=Object.fromEntries(allowed.filter(control=>declared[control]).map(control=>[control,(controls[declared[control]] as unknown[]).map(value=>typeof value==='number'?value:String(value))]));
        return{id,inputs:definition.inputs,outputs:definition.outputs,controls:allowed,supported_durations:durations,supported_resolutions:resolutions,supported_aspect_ratios:ratios,control_options};
      });
      const providerRoutes=new Map<string,Set<CapabilityId>>();
      for(const route of modelRoutes){const set=providerRoutes.get(route.provider_id)||new Set<CapabilityId>();set.add(route.capability_id);providerRoutes.set(route.provider_id,set);}
      const providerOptions=[...providerRoutes].map(([provider_id,ids])=>({provider_id,name:providerNames.get(provider_id)||provider_id,capability_ids:[...ids]}));
      const controls=model.supported_controls||{};
      return[{model_id:model.model_id,name:model.name,category:model.category,supported_durations:Array.isArray(controls.supported_durations)?controls.supported_durations:[],supported_resolutions:Array.isArray(controls.supported_resolutions)?controls.supported_resolutions:[],supported_aspect_ratios:Array.isArray(controls.supported_aspect_ratios)?controls.supported_aspect_ratios:[],capabilities,providers:providerOptions}];
    });
  },
};
