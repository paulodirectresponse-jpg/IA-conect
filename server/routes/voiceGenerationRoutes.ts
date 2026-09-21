import { Router,Response,NextFunction } from 'express';
import { requireAuth,AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { betaJobOrchestrator } from '../beta/jobs/jobOrchestrator.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';
import { routingV2CatalogService } from '../routing-v2/catalogService.js';

export const voiceGenerationRouter=Router();
const CAPABILITY='text-to-speech';

function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function requestHost(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}
function failure(res:Response,error:any,fallback:string){
  const normalized=normalizeBetaPublicError(error,fallback);
  return res.status(normalized.status).json({success:false,error:normalized.error});
}

async function requireVoiceEnabled(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const audio=await catalogRepository.getFeatureFlag('beta.audio');
    if(!audio?.is_enabled){
      const normalized=normalizeBetaPublicError({code:'AUDIO_MODULE_DISABLED'});
      return res.status(normalized.status).json({success:false,error:normalized.error});
    }
    next();
  }catch{
    const normalized=normalizeBetaPublicError({code:'AUDIO_MODULE_DISABLED'});
    return res.status(normalized.status).json({success:false,error:normalized.error});
  }
}

async function assertVoiceJob(userId:string,jobId:string){
  const job=await betaJobOrchestrator.getPublic(userId,jobId);
  if(job?.request?.capability_id!==CAPABILITY){
    throw Object.assign(new Error('Geração de voz não encontrada.'),{code:'JOB_NOT_FOUND'});
  }
  return job;
}

voiceGenerationRouter.use('/voice',requireAuth,requireVoiceEnabled);

voiceGenerationRouter.get('/voice/catalog',async(_req:AuthenticatedRequest,res)=>{
  try{
    return res.json({success:true,data:{models:await routingV2CatalogService.listCapabilityModels([CAPABILITY])}});
  }catch(error:any){return failure(res,error,'Não foi possível carregar o gerador de voz.');}
});

voiceGenerationRouter.post('/voice/jobs',async(req:AuthenticatedRequest,res)=>{
  try{
    const body={...req.body,capability_id:CAPABILITY,references:[]};
    const job=await betaJobOrchestrator.create(req.user!.uid,body,idem(req));
    return res.status(201).json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível preparar a geração de voz.');}
});

voiceGenerationRouter.get('/voice/jobs/:jobId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await assertVoiceJob(req.user!.uid,req.params.jobId)});}
  catch(error:any){return failure(res,error,'Não foi possível carregar a geração de voz.');}
});

voiceGenerationRouter.post('/voice/jobs/:jobId/quote',async(req:AuthenticatedRequest,res)=>{
  try{
    await assertVoiceJob(req.user!.uid,req.params.jobId);
    const job=await betaJobOrchestrator.quote(req.user!.uid,req.params.jobId,idem(req));
    return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível calcular os créditos da voz.');}
});

voiceGenerationRouter.post('/voice/jobs/:jobId/queue',async(req:AuthenticatedRequest,res)=>{
  try{
    await assertVoiceJob(req.user!.uid,req.params.jobId);
    const job=await betaJobOrchestrator.queue(req.user!.uid,req.params.jobId,idem(req),requestHost(req),req.user!.idToken);
    return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível iniciar a geração de voz.');}
});
