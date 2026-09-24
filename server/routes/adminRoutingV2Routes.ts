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
import { createRoutingV2LegacyWrapperAdapter } from '../routing-v2/legacyWrapperAdapter.js';
import { routingV2ReadinessService } from '../routing-v2/readinessService.js';
import { routingV2CutoverService } from '../routing-v2/cutoverService.js';
import { routingV2ModelBootstrapService } from '../routing-v2/modelBootstrapService.js';
import { routingV2HealthAdminRoutes } from '../routing-v2/adminHealthRoutes.js';
import { routingV2RouteBootstrapService } from '../routing-v2/routeBootstrapService.js';
import { routingV2SmartRouter } from '../routing-v2/smartRouter.js';
import { factoryResetService } from '../services/factoryResetService.js';
import { CANONICAL_IMAGE_MODELS, catalogSearchTerms, normalizeImageModelText, resolveCanonicalImageModel } from '../routing-v2/imageCatalogCanonical.js';
import { isCatalogIdentityUsable, parseCatalogModelIdentity } from '../routing-v2/imageCatalogIdentity.js';
import { listAtlasCatalogModels, listRunwareCatalogModels, listWaveSpeedCatalogModels } from '../routing-v2/providerCatalogService.js';

export const adminRoutingV2Router=Router();
const guard=[requireAuth,requireAdmin] as const;

adminRoutingV2Router.use(...guard,routingV2HealthAdminRoutes);

adminRoutingV2Router.get('/admin/factory-reset/dry-run',...guard,async(_req,res)=>{try{return res.json({success:true,data:await factoryResetService.dryRun()});}catch(err){return error(res,err,'FACTORY_RESET_DRY_RUN_FAILED');}});
adminRoutingV2Router.get('/admin/factory-reset/inventory',...guard,async(_req,res)=>{try{return res.json({success:true,data:await factoryResetService.inventory()});}catch(err){return error(res,err,'FACTORY_RESET_INVENTORY_FAILED');}});
adminRoutingV2Router.post('/admin/factory-reset/snapshot',...guard,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await factoryResetService.snapshot(req.user!.uid,req.body||{})});}catch(err){return error(res,err,'FACTORY_RESET_SNAPSHOT_FAILED');}});
adminRoutingV2Router.post('/admin/factory-reset/execute',...guard,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await factoryResetService.execute(req.body||{},req.user!.uid)});}catch(err){return error(res,err,'FACTORY_RESET_EXECUTION_FAILED');}});
adminRoutingV2Router.post('/admin/factory-reset/rollback/:snapshotId',...guard,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await factoryResetService.rollback(req.params.snapshotId,req.user!.uid,req.body||{})});}catch(err){return error(res,err,'FACTORY_RESET_ROLLBACK_FAILED');}});

function adapterFor(provider:any){
  const registered=routingV2AdapterRegistry.get(provider.adapter_id);
  if(registered)return registered;
  if(String(provider.adapter_id||'').startsWith('legacy:'))return ensureRoutingV2LegacyAdapter(provider.provider_id);
  if(String(provider.adapter_id||'').startsWith('wrapper:'))return createRoutingV2LegacyWrapperAdapter(provider.provider_id);
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
    const rawQuery=String(req.query.q||'').trim();
    if(provider.provider_id!=='provider-atlas'&&!adapter.isConfigured(provider))return res.status(409).json({success:false,error:{code:'ROUTING_V2_PROVIDER_NOT_CONFIGURED',message:'Provider V2 não está configurado.'}});
    const q=rawQuery.toLowerCase();
    const limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));
    const rows=(await adapter.listModels(provider,rawQuery)).filter(row=>!q||row.name.toLowerCase().includes(q)||row.provider_model_identifier.toLowerCase().includes(q)).slice(0,limit);
    return res.json({success:true,data:rows});
  }catch(err){return error(res,err,'ROUTING_V2_PROVIDER_CATALOG_FAILED');}
});


