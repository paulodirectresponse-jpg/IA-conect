import crypto from 'crypto';
import express from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { CURATED_MODEL_BLUEPRINTS, CURATED_MODEL_POSITION_COUNTS } from '../../src/config/curatedModelInventory.js';
import { providerModelScanService } from '../services/providerModelScanService.js';
import { providerPricingCatalogService } from '../services/providerPricingCatalogService.js';
import { providerCatalogService } from '../services/providerCatalogService.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { verifiedLaunchRouteService } from '../services/verifiedLaunchRouteService.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { capabilityIdsForModel } from '../beta/capabilityRegistry.js';

export const providerScanRouter=express.Router();

providerScanRouter.get('/admin/provider-scan',requireAuth,requireAdmin,async(_req,res)=>{
  try{
    const [latest,pricing,mappings]=await Promise.all([
      providerModelScanService.latest(),
      providerPricingCatalogService.list(),
      catalogRepository.listMappings(),
    ]);
    res.json({success:true,data:{latest,pricing,mappings}});
  }
  catch(err:any){res.status(500).json({success:false,error:{code:'PROVIDER_SCAN_READ_ERROR',message:err?.message||'Falha ao carregar scans.'}});}
});

providerScanRouter.get('/admin/provider-scan/inventory',requireAuth,requireAdmin,async(_req,res)=>{
  try{
    // This endpoint is intentionally read-only. The curated inventory already
    // lives in source control and does not need dozens of Firestore writes just
    // to render the Admin page.
    res.json({success:true,data:{total_positions:CURATED_MODEL_BLUEPRINTS.length,counts:CURATED_MODEL_POSITION_COUNTS,models:CURATED_MODEL_BLUEPRINTS}});
  }catch(err:any){res.status(500).json({success:false,error:{code:'PROVIDER_INVENTORY_ERROR',message:err?.message||'Falha ao carregar acervo curado.'}});}
});

providerScanRouter.post('/admin/provider-scan',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{
    const providerId=String(req.body?.provider_id||'').trim();
    const data=providerId?await providerModelScanService.scanProvider(providerId):await providerModelScanService.scanAll();
    res.json({success:true,data});
  }catch(err:any){res.status(400).json({success:false,error:{code:err?.code||'PROVIDER_SCAN_ERROR',message:err?.message||'Falha no scan de providers.'}});}
});

providerScanRouter.get('/admin/provider-launch-routes',requireAuth,requireAdmin,async(_req,res)=>{
  try{return res.json({success:true,data:await verifiedLaunchRouteService.listStatus()});}
  catch(err:any){return res.status(500).json({success:false,error:{code:'VERIFIED_ROUTE_LIST_ERROR',message:err?.message||'Falha ao carregar rotas verificadas.'}});}
});

