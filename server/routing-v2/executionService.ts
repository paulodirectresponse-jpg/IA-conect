import crypto from 'crypto';
import { AssetType, Generation, GenerationAttemptLog } from '../../src/types/index.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';
import { assetRepository, generatedAssetId } from '../repositories/assetRepository.js';
import { generationRepository } from '../repositories/generationRepository.js';
import { creditWalletService } from '../services/creditWalletService.js';
import { generatedAssetStorageService } from '../services/generatedAssetStorageService.js';
import { routingV2AdapterRegistry } from './adapterRegistry.js';
import { routingV2GenerationPricingService } from './generationPricingService.js';
import { routingV2Repository } from './repository.js';
import { ensureRoutingV2LegacyAdapter } from './legacyAdapterBridge.js';
import { createRoutingV2LegacyWrapperAdapter } from './legacyWrapperAdapter.js';

export interface RoutingV2ExecutionReference{
  url:string;
  type:string;
  role?:string;
  asset_id?:string;
  alias?:string;
  name?:string;
  category?:string;
  storage_path?:string;
  mime_type?:string;
  slot_type?:'INITIAL'|'END'|'GENERAL';
}

export interface StartRoutingV2GenerationInput{
  user_id:string;
  model_id:string;
  capability_id:CapabilityId;
  prompt?:string;
  negative_prompt?:string;
  duration_seconds?:number;
  number_of_outputs?:number;
  character_count?:number;
  dimensions?:Record<string,string|number|boolean|null|undefined>;
  parameters?:Record<string,string|number|boolean|null|undefined>;
  references?:RoutingV2ExecutionReference[];
  client_request_id?:string;
  source_job_id?:string|null;
  derived_from_asset_id?:string|null;
  authorized_credit_price?:number;
  requested_model_id?:string|null;
  routing_mode?:'MANUAL'|'AUTO';
}

function outputAssetType(capabilityId:CapabilityId):AssetType{
  if(['text-to-image','image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'].includes(capabilityId))return'IMAGE';
  if(['text-to-speech','sound-effects','music'].includes(capabilityId))return'AUDIO';
  if(['text-to-3d','image-to-3d','multi-image-to-3d','texture-3d'].includes(capabilityId))return'MODEL_3D';
  return'VIDEO';
}

function fallbackMime(type:AssetType){
  if(type==='IMAGE')return'image/jpeg';
  if(type==='AUDIO')return'audio/mpeg';
  if(type==='MODEL_3D')return'model/gltf-binary';
  return'video/mp4';
}

function executionAdapter(provider:any){
  const registered=routingV2AdapterRegistry.get(provider.adapter_id);
  if(registered)return registered;
  if(provider.adapter_id===`legacy:${provider.provider_id}`)return ensureRoutingV2LegacyAdapter(provider.provider_id);
  if(provider.adapter_id===`wrapper:${provider.provider_id}`)return createRoutingV2LegacyWrapperAdapter(provider.provider_id);
  return null;
}

async function createUniversalAssets(generation:Generation,urls:string[]){
  const type=outputAssetType(String(generation.capability_id||'') as CapabilityId);
  const created=[];
  for(let index=0;index<urls.length;index++){
    const url=String(urls[index]||'').trim();
    if(!url)continue;
    const assetId=generatedAssetId(generation.generation_id,index);
    const existing=await assetRepository.getAsset(assetId,generation.user_id);
    if(existing){created.push(existing);continue;}
    const archived=await generatedAssetStorageService.archive({
      userId:generation.user_id,assetId,sourceUrl:url,fallbackMime:fallbackMime(type),
      fallbackExtension:type==='IMAGE'?'jpg':type==='AUDIO'?'mp3':type==='MODEL_3D'?'glb':'mp4',
    });
    created.push(await assetRepository.createAsset({
      asset_id:assetId,
      owner_user_id:generation.user_id,
      type,
      category:'GENERIC',
      name:`${type==='IMAGE'?'Imagem':type==='AUDIO'?'Áudio':type==='MODEL_3D'?'Modelo 3D':'Vídeo'} gerado ${generation.generation_id.slice(-6)}`,
      alias:`routing_v2_${generation.generation_id.slice(-8)}_${index+1}`,
      storage_path:archived.storage_path,
      public_url:archived.public_url,
      thumbnail_url:type==='IMAGE'?archived.public_url:undefined,
      preview_url:archived.public_url,
      preview_mime_type:archived.mime_type,
      mime_type:archived.mime_type,
      size_bytes:archived.size_bytes,
      status:'READY',
      origin:generation.derived_from_asset_id?'DERIVED':'GENERATED',
      source_generation_id:generation.generation_id,
      source_job_id:generation.source_job_id||null,
      derived_from_asset_id:generation.derived_from_asset_id||null,
      source_output_index:index,
      source_model_id:generation.model_id,
      source_provider_id:generation.provider_id,
      media_metadata:{routing_core:'V2',route_id:String((generation as any).routing_v2_route_id||''),archived:true},
    }));
  }
  return created;
}

