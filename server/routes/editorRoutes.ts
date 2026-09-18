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

export const editorRouter=Router();
const IMAGE_CAPABILITIES=['image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'] as const;
const VIDEO_CAPABILITIES=['video-extend','video-edit'] as const;
const CAPABILITIES=[...IMAGE_CAPABILITIES,...VIDEO_CAPABILITIES] as const;
const capabilitySet=new Set<string>(CAPABILITIES);
const imageSet=new Set<string>(IMAGE_CAPABILITIES);
const videoSet=new Set<string>(VIDEO_CAPABILITIES);
type EditorCapability=typeof CAPABILITIES[number];

function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function requestHost(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}
function failure(res:Response,error:any,fallback:string){const normalized=normalizeBetaPublicError(error,fallback);return res.status(normalized.status).json({success:false,error:normalized.error});}
function capabilityOf(value:any):EditorCapability{const id=String(value||'');if(!capabilitySet.has(id))throw Object.assign(new Error('Ferramenta de edição inválida.'),{code:'VALIDATION_ERROR'});return id as EditorCapability;}

async function assertCapabilityEnabled(capability:string){
 const flagName=imageSet.has(capability)?'beta.image_editor':'beta.video';
 const flag=await catalogRepository.getFeatureFlag(flagName);
 if(!flag?.is_enabled)throw Object.assign(new Error('Editor temporariamente indisponível.'),{code:'CAPABILITY_DISABLED'});
}
async function assertEditorJob(userId:string,jobId:string){
 const job=await betaJobOrchestrator.getPublic(userId,jobId);
 const capability=String(job?.request?.capability_id||'');
 if(!capabilitySet.has(capability))throw Object.assign(new Error('Edição não encontrada.'),{code:'JOB_NOT_FOUND'});
 await assertCapabilityEnabled(capability);
 return job;
}
async function requireEditorsEnabled(_req:AuthenticatedRequest,res:Response,next:NextFunction){
 try{next();}catch(error:any){return failure(res,error,'Editores indisponíveis.');}
}

editorRouter.use('/editors',requireAuth,requireEditorsEnabled);

editorRouter.get('/editors/catalog',async(_req:AuthenticatedRequest,res)=>{
 try{
  const[models,policies,mappings,imageFlag,videoFlag]=await Promise.all([
   catalogRepository.listModels(),betaCatalogPolicyService.listCatalog(),catalogRepository.listMappings(),catalogRepository.getFeatureFlag('beta.image_editor'),catalogRepository.getFeatureFlag('beta.video'),
  ]);
  const[providersResult,pricingResult]=await Promise.allSettled([
   providerCatalogService.listProviders(),providerPricingCatalogService.list(),
  ]);
  const providers=providersResult.status==='fulfilled'?providersResult.value:[];
  const pricing=pricingResult.status==='fulfilled'?pricingResult.value:[];
  const enabledCapabilities=new Set<string>([
   ...(imageFlag?.is_enabled?IMAGE_CAPABILITIES:[]),
   ...(videoFlag?.is_enabled?VIDEO_CAPABILITIES:[]),
  ]);
  const base=publicCapabilityCatalog(models).filter(model=>model.category==='IMAGE'||model.category==='VIDEO');
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
   const supported=CAPABILITIES.filter(capability=>enabledCapabilities.has(capability)&&(!mapping.capabilities?.length||mapping.capabilities.includes(capability as any))&&(
    verifiedPriceKeys.has(`${mapping.provider_id}|${mapping.provider_model_identifier}|${capability}`)||verifiedPriceKeys.has(`${mapping.provider_id}|${mapping.provider_model_identifier}|*`)
   ));
   return supported.length?[{provider_id:String(provider.provider_id),name:provider.name,capability_ids:supported}]:[];
  }).filter((row,index,rows)=>rows.findIndex(item=>item.provider_id===row.provider_id)===index);
  const governed=base.flatMap(model=>{
   const policy=policyByModel.get(model.model_id);
   const capabilities=model.capabilities.filter(item=>enabledCapabilities.has(item.id)&&policy?.capability_ids.includes(item.id as any));
   if(!policy?.eligible||!capabilities.length)return[];
   return[{...model,capabilities,pricing_policy_id:policy.pricing_policy_id,providers:providerChoices(model.model_id)}];
  });
  const autoEligible=policies.some(policy=>policy.eligible&&policy.auto_routing_enabled&&policy.capability_ids.some(id=>enabledCapabilities.has(String(id))));
  if(autoEligible&&governed.length){
   const capabilities=Array.from(new Map(governed.flatMap(model=>model.capabilities).map(cap=>[cap.id,cap])).values());
   const autoProviders=governed.flatMap((model:any)=>model.providers||[]).filter((row:any,index:number,rows:any[])=>rows.findIndex(item=>item.provider_id===row.provider_id)===index);
   governed.unshift({model_id:'AUTO',name:'AUTO',category:'IMAGE',supported_durations:[],supported_resolutions:[],supported_aspect_ratios:[],capabilities,pricing_policy_id:null,providers:autoProviders} as any);
  }
  return res.json({success:true,data:{models:governed}});
 }catch(error:any){return failure(res,error,'Não foi possível carregar os editores.');}
});

editorRouter.post('/editors/jobs',async(req:AuthenticatedRequest,res)=>{
 try{const capability=capabilityOf(req.body?.capability_id);await assertCapabilityEnabled(capability);const body={...req.body,capability_id:capability};const job=await betaJobOrchestrator.create(req.user!.uid,body,idem(req));return res.status(201).json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});}
 catch(error:any){return failure(res,error,'Não foi possível preparar a edição.');}
});
editorRouter.get('/editors/jobs/:jobId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await assertEditorJob(req.user!.uid,req.params.jobId)});}catch(error:any){return failure(res,error,'Não foi possível carregar a edição.');}});
editorRouter.post('/editors/jobs/:jobId/quote',async(req:AuthenticatedRequest,res)=>{try{await assertEditorJob(req.user!.uid,req.params.jobId);const job=await betaJobOrchestrator.quote(req.user!.uid,req.params.jobId,idem(req));return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});}catch(error:any){return failure(res,error,'Não foi possível calcular os créditos.');}});
editorRouter.post('/editors/jobs/:jobId/queue',async(req:AuthenticatedRequest,res)=>{try{await assertEditorJob(req.user!.uid,req.params.jobId);const job=await betaJobOrchestrator.queue(req.user!.uid,req.params.jobId,idem(req),requestHost(req),req.user!.idToken);return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});}catch(error:any){return failure(res,error,'Não foi possível iniciar a edição.');}});
editorRouter.get('/editors/assets/:assetId',async(req:AuthenticatedRequest,res)=>{
 try{const asset=await assetRepository.getAsset(req.params.assetId,req.user!.uid);if(!asset||!['IMAGE','VIDEO'].includes(String(asset.type)))return res.status(404).json({success:false,error:{code:'ASSET_NOT_FOUND',message:'Asset não encontrado.'}});return res.json({success:true,data:asset});}
 catch(error:any){return failure(res,error,'Não foi possível carregar o resultado.');}
});
