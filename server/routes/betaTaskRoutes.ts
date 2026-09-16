import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { betaTaskService } from '../beta/tasks/taskService.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';

export const betaTaskRouter=Router();

async function requireBetaEnabled(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const flag=await catalogRepository.getFeatureFlag('beta.enabled');
    if(!flag?.is_enabled){
      const normalized=normalizeBetaPublicError({code:'BETA_DISABLED'});
      return res.status(normalized.status).json({success:false,error:normalized.error});
    }
    next();
  }catch{
    const normalized=normalizeBetaPublicError({code:'BETA_ACCESS_UNAVAILABLE'});
    return res.status(normalized.status).json({success:false,error:normalized.error});
  }
}

function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function requestHost(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}
function failure(res:Response,error:any,fallback:string){
  const normalized=normalizeBetaPublicError(error,fallback);
  return res.status(normalized.status).json({success:false,error:normalized.error});
}

betaTaskRouter.use('/beta/tasks',requireAuth,requireBetaEnabled);

betaTaskRouter.get('/beta/tasks',async(req:AuthenticatedRequest,res)=>{
  try{
    const limit=Math.min(100,Math.max(1,Number(req.query.limit||30)));
    return res.json({success:true,data:await betaTaskService.list(req.user!.uid,limit)});
  }catch(error:any){return failure(res,error,'Não foi possível carregar as tarefas.');}
});

betaTaskRouter.get('/beta/tasks/:taskId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaTaskService.get(req.user!.uid,req.params.taskId)});}
  catch(error:any){return failure(res,error,'Não foi possível carregar a tarefa.');}
});

betaTaskRouter.post('/beta/tasks/:taskId/retry',async(req:AuthenticatedRequest,res)=>{
  try{
    const task=await betaTaskService.retry(req.user!.uid,req.params.taskId,idem(req),requestHost(req),req.user!.idToken);
    return res.json({success:true,data:task});
  }catch(error:any){return failure(res,error,'Não foi possível tentar esta tarefa novamente.');}
});

betaTaskRouter.post('/beta/tasks/:taskId/cancel',async(req:AuthenticatedRequest,res)=>{
  try{
    const task=await betaTaskService.cancel(req.user!.uid,req.params.taskId,idem(req));
    return res.json({success:true,data:task});
  }catch(error:any){return failure(res,error,'Não foi possível cancelar esta tarefa.');}
});
