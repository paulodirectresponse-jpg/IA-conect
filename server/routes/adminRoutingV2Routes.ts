import { Router } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { isCapabilityId } from '../beta/capabilityRegistry.js';
import { routingV2ProviderService } from '../routing-v2/providerService.js';
import { routingV2ModelService } from '../routing-v2/modelService.js';
import { routingV2RouteService } from '../routing-v2/routeService.js';
import { routingV2Repository } from '../routing-v2/repository.js';
import { routingV2PricingSettingsService } from '../routing-v2/pricingSettingsService.js';
import { routingV2PriceSyncService } from '../routing-v2/priceSyncService.js';
import { routingV2AdapterRegistry } from '../routing-v2/adapterRegistry.js';
import { ensureRoutingV2LegacyAdapter } from '../routing-v2/legacyAdapterBridge.js';
import { routingV2ReadinessService } from '../routing-v2/readinessService.js';
import { routingV2CutoverService } from '../routing-v2/cutoverService.js';
import { routingV2ModelBootstrapService } from '../routing-v2/modelBootstrapService.js';
import { routingV2HealthAdminRoutes } from '../routing-v2/adminHealthRoutes.js';
import { routingV2RouteBootstrapService } from '../routing-v2/routeBootstrapService.js';
import { routingV2SmartRouter } from '../routing-v2/smartRouter.js';
import { factoryResetService } from '../services/factoryResetService.js';

export const adminRoutingV2Router=Router();
const guard=[requireAuth,requireAdmin] as const;

adminRoutingV2Router.use(...guard,routingV2HealthAdminRoutes);

adminRoutingV2Router.get('/admin/factory-reset/inventory',...guard,async(_req,res)=>{try{return res.json({success:true,data:await factoryResetService.inventory()});}catch(err){return error(res,err,'FACTORY_RESET_INVENTORY_FAILED');}});
adminRoutingV2Router.post('/admin/factory-reset/snapshot',...guard,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await factoryResetService.snapshot(req.user!.uid,req.body||{})});}catch(err){return error(res,err,'FACTORY_RESET_SNAPSHOT_FAILED');}});
adminRoutingV2Router.post('/admin/factory-reset/execute',...guard,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await factoryResetService.execute(req.body||{},req.user!.uid)});}catch(err){return error(res,err,'FACTORY_RESET_EXECUTION_FAILED');}});
adminRoutingV2Router.post('/admin/factory-reset/rollback/:snapshotId',...guard,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await factoryResetService.rollback(req.params.snapshotId,req.user!.uid,req.body||{})});}catch(err){return error(res,err,'FACTORY_RESET_ROLLBACK_FAILED');}});

function adapterFor(provider:any){
  const registered=routingV2AdapterRegistry.get(provider.adapter_id);
  if(registered)return registered;
  if(String(provider.adapter_id||'').startsWith('legacy:'))return ensureRoutingV2LegacyAdapter(provider.provider_id);
  return null;
}
function error(res:any,err:any,code='ROUTING_V2_ADMIN_ERROR'){
  return res.status(400).json({success:false,error:{code:err?.code||code,message:err?.message||'Operação V2 inválida.'}});
}

adminRoutingV2Router.get('/admin/routing-v2/providers',...guard,async(_req,res)=>{
  try{return res.json({success:true,data:await routingV2ProviderService.list()});}catch(err){return error(res,err);}
});
adminRoutingV2Router.post('/admin/routing-v2/providers/bootstrap-core',...guard,async(_req,res)=>{
  try{
    if(String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()!=='true'){
      return res.status(409).json({success:false,error:{code:'ROUTING_V2_BOOTSTRAP_PREVIEW_ONLY',message:'Bootstrap inicial de providers está liberado apenas no preview isolado.'}});
    }
    return res.json({success:true,data:await routingV2ProviderService.bootstrapCore()});
  }catch(err){return error(res,err,'ROUTING_V2_PROVIDER_BOOTSTRAP_FAILED');}
});
adminRoutingV2Router.post('/admin/routing-v2/providers',...guard,async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await routingV2ProviderService.create(req.body)});}catch(err){return error(res,err,'ROUTING_V2_PROVIDER_CREATE_FAILED');}
});
adminRoutingV2Router.patch('/admin/routing-v2/providers/:providerId',...guard,async(req,res)=>{
  try{return res.json({success:true,data:await routingV2ProviderService.update(req.params.providerId,req.body)});}catch(err){return error(res,err,'ROUTING_V2_PROVIDER_UPDATE_FAILED');}
});
adminRoutingV2Router.post('/admin/routing-v2/providers/:providerId/disable',...guard,async(req,res)=>{
  try{return res.json({success:true,data:await routingV2ProviderService.disable(req.params.providerId)});}catch(err){return error(res,err);}
});
adminRoutingV2Router.get('/admin/routing-v2/providers/:providerId/catalog-models',...guard,async(req,res)=>{
  try{
    const provider=await routingV2ProviderService.get(req.params.providerId);
    if(!provider)return res.status(404).json({success:false,error:{code:'ROUTING_V2_PROVIDER_NOT_FOUND',message:'Provider V2 não encontrado.'}});
    const adapter=adapterFor(provider);
    if(!adapter?.listModels)return res.status(409).json({success:false,error:{code:'ROUTING_V2_CATALOG_UNAVAILABLE',message:'Este provider não oferece catálogo de modelos pelo adapter V2.'}});
    if(!adapter.isConfigured(provider))return res.status(409).json({success:false,error:{code:'ROUTING_V2_PROVIDER_NOT_CONFIGURED',message:'Provider V2 não está configurado.'}});
    const q=String(req.query.q||'').trim().toLowerCase();
    const limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));
    const rows=(await adapter.listModels(provider)).filter(row=>!q||row.name.toLowerCase().includes(q)||row.provider_model_identifier.toLowerCase().includes(q)).slice(0,limit);
    return res.json({success:true,data:rows});
  }catch(err){return error(res,err,'ROUTING_V2_PROVIDER_CATALOG_FAILED');}
});

