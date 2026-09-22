import {NextFunction,Response,Router} from 'express';
import {AuthenticatedRequest,requireAuth} from '../middleware/authMiddleware.js';
import {catalogRepository} from '../repositories/catalogRepository.js';
import {assetRepository} from '../repositories/assetRepository.js';
import {betaFlowService} from '../beta/flows/flowService.js';
import {betaFlowEconomicRuntimeService} from '../beta/flows/flowEconomicRuntimeService.js';
import {betaFlowRuntimeRepository} from '../beta/flows/flowRuntimeRepository.js';
import {normalizeBetaPublicError} from '../beta/http/publicError.js';
import {routingV2CatalogService} from '../routing-v2/catalogService.js';

export const spacesRouter=Router();
const STABLE_CAPABILITY_IDS=[
 'text-to-image','image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations',
 'text-to-video','image-to-video','first-frame','last-frame','video-extend','video-edit',
 'text-to-speech','music','text-to-3d','image-to-3d','multi-image-to-3d',
] as const;
function failure(res:Response,error:any,fallback:string){const n=normalizeBetaPublicError(error,fallback);return res.status(n.status).json({success:false,error:n.error});}
function idem(req:AuthenticatedRequest){return String(req.headers['idempotency-key']||'').trim();}
function host(req:AuthenticatedRequest){return req.get('host')||process.env.APP_URL;}
async function requireSpaces(_req:AuthenticatedRequest,res:Response,next:NextFunction){try{const flows=await catalogRepository.getFeatureFlag('beta.flows');if(!flows?.is_enabled)return failure(res,{code:'FLOWS_DISABLED'},'Spaces indisponível no momento.');next();}catch{return failure(res,{code:'FLOWS_DISABLED'},'Spaces indisponível no momento.');}}

spacesRouter.use('/spaces',requireAuth,requireSpaces);

spacesRouter.get('/spaces/catalog',async(_req:AuthenticatedRequest,res)=>{
 try{
  return res.json({success:true,data:{models:await routingV2CatalogService.listCapabilityModels([...STABLE_CAPABILITY_IDS])}});
 }catch(error){return failure(res,error,'Não foi possível carregar as ferramentas do Spaces.');}
});

