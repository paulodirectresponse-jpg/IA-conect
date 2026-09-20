import crypto from 'crypto';
import { Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware.js';
import { routingV2ProviderService } from '../routing-v2/providerService.js';
import { routingV2ModelBootstrapService } from '../routing-v2/modelBootstrapService.js';
import { routingV2RouteBootstrapService } from '../routing-v2/routeBootstrapService.js';
import { routingV2PriceSyncService } from '../routing-v2/priceSyncService.js';
import { creditWalletService } from '../services/creditWalletService.js';
import { fxRateService } from '../services/fxRateService.js';
import { betaJobOrchestrator } from '../beta/jobs/jobOrchestrator.js';

export const previewRoutingV2ValidationRouter=Router();
const ONE_TIME_VALIDATION_SECRET_SHA256='c27fe25227bd557734b617090ce8cc633ab4a65cd90dc275fdf0faf5f6f79985';

function validationGuard(req:AuthenticatedRequest,res:any,next:any){
  if(String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()!=='true'){
    return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Recurso não encontrado.'}});
  }
  const expected=String(process.env.ROUTING_V2_VALIDATION_SECRET||'');
  const supplied=String(req.headers['x-routing-v2-validation-secret']||'');
  const configuredValid=expected.length>=32&&supplied.length===expected.length&&crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
  const oneTimeValid=supplied.length>=32&&crypto.createHash('sha256').update(supplied).digest('hex')===ONE_TIME_VALIDATION_SECRET_SHA256;
  const valid=configuredValid||oneTimeValid;
  if(!valid)return res.status(403).json({success:false,error:{code:'ROUTING_V2_VALIDATION_FORBIDDEN',message:'Validação técnica não autorizada.'}});
  return next();
}

previewRoutingV2ValidationRouter.post('/preview/routing-v2/bootstrap',requireAuth,validationGuard,async(_req,res)=>{
  try{
    const providers=await routingV2ProviderService.bootstrapCore();
    const models=await routingV2ModelBootstrapService.bootstrapCanonical();
    const routes=await routingV2RouteBootstrapService.bootstrapCanonical();
    const fx=await fxRateService.get(true);
    const pricing=await routingV2PriceSyncService.runBatch({cursor:0,limit:10,fx_rate_usd_brl:fx.rate});
    return res.json({success:true,data:{providers,models,routes,pricing}});
  }catch(error:any){
    return res.status(400).json({success:false,error:{code:error?.code||'ROUTING_V2_PREVIEW_BOOTSTRAP_FAILED',message:error?.message||'Falha no bootstrap verificável do preview.'}});
  }
});

previewRoutingV2ValidationRouter.post('/preview/routing-v2/fund-runtime-user',requireAuth,validationGuard,async(req:AuthenticatedRequest,res)=>{
  try{
    const email=String(req.user?.email||'').toLowerCase();
    if(!/^routing-v2-runtime-[a-z0-9-]+@example\.com$/.test(email)){
      return res.status(403).json({success:false,error:{code:'ROUTING_V2_RUNTIME_USER_REQUIRED',message:'A conta autenticada não é uma conta sintética de validação.'}});
    }
    const credits=Math.min(200,Math.max(1,Math.floor(Number(req.body?.credits||100))));
    const account=await creditWalletService.issue({
      userId:req.user!.uid,credits,source:'COMPENSATION',
      idempotencyKey:`routing-v2-preview-runtime-fund:${req.user!.uid}`,
      referenceId:'routing-v2-preview-runtime-validation',netCashBackingMicros:0,
      metadata:{purpose:'ROUTING_V2_RUNTIME_VALIDATION',preview:true},
    });
    return res.json({success:true,data:{account}});
  }catch(error:any){
    return res.status(400).json({success:false,error:{code:error?.code||'ROUTING_V2_RUNTIME_FUND_FAILED',message:error?.message||'Falha ao financiar a conta sintética.'}});
  }
});

previewRoutingV2ValidationRouter.post('/preview/routing-v2/run-job/:jobId',requireAuth,validationGuard,async(req:AuthenticatedRequest,res)=>{
  try{
    const job=await betaJobOrchestrator.runQueuedPreview(req.user!.uid,req.params.jobId);
    return res.json({success:true,data:job});
  }catch(error:any){
    return res.status(400).json({success:false,error:{code:error?.code||'ROUTING_V2_RUNTIME_JOB_FAILED',message:error?.message||'Falha ao executar o Job sintético.'}});
  }
});