adminRoutingV2Router.get('/admin/routing-v2/models',...guard,async(_req,res)=>{
  try{return res.json({success:true,data:await routingV2ModelService.list()});}catch(err){return error(res,err);}
});
adminRoutingV2Router.post('/admin/routing-v2/models/bootstrap-canonical',...guard,async(_req,res)=>{
  try{
    if(String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()!=='true'){
      return res.status(409).json({success:false,error:{code:'ROUTING_V2_BOOTSTRAP_PREVIEW_ONLY',message:'Bootstrap de models canônicos está liberado apenas no preview isolado.'}});
    }
    return res.json({success:true,data:await routingV2ModelBootstrapService.bootstrapCanonical()});
  }catch(err){return error(res,err,'ROUTING_V2_MODEL_BOOTSTRAP_FAILED');}
});
adminRoutingV2Router.post('/admin/routing-v2/models',...guard,async(req,res)=>{
  try{return res.json({success:true,data:await routingV2ModelService.create(req.body)});}catch(err){return error(res,err,'ROUTING_V2_MODEL_CREATE_FAILED');}
});
adminRoutingV2Router.patch('/admin/routing-v2/models/:modelId/capabilities',...guard,async(req,res)=>{
  try{
    const raw=Array.isArray(req.body?.capabilities)?req.body.capabilities.map(String):[];
    const capabilities=raw.filter(isCapabilityId);
    return res.json({success:true,data:await routingV2ModelService.setCapabilities(req.params.modelId,capabilities)});
  }catch(err){return error(res,err,'ROUTING_V2_MODEL_UPDATE_FAILED');}
});
adminRoutingV2Router.post('/admin/routing-v2/models/:modelId/disable',...guard,async(req,res)=>{
  try{return res.json({success:true,data:await routingV2ModelService.disable(req.params.modelId)});}catch(err){return error(res,err);}
});

adminRoutingV2Router.get('/admin/routing-v2/routes',...guard,async(req,res)=>{
  try{
    const providerId=String(req.query.provider_id||'').trim();
    const modelId=String(req.query.model_id||'').trim();
    const capability=String(req.query.capability_id||'').trim();
    let rows=providerId?await routingV2RouteService.listByProvider(providerId):await routingV2RouteService.list();
    if(modelId)rows=rows.filter(row=>row.model_id===modelId);
    if(capability)rows=rows.filter(row=>row.capability_id===capability);
    return res.json({success:true,data:rows});
  }catch(err){return error(res,err);}
});
adminRoutingV2Router.post('/admin/routing-v2/routes/bootstrap-canonical',...guard,async(_req,res)=>{
  try{
    if(String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()!=='true'){
      return res.status(409).json({success:false,error:{code:'ROUTING_V2_BOOTSTRAP_PREVIEW_ONLY',message:'Bootstrap de routes canônicas está liberado apenas no preview isolado.'}});
    }
    return res.json({success:true,data:await routingV2RouteBootstrapService.bootstrapCanonical()});
  }catch(err){return error(res,err,'ROUTING_V2_ROUTE_BOOTSTRAP_FAILED');}
});
adminRoutingV2Router.post('/admin/routing-v2/routes',...guard,async(req,res)=>{
  try{return res.json({success:true,data:await routingV2RouteService.create(req.body)});}catch(err){return error(res,err,'ROUTING_V2_ROUTE_CREATE_FAILED');}
});
adminRoutingV2Router.patch('/admin/routing-v2/routes/:routeId',...guard,async(req,res)=>{
  try{return res.json({success:true,data:await routingV2RouteService.update(req.params.routeId,req.body)});}catch(err){return error(res,err,'ROUTING_V2_ROUTE_UPDATE_FAILED');}
});
adminRoutingV2Router.post('/admin/routing-v2/routes/:routeId/disable',...guard,async(req,res)=>{
  try{return res.json({success:true,data:await routingV2RouteService.disable(req.params.routeId)});}catch(err){return error(res,err);}
});

