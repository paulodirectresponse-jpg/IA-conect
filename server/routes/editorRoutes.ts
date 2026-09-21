import { Router,Response,NextFunction } from 'express';
import { requireAuth,AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { featureFlagService } from '../services/featureFlagService.js';
import { assetRepository } from '../repositories/assetRepository.js';
import { betaJobOrchestrator } from '../beta/jobs/jobOrchestrator.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';
import { routingV2CatalogService } from '../routing-v2/catalogService.js';

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
 const flagName=imageSet.has(capability)?'beta.image_editor':'beta.video_editor';
 const flag=await featureFlagService.getFlag(flagName);
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
  const[imageFlag,videoFlag]=await Promise.all([featureFlagService.getFlag('beta.image_editor'),featureFlagService.getFlag('beta.video_editor')]);
  const enabledCapabilities=new Set<string>([
   ...(imageFlag?.is_enabled?IMAGE_CAPABILITIES:[]),
   ...(videoFlag?.is_enabled?VIDEO_CAPABILITIES:[]),
  ]);
  const capabilities=CAPABILITIES.filter(capability=>enabledCapabilities.has(capability));
  return res.json({success:true,data:{models:await routingV2CatalogService.listCapabilityModels(capabilities)}});
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
