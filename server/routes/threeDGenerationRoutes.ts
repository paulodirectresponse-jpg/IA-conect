import { Router,Response,NextFunction } from 'express';
import { requireAuth,AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { assetRepository } from '../repositories/assetRepository.js';
import { betaJobOrchestrator } from '../beta/jobs/jobOrchestrator.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';
import { routingV2CatalogService } from '../routing-v2/catalogService.js';

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
  const models=await routingV2CatalogService.listCapabilityModels([...CAPABILITIES]);
  return res.json({success:true,data:{models}});
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