export const routingV2ExecutionService={
  async preview(input:Omit<StartRoutingV2GenerationInput,'authorized_credit_price'|'client_request_id'|'source_job_id'|'references'|'parameters'>){
    const preview=await routingV2GenerationPricingService.preview({
      model_id:input.model_id,
      capability_id:input.capability_id,
      duration_seconds:input.duration_seconds,
      number_of_outputs:input.number_of_outputs,
      character_count:input.character_count,
      dimensions:input.dimensions,
    });
    const wallet=await creditWalletService.simulateReserve(input.user_id,preview.retail_credits);
    return{...preview,wallet};
  },

  async start(input:StartRoutingV2GenerationInput):Promise<Generation>{
    const clientRequestId=input.client_request_id||crypto.randomUUID();
    const existing=await generationRepository.findByClientRequest(input.user_id,clientRequestId);
    if(existing)return existing;

    const preview=await this.preview(input);
    const authorized=Number(input.authorized_credit_price);
    if(Number.isFinite(authorized)&&authorized>0&&authorized!==preview.retail_credits){
      throw Object.assign(new Error('O preço mudou desde a autorização. Atualize a prévia antes de gerar.'),{code:'ROUTING_V2_PRICE_CHANGED',quoted_credit_price:authorized,current_credit_price:preview.retail_credits});
    }
    if(!preview.wallet.has_sufficient_credits){
      throw Object.assign(new Error('Créditos insuficientes.'),{code:'CREDIT_INSUFFICIENT_FUNDS',missing_credits:preview.wallet.missing_credits});
    }

    const route=preview.route;
    const provider=await routingV2Repository.getProvider(route.provider_id);
    if(!provider||provider.status==='DISABLED')throw Object.assign(new Error('Provider V2 indisponível.'),{code:'ROUTING_V2_PROVIDER_UNAVAILABLE'});
    const adapter=executionAdapter(provider);
    if(!adapter?.submitGeneration)throw Object.assign(new Error('Adapter V2 não possui executor de geração.'),{code:'ROUTING_V2_EXECUTOR_UNAVAILABLE'});

    const generationId=`gen_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
    const now=new Date().toISOString();
    let generation:any={
      generation_id:generationId,
      user_id:input.user_id,
      status:'RESERVING_FUNDS',
      model_id:input.model_id,
      mode:String(input.capability_id).replace(/-/g,'_').toUpperCase(),
      provider_id:route.provider_id,
      capability_id:input.capability_id,
      resolution:String(input.dimensions?.resolution||''),
      aspect_ratio:String(input.dimensions?.aspect_ratio||''),
      original_prompt:String(input.prompt||''),
      negative_prompt:String(input.negative_prompt||''),
      duration_seconds:input.duration_seconds,
      number_of_outputs:Math.max(1,Math.round(Number(input.number_of_outputs||1))),
      retail_credit_price:preview.retail_credits,
      authorized_credit_price:preview.retail_credits,
      final_credit_cost:0,
      currency:'CREDITS',
      provider_job_id:undefined,
      client_request_id:clientRequestId,
      source_job_id:input.source_job_id||null,
      derived_from_asset_id:input.derived_from_asset_id||null,
      requested_model_id:input.requested_model_id||input.model_id,
      routing_mode:input.routing_mode||'MANUAL',
      progress_percent:0,
      result_asset_id:null,
      result_asset_ids:[],
      error_code:null,
      error_message:null,
      attempt_count:0,
      references_count:(input.references||[]).length,
      created_at:now,
      submitted_at:null,
      completed_at:null,
      failed_at:null,
      routing_core_version:'V2',
      routing_v2_route_id:route.route_id,
      routing_v2_price_fetched_at:preview.pricing_fetched_at,
      routing_v2_price_valid_until:preview.pricing_valid_until,
      routing_v2_safe_cogs_brl:preview.safe_cogs_brl,
    };
    await generationRepository.saveGeneration(generation);

    try{
      await creditWalletService.reserveForGeneration({
        userId:input.user_id,
        credits:preview.retail_credits,
        generationId,
        idempotencyKey:`routing-v2-reserve:${generationId}`,
      });
      generation.status='QUEUED';
      await generationRepository.saveGeneration(generation);

      const submission=await adapter.submitGeneration(provider,{
        generation_id:generationId,
        user_id:input.user_id,
        route_id:route.route_id,
        model_id:route.model_id,
        capability_id:route.capability_id,
        provider_model_identifier:route.provider_model_identifier,
        prompt:input.prompt,
        negative_prompt:input.negative_prompt,
        duration_seconds:input.duration_seconds,
        number_of_outputs:input.number_of_outputs,
        character_count:input.character_count,
        parameters:{...(input.parameters||{}),...(input.dimensions||{})},
        references:input.references||[],
      });
      generation.provider_job_id=submission.provider_job_id;
      generation.status=submission.status==='SUCCEEDED'?'PROCESSING':submission.status;
      generation.submitted_at=new Date().toISOString();
      generation.attempt_count=1;
      await generationRepository.saveGeneration(generation);
      const attempt:GenerationAttemptLog={
        attempt_id:`gat_v2_${generationId}_1`,
        generation_id:generationId,
        attempt_number:1,
        provider_id:route.provider_id,
        provider_job_id:submission.provider_job_id,
        status:submission.status==='PROCESSING'?'PROCESSING':'SUBMITTED',
        created_at:generation.submitted_at,
        updated_at:generation.submitted_at,
      };
      await generationRepository.recordAttemptLog(attempt);
      return generation;
    }catch(error:any){
      await creditWalletService.releaseForGeneration(input.user_id,generationId).catch(()=>{});
      generation.status='FAILED';
      generation.error_code=error?.code||'ROUTING_V2_SUBMIT_FAILED';
      generation.error_message=String(error?.message||error);
      generation.failed_at=new Date().toISOString();
      await generationRepository.saveGeneration(generation);
      throw error;
    }
  },

  async cancel(generationId:string,userId:string):Promise<Generation>{
    const generation:any=await generationRepository.getGeneration(generationId);
    if(!generation||generation.user_id!==userId)throw Object.assign(new Error('Geração não encontrada.'),{code:'GENERATION_NOT_FOUND'});
    if(generation.routing_core_version!=='V2')throw Object.assign(new Error('Geração não pertence ao Routing Core V2.'),{code:'ROUTING_V2_GENERATION_REQUIRED'});
    if(['SUCCEEDED','FAILED','CANCELLED','REFUNDED'].includes(generation.status))return generation;
    const route=await routingV2Repository.getRoute(String(generation.routing_v2_route_id||''));
    const provider=route?await routingV2Repository.getProvider(route.provider_id):null;
    const adapter=provider?executionAdapter(provider):null;
    if(generation.provider_job_id&&adapter?.cancelGeneration){
      const cancelled=await adapter.cancelGeneration(provider!,String(generation.provider_job_id));
      if(!cancelled)throw Object.assign(new Error('Esta execução não pode mais ser cancelada.'),{code:'TASK_CANCEL_UNAVAILABLE'});
    }else if(generation.provider_job_id){
      throw Object.assign(new Error('Esta execução não oferece cancelamento seguro.'),{code:'TASK_CANCEL_UNAVAILABLE'});
    }
    await creditWalletService.releaseForGeneration(userId,generationId).catch(()=>{});
    generation.status='CANCELLED';
    generation.failed_at=new Date().toISOString();
    await generationRepository.saveGeneration(generation);
    return generation;
  },

  async refresh(generationId:string,userId:string):Promise<Generation>{
    const generation:any=await generationRepository.getGeneration(generationId);
    if(!generation||generation.user_id!==userId)throw Object.assign(new Error('Geração não encontrada.'),{code:'GENERATION_NOT_FOUND'});
    if(generation.routing_core_version!=='V2')throw Object.assign(new Error('Geração não pertence ao Routing Core V2.'),{code:'ROUTING_V2_GENERATION_REQUIRED'});
    if(['SUCCEEDED','FAILED','CANCELLED','REFUNDED'].includes(generation.status))return generation;

    const routeId=String(generation.routing_v2_route_id||'');
    const route=await routingV2Repository.getRoute(routeId);
    if(!route)throw Object.assign(new Error('Route V2 da geração não foi encontrada.'),{code:'ROUTING_V2_ROUTE_NOT_FOUND'});
    const provider=await routingV2Repository.getProvider(route.provider_id);
    if(!provider)throw Object.assign(new Error('Provider V2 da geração não foi encontrado.'),{code:'ROUTING_V2_PROVIDER_UNAVAILABLE'});
    const adapter=executionAdapter(provider);
    if(!adapter?.checkGeneration)throw Object.assign(new Error('Adapter V2 não possui consulta de status.'),{code:'ROUTING_V2_STATUS_UNAVAILABLE'});

    const status=await adapter.checkGeneration(provider,String(generation.provider_job_id||''));
    generation.progress_percent=status.progress_percent??generation.progress_percent??0;
    if(status.status==='QUEUED'||status.status==='PROCESSING'){
      generation.status=status.status;
      await generationRepository.saveGeneration(generation);
      return generation;
    }
    if(status.status==='FAILED'){
      await creditWalletService.releaseForGeneration(userId,generationId).catch(()=>{});
      generation.status='FAILED';
      generation.error_code=status.error_code||'PROVIDER_FAILED';
      generation.error_message=status.error_message||'O provider não concluiu a geração.';
      generation.failed_at=new Date().toISOString();
      await generationRepository.saveGeneration(generation);
      return generation;
    }

    const assets=await createUniversalAssets(generation,status.result_urls||[]);
    await creditWalletService.captureForGeneration(userId,generationId);
    generation.status='SUCCEEDED';
    generation.progress_percent=100;
    generation.final_credit_cost=Number(generation.retail_credit_price||0);
    generation.result_asset_ids=assets.map(asset=>asset.asset_id);
    generation.result_asset_id=assets[0]?.asset_id||null;
    generation.result_url=assets[0]?.public_url||null;
    generation.result_urls=assets.map(asset=>asset.public_url).filter(Boolean);
    generation.completed_at=new Date().toISOString();
    await generationRepository.saveGeneration(generation);
    return generation;
  },
};
