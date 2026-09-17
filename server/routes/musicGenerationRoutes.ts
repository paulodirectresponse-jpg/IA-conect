import { Router,Response,NextFunction } from 'express';
import { requireAuth,AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { publicCapabilityCatalog } from '../beta/capabilityRegistry.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { betaJobOrchestrator } from '../beta/jobs/jobOrchestrator.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';

export const musicGenerationRouter=Router();
const CAPABILITY='music';

function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function requestHost(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}
function failure(res:Response,error:any,fallback:string){
  const normalized=normalizeBetaPublicError(error,fallback);
  return res.status(normalized.status).json({success:false,error:normalized.error});
}

async function requireMusicEnabled(_req:AuthenticatedRequest,res:Response,next:NextFunction){
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

async function assertMusicJob(userId:string,jobId:string){
  const job=await betaJobOrchestrator.getPublic(userId,jobId);
  if(job?.request?.capability_id!==CAPABILITY){
    throw Object.assign(new Error('Geração de música não encontrada.'),{code:'JOB_NOT_FOUND'});
  }
  return job;
}

musicGenerationRouter.use('/music',requireAuth,requireMusicEnabled);

musicGenerationRouter.get('/music/catalog',async(req:AuthenticatedRequest,res)=>{
  try{
    const models=await catalogRepository.listModels();
    const base=publicCapabilityCatalog(models);
    const policies=await betaCatalogPolicyService.listCatalog();
    const policyByModel=new Map(policies.map(policy=>[policy.model_id,policy]));
    const governed=base.flatMap(model=>{
      const policy=policyByModel.get(model.model_id);
      if(!policy?.eligible||!policy.capability_ids.includes(CAPABILITY as any))return[];
      const capability=model.capabilities.find(item=>item.id===CAPABILITY);
      return capability?[{...model,capabilities:[capability],pricing_policy_id:policy.pricing_policy_id}]:[];
    });
    const autoEligible=policies.some(policy=>policy.eligible&&policy.auto_routing_enabled&&policy.capability_ids.includes(CAPABILITY as any));
    if(autoEligible){
      const sample=governed.find(model=>model.capabilities.length)?.capabilities[0];
      if(sample)governed.unshift({model_id:'AUTO',name:'AUTO',category:'AUTO',supported_durations:sample.supported_durations||[],capabilities:[sample],pricing_policy_id:null} as any);
    }
    return res.json({success:true,data:{models:governed}});
  }catch(error:any){return failure(res,error,'Não foi possível carregar o gerador de música.');}
});

musicGenerationRouter.post('/music/jobs',async(req:AuthenticatedRequest,res)=>{
  try{
    const body={...req.body,capability_id:CAPABILITY,references:[]};
    const job=await betaJobOrchestrator.create(req.user!.uid,body,idem(req));
    return res.status(201).json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível preparar a geração de música.');}
});

musicGenerationRouter.get('/music/jobs/:jobId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await assertMusicJob(req.user!.uid,req.params.jobId)});}
  catch(error:any){return failure(res,error,'Não foi possível carregar a geração de música.');}
});

musicGenerationRouter.post('/music/jobs/:jobId/quote',async(req:AuthenticatedRequest,res)=>{
  try{
    await assertMusicJob(req.user!.uid,req.params.jobId);
    const job=await betaJobOrchestrator.quote(req.user!.uid,req.params.jobId,idem(req));
    return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível calcular os créditos da música.');}
});

musicGenerationRouter.post('/music/jobs/:jobId/queue',async(req:AuthenticatedRequest,res)=>{
  try{
    await assertMusicJob(req.user!.uid,req.params.jobId);
    const job=await betaJobOrchestrator.queue(req.user!.uid,req.params.jobId,idem(req),requestHost(req),req.user!.idToken);
    return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível iniciar a geração de música.');}
});
