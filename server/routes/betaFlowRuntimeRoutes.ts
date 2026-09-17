import { Router,Response } from 'express';
import { AuthenticatedRequest,requireAuth } from '../middleware/authMiddleware.js';
import { betaFlowEconomicRuntimeService } from '../beta/flows/flowEconomicRuntimeService.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';

export const betaFlowRuntimeRouter=Router();
function failure(res:Response,error:any,fallback:string){const n=normalizeBetaPublicError(error,fallback);return res.status(n.status).json({success:false,error:n.error});}
function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function host(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}

betaFlowRuntimeRouter.use('/beta/flows/:flowId/runs',requireAuth);
betaFlowRuntimeRouter.use('/beta/flows/:flowId/economics',requireAuth);
betaFlowRuntimeRouter.use('/beta/flow-runs',requireAuth);

betaFlowRuntimeRouter.post('/beta/flows/:flowId/economics/quote',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.quote(req.user!.uid,req.params.flowId,req.body||{})});}
  catch(error){return failure(res,error,'Não foi possível autorizar o orçamento do Flow.');}
});
betaFlowRuntimeRouter.post('/beta/flows/:flowId/runs',async(req:AuthenticatedRequest,res)=>{
  try{return res.status(201).json({success:true,data:await betaFlowEconomicRuntimeService.start(req.user!.uid,req.params.flowId,req.body||{},idem(req),host(req),req.user!.idToken)});}
  catch(error){return failure(res,error,'Não foi possível iniciar o fluxo.');}
});
betaFlowRuntimeRouter.get('/beta/flow-runs',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.listPublic(req.user!.uid,Number(req.query.limit||30))});}
  catch(error){return failure(res,error,'Não foi possível carregar as execuções.');}
});
betaFlowRuntimeRouter.get('/beta/flow-runs/:runId',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.getPublic(req.user!.uid,req.params.runId)});}
  catch(error){return failure(res,error,'Não foi possível carregar a execução.');}
});
betaFlowRuntimeRouter.post('/beta/flow-runs/:runId/advance',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.advance(req.user!.uid,req.params.runId,host(req),req.user!.idToken)});}
  catch(error){return failure(res,error,'Não foi possível avançar a execução.');}
});
betaFlowRuntimeRouter.post('/beta/flow-runs/:runId/retry',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.retry(req.user!.uid,req.params.runId,host(req),req.user!.idToken)});}
  catch(error){return failure(res,error,'Não foi possível tentar o fluxo novamente.');}
});
betaFlowRuntimeRouter.post('/beta/flow-runs/:runId/cancel',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.cancel(req.user!.uid,req.params.runId)});}
  catch(error){return failure(res,error,'Não foi possível cancelar o fluxo.');}
});