function catalogVendor(value:any){
  if(value==null)return'';
  if(typeof value==='string'||typeof value==='number')return String(value).trim();
  if(typeof value==='object'){
    for(const key of ['name','displayName','display_name','provider','vendor','creator','slug','id']){
      const nested=value?.[key];if(typeof nested==='string'||typeof nested==='number')return String(nested).trim();
    }
  }
  return'';
}
const IMAGE_CAPABILITIES=new Set(['text-to-image','image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations']);
const NON_IMAGE_HINT=/(?:^|[\s\/_-])(video|3d|audio|tts|speech|music|voice|lip-?sync)(?:$|[\s\/_-])/i;
const IMAGE_SUFFIXES:Array<[RegExp,string]>=[
  [/(?:\/|-)(text-to-image)$/i,'text-to-image'],
  [/(?:\/|-)(image-to-image)$/i,'image-to-image'],
  [/(?:\/|-)(edit|image-edit)$/i,'image-edit'],
  [/(?:\/|-)(inpaint|inpainting)$/i,'inpaint-mask'],
  [/(?:\/|-)(outpaint|outpainting)$/i,'outpaint'],
  [/(?:\/|-)(upscale|upscaler)$/i,'upscale'],
  [/(?:\/|-)(variation|variations)$/i,'variations'],
  [/(?:\/|-)(background-remove|remove-background|background-replace|replace-background)$/i,'background-remove-replace'],
];
function inferImageCapabilities(row:any){
  const explicit=(Array.isArray(row?.capabilities)?row.capabilities:[]).map(String).filter((cap:string)=>IMAGE_CAPABILITIES.has(cap));
  if(explicit.length)return Array.from(new Set(explicit));
  const raw=`${String(row?.name||'')} ${String(row?.provider_model_identifier||'')} ${String(row?.metadata?.type||'')} ${String(row?.metadata?.category||'')}`;
  if(NON_IMAGE_HINT.test(raw))return[];
  for(const[suffix,capability]of IMAGE_SUFFIXES)if(suffix.test(raw))return[capability];
  if(/image/i.test(raw))return['text-to-image'];
  return[];
}
function catalogBase(value:string){
  let base=String(value||'').trim();
  for(const[suffix]of IMAGE_SUFFIXES)base=base.replace(suffix,'');
  return base.replace(/\/+$/,'').trim();
}
function catalogDisplayName(name:string,identifier:string){
  const base=catalogBase(name)||catalogBase(identifier);
  const withoutNamespace=base.includes('/')?base.split('/').slice(-1)[0]:base;
  return withoutNamespace.replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase()).trim();
}
function catalogKey(name:string,identifier:string,vendor=''){
  const base=catalogBase(name)||catalogBase(identifier);
  const strip=(value:string)=>String(value||'').toLowerCase()
    .replace(/^(openai|google|bytedance|black-forest-labs|bfl|alibaba|ideogram|recraft|krea|meta|luma|xai)\//,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return strip(base)||strip(name)||strip(vendor);
}
function matchesUnifiedCatalogQuery(row:any,query:string,terms:string[]){
  if(!query)return true;
  const raw=`${String(row?.name||'')} ${String(row?.provider_model_identifier||'')} ${catalogVendor(row?.vendor)} ${catalogVendor(row?.metadata?.provider)} ${catalogVendor(row?.metadata?.creator)}`.toLowerCase();
  const normalizedTerms=terms.map(term=>term.toLowerCase().trim()).filter(Boolean);
  return normalizedTerms.some(term=>raw.includes(term));
}
const CANONICAL_IMAGE_IDS=new Set(CANONICAL_IMAGE_MODELS.map(model=>model.canonical_id));
function isGenericGroupedCatalogNoise(row:any,canonicalRows:any[]){
  const name=String(row?.name||'').trim();
  const identifier=String(row?.providers?.[0]?.provider_model_identifier||'').trim();
  const vendor=String(row?.vendor||'').trim();
  const identity=parseCatalogModelIdentity(name,identifier,vendor);
  if(identity.generic_endpoint||identity.technical_variant)return true;
  if(!identity.family)return true;
  if(/\breference to image\b/i.test(normalizeImageModelText(name))){
    return canonicalRows.some(canonical=>{
      const canonicalIdentity=parseCatalogModelIdentity(String(canonical?.name||''),'',String(canonical?.vendor||''));
      return canonicalIdentity.family===identity.family&&
        canonicalIdentity.version===identity.version&&
        canonicalIdentity.tier===identity.tier;
    });
  }
  return false;
}
function isTechnicalImageCatalogNoise(name:string,identifier:string,canonical:any){
  if(canonical)return false;
  const raw=`${name} ${identifier}`.toLowerCase();
  if(NON_IMAGE_HINT.test(raw))return true;
  if(/\bdeveloper\b/.test(raw))return true;
  if(/\b(openai\s+)?gpt\s+image\s+1(?:\b|[._-])/.test(raw))return true;
  if(/\b(text[\s/_-]*to[\s/_-]*image|image[\s/_-]*to[\s/_-]*image|edit)\b/.test(raw)&&/\b(gpt\s*image|nano\s*banana|seedream|flux|ideogram|recraft|krea|qwen)\b/.test(raw))return true;
  return false;
}
adminRoutingV2Router.get('/admin/routing-v2/catalog-unified',...guard,async(req,res)=>{
  try{
    const query=String(req.query.q||'').trim();
    const allProviders=await routingV2ProviderService.list();
    const providerMap=new Map(allProviders.map(p=>[p.provider_id,p]));
    const providers=['provider-wavespeed','provider-atlas','provider-runware']
      .map(id=>providerMap.get(id))
      .filter((p):p is NonNullable<typeof p>=>Boolean(p&&p.status!=='DISABLED'));
    const terms=catalogSearchTerms(query);
    const runwareTerm=terms.find(term=>term.toLowerCase()!==query.toLowerCase())||query||'image';
    const settled=await Promise.allSettled(providers.map(async provider=>{
      const rows:any[]=[];
      const seen=new Set<string>();
      const pushRows=(items:any[])=>{
        for(const row of items){
          if(!matchesUnifiedCatalogQuery(row,query,terms))continue;
          const key=String(row?.provider_model_identifier||'').trim();
          if(!key||seen.has(key))continue;
          seen.add(key);rows.push(row);
          if(rows.length>=250)break;
        }
      };
      const withTimeout=async<T>(promise:Promise<T>,label:string,ms=6500):Promise<T>=>{
        let timer:ReturnType<typeof setTimeout>|undefined;
        try{
          return await Promise.race([
            promise,
            new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} excedeu ${ms}ms.`)),ms);}),
          ]);
        }finally{if(timer)clearTimeout(timer);}
      };
      if(provider.provider_id==='provider-atlas'){
        pushRows(await withTimeout(listAtlasCatalogModels(),'Atlas Cloud'));
        return{provider,rows,attempts:1};
      }
      if(provider.provider_id==='provider-runware'){
        pushRows(await withTimeout(listRunwareCatalogModels(runwareTerm),'Runware'));
        return{provider,rows,attempts:1};
      }
      if(provider.provider_id==='provider-wavespeed'){
        pushRows(await withTimeout(listWaveSpeedCatalogModels(query),'WaveSpeed'));
        return{provider,rows,attempts:1};
      }
      throw new Error('Provider de catálogo não suportado.');
    }));
    const grouped=new Map<string,any>();
    const failures:any[]=[];
    const providerDiagnostics:any[]=[];
    settled.forEach((result,index)=>{
      const provider=providers[index];
      if(result.status==='rejected'){const message=String((result.reason as any)?.message||result.reason);failures.push({provider_id:provider.provider_id,message});providerDiagnostics.push({provider_id:provider.provider_id,provider_name:provider.name,status:'ERROR',count:0,message});return;}
      providerDiagnostics.push({provider_id:provider.provider_id,provider_name:provider.name,status:'OK',count:result.value.rows.length,attempts:result.value.attempts});
      for(const row of result.value.rows){
        const rawName=String(row?.name||row?.provider_model_identifier||'').trim();
        const identifier=String(row?.provider_model_identifier||'').trim();
        if(!rawName||!identifier)continue;
        const detectedVendor=catalogVendor(row?.vendor)||catalogVendor(row?.metadata?.provider)||catalogVendor(row?.metadata?.creator);
        const identity=parseCatalogModelIdentity(rawName,identifier,detectedVendor);
        const canonical=resolveCanonicalImageModel(rawName,identifier,detectedVendor);
        if(isTechnicalImageCatalogNoise(rawName,identifier,canonical))continue;
        if(!canonical&&!isCatalogIdentityUsable(identity))continue;
        const imageCapabilities=inferImageCapabilities(row);
        const resolvedCapabilities=imageCapabilities.length
          ? imageCapabilities
          : identity.capabilities.length
            ? identity.capabilities
            : (canonical?.default_capabilities||[]);
        if(!resolvedCapabilities.length)continue;
        const vendor=canonical?.vendor||detectedVendor;
        const key=canonical?.canonical_id||identity.canonical_key||catalogKey(rawName,identifier,vendor);
        if(!key)continue;
        const displayName=canonical?.display_name||identity.display_name||catalogDisplayName(rawName,identifier)||rawName;
        const current=grouped.get(key)||{catalog_key:key,name:displayName,vendor,capabilities:[],providers:[]};
        if(!current.vendor&&vendor)current.vendor=vendor;
        current.capabilities=Array.from(new Set([...(current.capabilities||[]),...resolvedCapabilities]));
        current.providers.push({
          provider_id:provider.provider_id,
          provider_name:provider.name,
          provider_model_identifier:identifier,
          capabilities:resolvedCapabilities,
          metadata:row?.metadata||{},
        });
        grouped.set(key,current);
      }
    });
    const filteredRows=Array.from(grouped.values())
      .filter((row:any)=>!query||row.name.toLowerCase().includes(query.toLowerCase())||row.providers.some((p:any)=>p.provider_model_identifier.toLowerCase().includes(query.toLowerCase())));
    const canonicalRows=filteredRows.filter((row:any)=>CANONICAL_IMAGE_IDS.has(row.catalog_key));
    const rows=filteredRows
      .filter((row:any)=>CANONICAL_IMAGE_IDS.has(row.catalog_key)||!isGenericGroupedCatalogNoise(row,canonicalRows))
      .sort((a:any,b:any)=>{
        const aCanonical=CANONICAL_IMAGE_IDS.has(a.catalog_key)?1:0;
        const bCanonical=CANONICAL_IMAGE_IDS.has(b.catalog_key)?1:0;
        return bCanonical-aCanonical||b.providers.length-a.providers.length||a.name.localeCompare(b.name);
      })
      .slice(0,200);
    return res.json({success:true,data:{rows,failures,provider_diagnostics:providerDiagnostics}});
  }catch(err){return error(res,err,'ROUTING_V2_UNIFIED_CATALOG_FAILED');}
});

adminRoutingV2Router.post('/admin/routing-v2/models/bulk-import',...guard,async(req,res)=>{
  try{
    const items=Array.isArray(req.body?.items)?req.body.items:[];
    if(!items.length)throw new Error('Selecione pelo menos um modelo para importar.');
    if(items.length>50)throw new Error('Importação em massa limitada a 50 modelos por operação.');
    const result={created_models:[] as string[],existing_models:[] as string[],created_routes:[] as string[],skipped_routes:[] as string[],failed:[] as Array<{model_id:string;error:string}>};
    for(const raw of items){
      const modelId=String(raw?.model_id||'').trim();
      try{
        let model=await routingV2ModelService.get(modelId);
        if(!model){
          model=await routingV2ModelService.create({
            model_id:modelId,
            name:String(raw?.name||'').trim(),
            vendor:String(raw?.vendor||'').trim(),
            category:raw?.category||'IMAGE',
            description:String(raw?.description||'').trim(),
            capabilities:Array.isArray(raw?.capabilities)?raw.capabilities.filter(isCapabilityId):[],
          } as any);
          result.created_models.push(modelId);
        }else{
          const capabilities=(Array.isArray(raw?.capabilities)?raw.capabilities:[]).filter(isCapabilityId);
          model=await routingV2ModelService.updateIdentity(modelId,{
            name:String(raw?.name||model.name).trim(),
            vendor:String(raw?.vendor||model.vendor).trim(),
            category:raw?.category||model.category,
            capabilities,
          } as any);
          result.existing_models.push(modelId);
        }
        const capabilities=(Array.isArray(raw?.capabilities)?raw.capabilities:[]).filter(isCapabilityId);
        const bindings=Array.isArray(raw?.providers)?raw.providers:[];
        for(const binding of bindings){
          const providerId=String(binding?.provider_id||'').trim();
          const identifier=String(binding?.provider_model_identifier||'').trim();
          if(!providerId||!identifier)continue;
          const bindingCapabilities=(Array.isArray(binding?.capabilities)?binding.capabilities:capabilities).map(String).filter((capability:string)=>capabilities.includes(capability)&&isCapabilityId(capability));
          for(const capability of bindingCapabilities){
            try{
              const route=await routingV2RouteService.create({
                model_id:modelId,
                capability_id:capability,
                provider_id:providerId,
                provider_model_identifier:identifier,
                mapping_source:'PROVIDER_CATALOG_API',
                mapping_source_reference:`catalog:${providerId}:${identifier}`,
                mapping_verified_at:new Date().toISOString(),
                billing_config:{type:'PER_GENERATION',currency:'USD',price_per_generation:0},
                priority:Number(binding?.priority)||100,
              } as any);
              result.created_routes.push(route.route_id);
            }catch(routeError:any){
              if(String(routeError?.message||'').includes('já existe'))result.skipped_routes.push(`${modelId}:${capability}:${providerId}`);
              else throw routeError;
            }
          }
        }
      }catch(itemError:any){result.failed.push({model_id:modelId||'unknown',error:String(itemError?.message||itemError)});}
    }
    return res.json({success:true,data:result});
  }catch(err){return error(res,err,'ROUTING_V2_MODEL_BULK_IMPORT_FAILED');}
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
