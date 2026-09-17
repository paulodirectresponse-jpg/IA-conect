import { Router,Response,NextFunction } from 'express';
import { requireAuth,AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { assetRepository } from '../repositories/assetRepository.js';
import { publicCapabilityCatalog } from '../beta/capabilityRegistry.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { betaJobOrchestrator } from '../beta/jobs/jobOrchestrator.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';
import { providerCatalogService } from '../services/providerCatalogService.js';
import { providerPricingCatalogService } from '../services/providerPricingCatalogService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';

export const threeDGenerationRouter=Router();
const CAPABILITIES=['text-to-3d','image-to-3d','multi-image-to-3d'] as const;
type ThreeDCapability=typeof CAPABILITIES[number];
const capabilitySet=new Set<string>(CAPABILITIES);

function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function requestHost(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}
function failure(res:Response,error:any,fallback:string){const normalized=normalizeBetaPublicError(error,fallback);return res.status(normalized.status).json({success:false,error:normalized.error});}
function capabilityOf(value:any):ThreeDCapability{const id=String(value||'');if(!capabilitySet.has(id))throw Object.assign(new Error('Capability 3D inválida.'),{code:'VALIDATION_ERROR'});return id as ThreeDCapability;}

async function requireThreeDEnabled(_req:AuthenticatedRequest,res:Response,next:NextFunction){
 try{
  const flag=await catalogRepository.getFeatureFlag('beta.three_d');
  if(!flag?.is_enabled){const normalized=normalizeBetaPublicError({code:'THREE_D_MODULE_DISABLED'});return res.status(normalized.status).json({success:false,error:normalized.error});}
  next();
 }catch{const normalized=normalizeBetaPublicError({code:'THREE_D_MODULE_DISABLED'});return res.status(normalized.status).json({success:false,error:normalized.error});}
}

async function assertThreeDJob(userId:string,jobId:string){
 const job=await betaJobOrchestrator.getPublic(userId,jobId);
 if(!capabilitySet.has(String(job?.request?.capability_id||'')))throw Object.assign(new Error('Geração 3D não encontrada.'),{code:'JOB_NOT_FOUND'});
 return job;
}

threeDGenerationRouter.use('/3d',requireAuth,requireThreeDEnabled);

threeDGenerationRouter.get('/3d/catalog',async(_req:AuthenticatedRequest,res)=>{
 try{
  const[models,policies,mappings,providers,pricing]=await Promise.all([
   catalogRepository.listModels(),betaCatalogPolicyService.listCatalog(),catalogRepository.listMappings(),providerCatalogService.listProviders(),providerPricingCatalogService.list(),
  ]);
  const base=publicCapabilityCatalog(models).filter(model=>model.category==='MODEL_3D');
  const policyByModel=new Map(policies.map(policy=>[policy.model_id,policy]));
  const providerById=new Map(providers.map(provider=>[String(provider.provider_id),provider]));
  const configured=new Map(providerRegistry.listAdapters().map(adapter=>[String(adapter.providerId),adapter.isConfigured()]));
  const verifiedPriceKeys=new Set(pricing.filter(row=>row.verified).flatMap(row=>[
   `${row.provider_id}|${row.provider_model_identifier}|${row.capability_id||''}`,
   row.capability_id?null:`${row.provider_id}|${row.provider_model_identifier}|*`,
  ].filter(Boolean) as string[]));
  const providerChoices=(modelId:string)=>mappings.filter(mapping=>mapping.model_id===modelId&&mapping.status==='ACTIVE').flatMap(mapping=>{
   const provider=providerById.get(String(mapping.provider_id));
   if(!provider||provider.status!=='ACTIVE'||!configured.get(String(mapping.provider_id)))return[];
   const supported=CAPABILITIES.filter(capability=>(!mapping.capabilities?.length||mapping.capabilities.includes(capability as any))&&(
    verifiedPriceKeys.has(`${mapping.provider_id}|${mapping.provider_model_identifier}|${capability}`)||verifiedPriceKeys.has(`${mapping.provider_id}|${mapping.provider_model_identifier}|*`)
   ));
   return supported.length?[{provider_id:String(provider.provider_id),name:provider.name,capability_ids:supported}]:[];
  }).filter((row,index,rows)=>rows.findIndex(item=>item.provider_id===row.provider_id)===index);
  const governed=base.flatMap(model=>{
   const policy=policyByModel.get(model.model_id);
   const capabilities=model.capabilities.filter(item=>capabilitySet.has(item.id)&&policy?.capability_ids.includes(item.id as any));
   if(!policy?.eligible||!capabilities.length)return[];
   return[{...model,capabilities,pricing_policy_id:policy.pricing_policy_id,providers:providerChoices(model.model_id)}];
  });
  const autoEligible=policies.some(policy=>policy.eligible&&policy.auto_routing_enabled&&policy.capability_ids.some(id=>capabilitySet.has(String(id))));
  if(autoEligible&&governed.length){
   const capabilities=Array.from(new Map(governed.flatMap(model=>model.capabilities).map(cap=>[cap.id,cap])).values());
   const autoProviders=governed.flatMap((model:any)=>model.providers||[]).filter((row:any,index:number,rows:any[])=>rows.findIndex(item=>item.provider_id===row.provider_id)===index);
   governed.unshift({model_id:'AUTO',name:'AUTO',category:'MODEL_3D',supported_durations:[],supported_resolutions:['3D'],supported_aspect_ratios:['3D'],capabilities,pricing_policy_id:null,providers:autoProviders} as any);
  }
  return res.json({success:true,data:{models:governed}});
 }catch(error:any){return failure(res,error,'Não foi possível carregar o gerador 3D.');}
});

threeDGenerationRouter.post('/3d/jobs',async(req:AuthenticatedRequest,res)=>{
 try{const body={...req.body,capability_id:capabilityOf(req.body?.capability_id)};const job=await betaJobOrchestrator.create(req.user!.uid,body,idem(req));return res.status(201).json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});}
 catch(error:any){return failure(res,error,'Não foi possível preparar a geração 3D.');}
});
threeDGenerationRouter.get('/3d/jobs/:jobId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await assertThreeDJob(req.user!.uid,req.params.jobId)});}catch(error:any){return failure(res,error,'Não foi possível carregar a geração 3D.');}});
threeDGenerationRouter.post('/3d/jobs/:jobId/quote',async(req:AuthenticatedRequest,res)=>{try{await assertThreeDJob(req.user!.uid,req.params.jobId);const job=await betaJobOrchestrator.quote(req.user!.uid,req.params.jobId,idem(req));return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});}catch(error:any){return failure(res,error,'Não foi possível calcular os créditos do 3D.');}});
threeDGenerationRouter.post('/3d/jobs/:jobId/queue',async(req:AuthenticatedRequest,res)=>{try{await assertThreeDJob(req.user!.uid,req.params.jobId);const job=await betaJobOrchestrator.queue(req.user!.uid,req.params.jobId,idem(req),requestHost(req),req.user!.idToken);return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});}catch(error:any){return failure(res,error,'Não foi possível iniciar a geração 3D.');}});
threeDGenerationRouter.get('/3d/assets',async(req:AuthenticatedRequest,res)=>{
 try{const assets=await assetRepository.listUserAssets(req.user!.uid,{type:'MODEL_3D',includeUniversal:true});return res.json({success:true,data:assets});}
 catch(error:any){return failure(res,error,'Não foi possível carregar suas criações 3D.');}
});
threeDGenerationRouter.get('/3d/assets/:assetId',async(req:AuthenticatedRequest,res)=>{
 try{const asset=await assetRepository.getAsset(req.params.assetId,req.user!.uid);if(!asset||asset.type!=='MODEL_3D')return res.status(404).json({success:false,error:{code:'ASSET_NOT_FOUND',message:'Asset 3D não encontrado.'}});return res.json({success:true,data:asset});}
 catch(error:any){return failure(res,error,'Não foi possível carregar o asset 3D.');}
});