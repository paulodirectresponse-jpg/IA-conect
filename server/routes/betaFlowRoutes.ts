import { NextFunction,Response,Router } from 'express';
import { AuthenticatedRequest,requireAuth } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { betaFlowService } from '../beta/flows/flowService.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';

export const betaFlowRouter=Router();
function failure(res:Response,error:any,fallback:string){const n=normalizeBetaPublicError(error,fallback);return res.status(n.status).json({success:false,error:n.error});}
async function requireFlows(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const [beta,flows]=await Promise.all([catalogRepository.getFeatureFlag('beta.enabled'),catalogRepository.getFeatureFlag('beta.flows')]);
    if(!beta?.is_enabled)return failure(res,{code:'BETA_DISABLED'},'Beta indisponível.');
    if(!flows?.is_enabled)return failure(res,{code:'FLOWS_DISABLED'},'Fluxos indisponíveis.');
    next();
  }catch{return failure(res,{code:'BETA_ACCESS_UNAVAILABLE'},'Não foi possível validar o acesso.');}
}
betaFlowRouter.use('/beta/flows',requireAuth,requireFlows);
betaFlowRouter.get('/beta/flows',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.list(req.user!.uid)});}catch(error){return failure(res,error,'Não foi possível carregar seus fluxos.');}});
betaFlowRouter.get('/beta/flows/:flowId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.get(req.user!.uid,req.params.flowId)});}catch(error){return failure(res,error,'Não foi possível carregar o fluxo.');}});
betaFlowRouter.post('/beta/flows',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await betaFlowService.create(req.user!.uid,req.body||{})});}catch(error){return failure(res,error,'Não foi possível criar o fluxo.');}});
betaFlowRouter.put('/beta/flows/:flowId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.update(req.user!.uid,req.params.flowId,req.body||{})});}catch(error){return failure(res,error,'Não foi possível salvar o fluxo.');}});
betaFlowRouter.delete('/beta/flows/:flowId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.remove(req.user!.uid,req.params.flowId)});}catch(error){return failure(res,error,'Não foi possível remover o fluxo.');}});
