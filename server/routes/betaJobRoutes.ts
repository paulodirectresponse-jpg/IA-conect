import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { betaJobOrchestrator } from '../beta/jobs/jobOrchestrator.js';

export const betaJobRouter=Router();

async function requireBetaEnabled(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const flag=await catalogRepository.getFeatureFlag('beta.enabled');
    if(!flag?.is_enabled)return res.status(404).json({success:false,error:{code:'BETA_DISABLED',message:'A experiência Beta não está disponível.'}});
    next();
  }catch{
    return res.status(503).json({success:false,error:{code:'BETA_ACCESS_UNAVAILABLE',message:'Não foi possível validar o acesso ao Beta.'}});
  }
}

function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function requestHost(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}
function statusFor(error:any){
  if(error?.code==='JOB_NOT_FOUND')return 404;
  if(['JOB_INVALID_STATE','JOB_RETRY_UNAVAILABLE','PRICE_CHANGED_REQUOTE_REQUIRED'].includes(error?.code))return 409;
  if(error?.code==='CREDIT_INSUFFICIENT_FUNDS')return 402;
  if(['NO_SAFE_PROVIDER_AVAILABLE','BETA_ACCESS_UNAVAILABLE'].includes(error?.code))return 503;
  return 400;
}
function failure(res:Response,error:any,fallback:string){
  return res.status(statusFor(error)).json({success:false,error:{code:error?.code||'JOB_ERROR',message:error?.message||fallback}});
}

betaJobRouter.use('/beta/jobs',requireAuth,requireBetaEnabled);

betaJobRouter.post('/beta/jobs',async(req:AuthenticatedRequest,res)=>{
  try{
    const job=await betaJobOrchestrator.create(req.user!.uid,req.body,idem(req));
    return res.status(201).json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível criar o job.');}
});

betaJobRouter.get('/beta/jobs',async(req:AuthenticatedRequest,res)=>{
  try{
    const limit=Math.min(100,Math.max(1,Number(req.query.limit||50)));
    return res.json({success:true,data:await betaJobOrchestrator.listPublic(req.user!.uid,limit)});
  }catch(error:any){return failure(res,error,'Não foi possível carregar os jobs.');}
});

betaJobRouter.get('/beta/jobs/:jobId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,req.params.jobId)});}
  catch(error:any){return failure(res,error,'Não foi possível carregar o job.');}
});

betaJobRouter.post('/beta/jobs/:jobId/quote',async(req:AuthenticatedRequest,res)=>{
  try{
    const job=await betaJobOrchestrator.quote(req.user!.uid,req.params.jobId,idem(req));
    return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível cotar o job.');}
});

betaJobRouter.post('/beta/jobs/:jobId/queue',async(req:AuthenticatedRequest,res)=>{
  try{
    const job=await betaJobOrchestrator.queue(req.user!.uid,req.params.jobId,idem(req),requestHost(req),req.user!.idToken);
    return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível iniciar o job.');}
});

betaJobRouter.post('/beta/jobs/:jobId/retry',async(req:AuthenticatedRequest,res)=>{
  try{
    const job=await betaJobOrchestrator.retry(req.user!.uid,req.params.jobId,idem(req),requestHost(req),req.user!.idToken);
    return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível tentar o job novamente.');}
});

betaJobRouter.post('/beta/jobs/:jobId/cancel',async(req:AuthenticatedRequest,res)=>{
  try{
    const job=await betaJobOrchestrator.cancel(req.user!.uid,req.params.jobId,idem(req));
    return res.json({success:true,data:await betaJobOrchestrator.getPublic(req.user!.uid,job.job_id)});
  }catch(error:any){return failure(res,error,'Não foi possível cancelar o job.');}
});
