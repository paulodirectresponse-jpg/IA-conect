import {NextFunction,Response,Router} from 'express';
import {AuthenticatedRequest,requireAuth} from '../middleware/authMiddleware.js';
import {catalogRepository} from '../repositories/catalogRepository.js';
import {assetRepository} from '../repositories/assetRepository.js';
import {publicCapabilityCatalog,getCapabilityDefinition} from '../beta/capabilityRegistry.js';
import {betaCatalogPolicyService} from '../beta/catalog/catalogPolicyService.js';
import {betaFlowService} from '../beta/flows/flowService.js';
import {betaFlowEconomicRuntimeService} from '../beta/flows/flowEconomicRuntimeService.js';
import {normalizeBetaPublicError} from '../beta/http/publicError.js';

export const spacesRouter=Router();
function failure(res:Response,error:any,fallback:string){const n=normalizeBetaPublicError(error,fallback);return res.status(n.status).json({success:false,error:n.error});}
function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function host(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}
function intersection<T>(rows:T[][]):T[]{if(!rows.length)return[];return rows[0].filter(value=>rows.every(row=>row.includes(value)));}
async function requireSpaces(_req:AuthenticatedRequest,res:Response,next:NextFunction){try{const flows=await catalogRepository.getFeatureFlag('beta.flows');if(!flows?.is_enabled)return failure(res,{code:'FLOWS_DISABLED'},'Spaces indisponível no momento.');next();}catch{return failure(res,{code:'FLOWS_DISABLED'},'Spaces indisponível no momento.');}}

spacesRouter.use('/spaces',requireAuth,requireSpaces);

spacesRouter.get('/spaces/catalog',async(_req:AuthenticatedRequest,res)=>{
 try{
  const models=await catalogRepository.listModels();
  const base=publicCapabilityCatalog(models);
  const policies=await betaCatalogPolicyService.listCatalog();
  const policyByModel=new Map(policies.map(policy=>[policy.model_id,policy]));
  const governed=base.map(model=>{const policy=policyByModel.get(model.model_id);if(!policy?.eligible)return null;const allowed=new Set(policy.capability_ids);const capabilities=model.capabilities.filter(cap=>allowed.has(cap.id as any));return capabilities.length?{...model,capabilities,pricing_policy_id:policy.pricing_policy_id}:null;}).filter(Boolean) as any[];
  const autoPolicies=policies.filter(policy=>policy.eligible&&policy.auto_routing_enabled);
  const autoPolicyIds=new Set(autoPolicies.map(policy=>policy.model_id));
  const autoCapabilities=Array.from(new Set(autoPolicies.flatMap(policy=>policy.capability_ids))).map(id=>{
   const def=getCapabilityDefinition(id);if(!def)return null;
   const supporting=governed.filter(model=>autoPolicyIds.has(model.model_id)).flatMap(model=>model.capabilities.filter((cap:any)=>cap.id===id));
   if(!supporting.length)return null;
   const controls=supporting[0].controls.filter((control:string)=>supporting.every((cap:any)=>cap.controls.includes(control)));
   const durations=intersection<number>(supporting.map((cap:any)=>cap.supported_durations||[]));
   const resolutions=intersection<string>(supporting.map((cap:any)=>cap.supported_resolutions||[]));
   const ratios=intersection<string>(supporting.map((cap:any)=>cap.supported_aspect_ratios||[]));
   return{id,inputs:def.inputs,outputs:def.outputs,controls:controls.filter((c:string)=>c!=='duration'||durations.length).filter((c:string)=>c!=='resolution'||resolutions.length).filter((c:string)=>c!=='aspect_ratio'||ratios.length),supported_durations:durations,supported_resolutions:resolutions,supported_aspect_ratios:ratios};
  }).filter(Boolean);
  if(autoCapabilities.length)governed.unshift({model_id:'AUTO',name:'AUTO',category:'AUTO',capabilities:autoCapabilities,pricing_policy_id:null});
  return res.json({success:true,data:{models:governed}});
 }catch(error){return failure(res,error,'Não foi possível carregar as ferramentas do Spaces.');}
});

spacesRouter.get('/spaces/assets',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await assetRepository.listUserAssets(req.user!.uid,{includeUniversal:true})});}catch(error){return failure(res,error,'Não foi possível carregar seus assets.');}});
spacesRouter.get('/spaces/flows',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.list(req.user!.uid)});}catch(error){return failure(res,error,'Não foi possível carregar seus Spaces.');}});
spacesRouter.get('/spaces/flows/:flowId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.get(req.user!.uid,req.params.flowId)});}catch(error){return failure(res,error,'Não foi possível carregar o Space.');}});
spacesRouter.post('/spaces/flows',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await betaFlowService.create(req.user!.uid,req.body||{})});}catch(error){return failure(res,error,'Não foi possível criar o Space.');}});
spacesRouter.put('/spaces/flows/:flowId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.update(req.user!.uid,req.params.flowId,req.body||{})});}catch(error){return failure(res,error,'Não foi possível salvar o Space.');}});
spacesRouter.delete('/spaces/flows/:flowId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.remove(req.user!.uid,req.params.flowId)});}catch(error){return failure(res,error,'Não foi possível remover o Space.');}});
spacesRouter.post('/spaces/flows/:flowId/economics/quote',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.quote(req.user!.uid,req.params.flowId,req.body||{})});}catch(error){return failure(res,error,'Não foi possível calcular o orçamento do Space.');}});
spacesRouter.post('/spaces/flows/:flowId/runs',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await betaFlowEconomicRuntimeService.start(req.user!.uid,req.params.flowId,req.body||{},idem(req),host(req),req.user!.idToken)});}catch(error){return failure(res,error,'Não foi possível executar o Space.');}});
spacesRouter.get('/spaces/runs/:runId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.getPublic(req.user!.uid,req.params.runId)});}catch(error){return failure(res,error,'Não foi possível carregar a execução.');}});
spacesRouter.post('/spaces/runs/:runId/advance',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.advance(req.user!.uid,req.params.runId,host(req),req.user!.idToken)});}catch(error){return failure(res,error,'Não foi possível avançar a execução.');}});
spacesRouter.post('/spaces/runs/:runId/retry',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.retry(req.user!.uid,req.params.runId,host(req),req.user!.idToken)});}catch(error){return failure(res,error,'Não foi possível tentar novamente.');}});
spacesRouter.post('/spaces/runs/:runId/cancel',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.cancel(req.user!.uid,req.params.runId)});}catch(error){return failure(res,error,'Não foi possível cancelar a execução.');}});