spacesRouter.get('/spaces/assets',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await assetRepository.listUserAssets(req.user!.uid,{includeUniversal:true})});}catch(error){return failure(res,error,'Não foi possível carregar seus assets.');}});
spacesRouter.get('/spaces/home',async(req:AuthenticatedRequest,res)=>{try{
 const userId=req.user!.uid;
 const [flows,nodeRuns,assets]=await Promise.all([
  betaFlowService.list(userId),
  betaFlowRuntimeRepository.listUserNodeRuns(userId,500),
  assetRepository.listUserAssets(userId,{includeUniversal:true}),
 ]);
 const assetMap=new Map(assets.filter(asset=>asset.type==='IMAGE'||asset.type==='VIDEO').map(asset=>[asset.asset_id,asset]));
 const byFlow=new Map<string,typeof assets>(),latestByFlowNode=new Map<string,typeof nodeRuns[number]>();
 for(const nodeRun of nodeRuns){
  if(nodeRun.status!=='SUCCEEDED'||nodeRun.reused_from_run_id||!nodeRun.output_asset_ids?.length)continue;
  const key=`${nodeRun.flow_id}:${nodeRun.node_id}`;
  if(!latestByFlowNode.has(key))latestByFlowNode.set(key,nodeRun);
  const bucket=byFlow.get(nodeRun.flow_id)||[];
  if(bucket.length<3){
   for(const assetId of nodeRun.output_asset_ids){
    const asset=assetMap.get(assetId);
    if(!asset||bucket.some(item=>item.asset_id===asset.asset_id))continue;
    bucket.push(asset);
    if(bucket.length>=3)break;
   }
   byFlow.set(nodeRun.flow_id,bucket);
  }
 }
 return res.json({success:true,data:flows.map(flow=>{
  const preview_nodes=(flow.graph?.nodes||[]).map(node=>{
   const width=Number(node.ui?.width)||((node.kind==='TOOL'&&['text-to-image','image-to-image','text-to-video','image-to-video'].includes(String(node.capability_id||'')))?286:260);
   const height=Number(node.ui?.height)||((node.kind==='TOOL'&&['text-to-image','image-to-image','text-to-video','image-to-video'].includes(String(node.capability_id||'')))?390:156);
   let asset=node.asset_id?assetMap.get(node.asset_id)||null:null;
   if(!asset&&node.kind==='TOOL'){
    const latest=latestByFlowNode.get(`${flow.flow_id}:${node.node_id}`);
    const outputId=latest?.output_asset_ids?.find(id=>assetMap.has(id));
    if(outputId)asset=assetMap.get(outputId)||null;
   }
   return{node_id:node.node_id,kind:node.kind,label:node.label,x:node.x,y:node.y,width,height,media_type:(asset?.type||node.media_type||null) as any,asset};
  });
  const graphAssets=preview_nodes.map(node=>node.asset).filter(Boolean) as typeof assets;
  const recent=byFlow.get(flow.flow_id)||[];
  const cover=graphAssets[0]||recent[0]||null;
  return{flow,cover_asset:cover,recent_assets:recent,preview_nodes};
 })});
}catch(error){return failure(res,error,'Não foi possível carregar a Home dos Spaces.');}});
spacesRouter.get('/spaces/flows',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.list(req.user!.uid)});}catch(error){return failure(res,error,'Não foi possível carregar seus Spaces.');}});
spacesRouter.get('/spaces/flows/:flowId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.get(req.user!.uid,req.params.flowId)});}catch(error){return failure(res,error,'Não foi possível carregar o Space.');}});
spacesRouter.get('/spaces/flows/:flowId/runs',async(req:AuthenticatedRequest,res)=>{try{const limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));return res.json({success:true,data:await betaFlowEconomicRuntimeService.listFlowPublic(req.user!.uid,req.params.flowId,limit)});}catch(error){return failure(res,error,'Não foi possível carregar o histórico do Space.');}});
spacesRouter.post('/spaces/flows',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await betaFlowService.create(req.user!.uid,req.body||{})});}catch(error){return failure(res,error,'Não foi possível criar o Space.');}});
spacesRouter.put('/spaces/flows/:flowId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.update(req.user!.uid,req.params.flowId,req.body||{})});}catch(error){return failure(res,error,'Não foi possível salvar o Space.');}});
spacesRouter.delete('/spaces/flows/:flowId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowService.remove(req.user!.uid,req.params.flowId)});}catch(error){return failure(res,error,'Não foi possível remover o Space.');}});
spacesRouter.post('/spaces/flows/:flowId/economics/quote',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.quote(req.user!.uid,req.params.flowId,req.body||{})});}catch(error){return failure(res,error,'Não foi possível calcular o orçamento do Space.');}});
spacesRouter.post('/spaces/flows/:flowId/runs',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await betaFlowEconomicRuntimeService.start(req.user!.uid,req.params.flowId,req.body||{},idem(req),host(req),req.user!.idToken)});}catch(error){return failure(res,error,'Não foi possível executar o Space.');}});
spacesRouter.get('/spaces/runs/:runId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.getPublic(req.user!.uid,req.params.runId)});}catch(error){return failure(res,error,'Não foi possível carregar a execução.');}});
spacesRouter.post('/spaces/runs/:runId/advance',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.advance(req.user!.uid,req.params.runId,host(req),req.user!.idToken)});}catch(error){return failure(res,error,'Não foi possível avançar a execução.');}});
spacesRouter.post('/spaces/runs/:runId/retry',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.retry(req.user!.uid,req.params.runId,host(req),req.user!.idToken)});}catch(error){return failure(res,error,'Não foi possível tentar novamente.');}});
spacesRouter.post('/spaces/runs/:runId/cancel',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaFlowEconomicRuntimeService.cancel(req.user!.uid,req.params.runId)});}catch(error){return failure(res,error,'Não foi possível cancelar a execução.');}});