adminRoutingV2Router.get('/admin/routing-v2/pricing/settings',...guard,async(_req,res)=>{
  try{return res.json({success:true,data:await routingV2PricingSettingsService.get()});}catch(err){return error(res,err);}
});
adminRoutingV2Router.post('/admin/routing-v2/pricing/settings',...guard,async(req,res)=>{
  try{
    const current=await routingV2PricingSettingsService.get();
    const input={...current,...req.body};
    delete (input as any).settings_id;delete (input as any).updated_at;
    return res.json({success:true,data:await routingV2PricingSettingsService.save(input)});
  }catch(err){return error(res,err,'ROUTING_V2_PRICING_SETTINGS_FAILED');}
});
adminRoutingV2Router.post('/admin/routing-v2/pricing/sync',...guard,async(req,res)=>{
  try{return res.json({success:true,data:await routingV2PriceSyncService.runBatch({cursor:req.body?.cursor,limit:req.body?.limit,fx_rate_usd_brl:req.body?.fx_rate_usd_brl})});}catch(err){return error(res,err,'ROUTING_V2_PRICE_SYNC_FAILED');}
});
adminRoutingV2Router.get('/admin/routing-v2/health',...guard,async(_req,res)=>{
  try{
    const[providers,models,routes,settings]=await Promise.all([
      routingV2Repository.listProviders(),routingV2Repository.listModels(),routingV2Repository.listRoutes(),routingV2PricingSettingsService.get(),
    ]);
    const ready=routes.filter(r=>r.status==='READY').length;
    const degraded=routes.filter(r=>r.status==='DEGRADED').length;
    const stale=routes.filter(r=>r.pricing_status==='STALE').length;
    return res.json({success:true,data:{
      checked_at:new Date().toISOString(),
      providers:{total:providers.length,active:providers.filter(p=>p.status==='ACTIVE').length,healthy:providers.filter(p=>p.health_status==='HEALTHY').length,rows:providers},
      models:{total:models.length,active:models.filter(m=>m.status==='ACTIVE').length},
      routes:{total:routes.length,ready,degraded,stale,disabled:routes.filter(r=>r.status==='DISABLED').length},
      pricing:{price_sync_interval_minutes:settings.price_sync_interval_minutes,price_freshness_ttl_minutes:settings.price_freshness_ttl_minutes},
    }});
  }catch(err){return error(res,err,'ROUTING_V2_HEALTH_FAILED');}
});


adminRoutingV2Router.get('/admin/routing-v2/readiness',...guard,async(_req,res)=>{
  try{return res.json({success:true,data:await routingV2ReadinessService.audit()});}catch(err){return error(res,err,'ROUTING_V2_READINESS_FAILED');}
});
adminRoutingV2Router.post('/admin/routing-v2/reset-preview',...guard,async(req:AuthenticatedRequest,res)=>{
  try{
    if(String(req.body?.confirm||'')!=='RESET_ROUTING_V2_PREVIEW'){
      return res.status(400).json({success:false,error:{code:'ROUTING_V2_RESET_CONFIRMATION_REQUIRED',message:'Confirmação explícita do reset é obrigatória.'}});
    }
    return res.json({success:true,data:await routingV2Repository.resetInventoryForPreview()});
  }catch(err){return error(res,err,'ROUTING_V2_RESET_FAILED');}
});
adminRoutingV2Router.get('/admin/routing-v2/cutover',...guard,async(_req,res)=>{
  try{return res.json({success:true,data:await routingV2CutoverService.get()});}catch(err){return error(res,err,'ROUTING_V2_CUTOVER_READ_FAILED');}
});

adminRoutingV2Router.get('/admin/routing-v2/smart-router/readiness',...guard,async(_req,res)=>{
  try{return res.json({success:true,data:await routingV2SmartRouter.getReadinessStatus()});}catch(err){return error(res,err,'ROUTING_V2_SMART_ROUTER_READINESS_FAILED');}
});

adminRoutingV2Router.post('/admin/routing-v2/smart-router/select',...guard,async(req,res)=>{
  try{return res.json({success:true,data:await routingV2SmartRouter.selectRoute(req.body||{})});}catch(err){return error(res,err,'ROUTING_V2_SMART_ROUTER_SELECT_FAILED');}
});
adminRoutingV2Router.post('/admin/routing-v2/cutover',...guard,async(req:AuthenticatedRequest,res)=>{
  try{
    const mode=String(req.body?.mode||'') as 'HYBRID'|'V2_ONLY';
    return res.json({success:true,data:await routingV2CutoverService.set(mode,req.user?.uid||null)});
  }catch(err:any){
    const status=err?.code==='ROUTING_V2_CUTOVER_NOT_READY'?409:400;
    return res.status(status).json({success:false,error:{code:err?.code||'ROUTING_V2_CUTOVER_FAILED',message:err?.message||'Cutover inválido.',details:err?.details}});
  }
});