providerScanRouter.post('/admin/provider-launch-routes/:routeKey/apply',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{
    const before=(await verifiedLaunchRouteService.listStatus()).find(route=>route.key===req.params.routeKey)||null;
    const applied=await verifiedLaunchRouteService.apply(req.params.routeKey,req.user!.uid);
    const after=(await verifiedLaunchRouteService.listStatus()).find(route=>route.key===req.params.routeKey)||null;
    await auditRepository.record({
      log_id:`aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      admin_id:req.user!.uid,admin_email:req.user!.email,
      action:'VERIFIED_PROVIDER_ROUTE_APPLIED',entity_type:'PROVIDER',entity_id:req.params.routeKey,
      before,after,reason:'Ativação explícita de rota com endpoint, capability e preço verificados.',
      created_at:new Date().toISOString(),
    });
    return res.json({success:true,data:{...applied,status:after}});
  }catch(err:any){
    return res.status(400).json({success:false,error:{code:err?.code||'VERIFIED_ROUTE_APPLY_ERROR',message:err?.message||'Falha ao ativar rota verificada.'}});
  }
});

providerScanRouter.post('/admin/provider-pricing',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{
    const body=req.body||{};
    if(!body.provider_id||!body.provider_model_identifier||!body.unit||!Number.isFinite(Number(body.unit_price_usd)))throw Object.assign(new Error('provider_id, provider_model_identifier, unit e unit_price_usd são obrigatórios.'),{code:'VALIDATION_ERROR'});
    const verified=body.verified===true;
    const saved=await providerPricingCatalogService.save({
      provider_id:String(body.provider_id),provider_model_identifier:String(body.provider_model_identifier),capability_id:body.capability_id?String(body.capability_id):null,
      unit:body.unit,unit_price_usd:Number(body.unit_price_usd),minimum_usd:body.minimum_usd==null?null:Number(body.minimum_usd),
      resolution_prices_usd:body.resolution_prices_usd&&typeof body.resolution_prices_usd==='object'?body.resolution_prices_usd:undefined,
      verified,source:body.source==='LIVE_CATALOG'?'LIVE_CATALOG':body.source==='PROVIDER_DOCS'?'PROVIDER_DOCS':'MANUAL_VERIFIED',
      quote_mode:body.quote_mode==='LIVE_PROVIDER'?'LIVE_PROVIDER':'STATIC_RULE',base_price_usd:body.base_price_usd==null?null:Number(body.base_price_usd),
      verified_at:verified?new Date().toISOString():String(body.verified_at||''),
    });
    res.json({success:true,data:saved});
  }catch(err:any){res.status(400).json({success:false,error:{code:err?.code||'PROVIDER_PRICING_ERROR',message:err?.message||'Falha ao salvar preço do provider.'}});}
});

async function approveMapping(body:any){
  const providerId=String(body?.provider_id||'').trim(),modelId=String(body?.model_id||'').trim(),identifier=String(body?.provider_model_identifier||'').trim(),capabilityId=String(body?.capability_id||'').trim();
  if(!providerId||!modelId||!identifier||!capabilityId)throw Object.assign(new Error('provider_id, model_id, provider_model_identifier e capability_id são obrigatórios.'),{code:'VALIDATION_ERROR'});
  const blueprint=CURATED_MODEL_BLUEPRINTS.find(row=>row.model_id===modelId);
  if(!blueprint)throw Object.assign(new Error('O modelo não pertence ao acervo curado do IA Conect.'),{code:'MODEL_NOT_CURATED'});
  const [provider,verifiedPrice]=await Promise.all([
    providerCatalogService.getProvider(providerId),
    providerPricingCatalogService.getVerified(providerId,identifier,capabilityId),
  ]);
  if(!provider)throw Object.assign(new Error('Provider não cadastrado.'),{code:'PROVIDER_NOT_FOUND'});
  if(provider.status!=='ACTIVE')throw Object.assign(new Error('Provider não está ativo.'),{code:'PROVIDER_INACTIVE'});
  if(!verifiedPrice)throw Object.assign(new Error('O mapping só pode ser ativado depois que o preço deste provider/modelo/capability for verificado.'),{code:'PROVIDER_PRICE_UNVERIFIED'});

  const [providerRecord,model]=await Promise.all([
    providerCatalogService.ensureProviderRecord(providerId),
    providerCatalogService.ensureCuratedModel(modelId),
  ]);
  if(!providerRecord)throw Object.assign(new Error('Provider não cadastrado.'),{code:'PROVIDER_NOT_FOUND'});
  if(!model)throw Object.assign(new Error('Modelo canônico não cadastrado.'),{code:'MODEL_NOT_FOUND'});
  if(!capabilityIdsForModel(model).includes(capabilityId as any))throw Object.assign(new Error('A capability proposta não é suportada pelo modelo canônico.'),{code:'CAPABILITY_NOT_SUPPORTED'});

  const hash=crypto.createHash('sha1').update(`${providerId}:${modelId}:${identifier}`).digest('hex').slice(0,12);
  const mapping=await catalogRepository.saveMapping({
    mapping_id:`map-curated-${hash}`,model_id:modelId,provider_id:providerId,provider_model_identifier:identifier,status:'ACTIVE',capabilities:[capabilityId],updated_at:new Date().toISOString(),
  });
  const policy=await betaCatalogPolicyService.reconcileModelPolicy(model);
  return{mapping,pricing:verifiedPrice,policy,model_status:model.status,beta_only:model.beta_only===true};
}

providerScanRouter.post('/admin/provider-scan/approve-mapping',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await approveMapping(req.body||{})});}
  catch(err:any){return res.status(400).json({success:false,error:{code:err?.code||'PROVIDER_MAPPING_APPROVAL_ERROR',message:err?.message||'Falha ao aprovar mapping.'}});}
});

providerScanRouter.post('/admin/provider-scan/approve-mappings-bulk',requireAuth,requireAdmin,async(req:AuthenticatedRequest,res)=>{
  try{
    const items=Array.isArray(req.body?.items)?req.body.items:[];
    if(!items.length)throw Object.assign(new Error('Selecione pelo menos um mapping.'),{code:'VALIDATION_ERROR'});
    if(items.length>5)throw Object.assign(new Error('Aprovação em massa aceita no máximo 5 mappings por lote.'),{code:'BULK_LIMIT_EXCEEDED'});

    const scans=await providerModelScanService.latest();
    const proposals=scans.flatMap(scan=>scan.matches||[]);
    const validated=items.map((item:any)=>{
      const providerId=String(item?.provider_id||'').trim(),modelId=String(item?.model_id||'').trim(),identifier=String(item?.provider_model_identifier||'').trim(),capabilityId=String(item?.capability_id||'').trim();
      const proposal=proposals.find(match=>match.provider_id===providerId&&match.model_id===modelId&&match.provider_model_identifier===identifier&&match.capability_id===capabilityId);
      if(!proposal)throw Object.assign(new Error(`Mapping ${modelId} / ${providerId} não está no último scan salvo.`),{code:'BULK_MAPPING_NOT_SCANNED'});
      if(proposal.confidence<0.95||proposal.match_reason!=='exact_alias')throw Object.assign(new Error(`Mapping ${modelId} exige revisão manual de capability/schema.`),{code:'BULK_MAPPING_SUSPICIOUS'});
      return{provider_id:providerId,model_id:modelId,provider_model_identifier:identifier,capability_id:capabilityId};
    });

    const approved:any[]=[];
    for(const item of validated)approved.push(await approveMapping(item));
    await auditRepository.record({
      log_id:`aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      admin_id:req.user!.uid,admin_email:req.user!.email,
      action:'VERIFIED_PROVIDER_MAPPING_BULK_APPROVED',entity_type:'PROVIDER',entity_id:'bulk-provider-mapping',
      before:null,after:{count:approved.length,mappings:approved.map(row=>row.mapping?.mapping_id).filter(Boolean)},reason:'Aprovação em massa conservadora: preço verificado e correspondência exact_alias >= 95%.',
      created_at:new Date().toISOString(),
    });
    return res.json({success:true,data:{approved}});
  }catch(err:any){
    return res.status(400).json({success:false,error:{code:err?.code||'PROVIDER_MAPPING_BULK_APPROVAL_ERROR',message:err?.message||'Falha na aprovação em massa.'}});
  }
});