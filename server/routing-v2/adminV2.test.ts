import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
import {catalogSearchTerms,resolveCanonicalImageModel} from './imageCatalogCanonical.js';
import {parseCatalogModelIdentity,shouldGroupCatalogModels} from './imageCatalogIdentity.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Routing Core V2 Admin',()=>{
  it('exposes isolated V2 provider model route pricing and health endpoints',()=>{
    const source=read('server/routes/adminRoutingV2Routes.ts');
    for(const endpoint of [
      '/admin/routing-v2/providers',
      '/admin/routing-v2/providers/bootstrap-core',
      '/admin/routing-v2/models',
      '/admin/routing-v2/routes',
      '/admin/routing-v2/pricing/settings',
      '/admin/routing-v2/pricing/sync',
      '/admin/routing-v2/health',
      '/admin/routing-v2/readiness',
      '/admin/routing-v2/reset-preview',
      '/admin/routing-v2/cutover',
    ])expect(source).toContain(endpoint);
    expect(source).toContain('/catalog-models');
    expect(source).toContain('adapter.listModels');
  });

  it('keeps Admin V2 free from V1 publication repair and routing policies',()=>{
    const source=read('server/routes/adminRoutingV2Routes.ts');
    expect(source).not.toContain('stableModelPublicationService');
    expect(source).not.toContain('stableLaunchSetService');
    expect(source).not.toContain('pricingRepairService');
    expect(source).not.toContain('catalogPolicyService');
    expect(source).not.toContain('smartRouterService');
    expect(source).not.toContain('providerPricingCatalogService');
  });

  it('renders the single IA routing admin and removes the parallel legacy admin',()=>{
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    const admin=read('src/components/views/AdminView.tsx');
    for(const label of ['Providers','Modelos','Rotas','Pricing','Health'])expect(view).toContain(label);
    expect(view).toContain('HYBRID');
    expect(view).toContain('V2_ONLY');
    expect(view).toContain('rotas READY');
    expect(view).not.toContain('Ativar V2_ONLY');
    expect(view).not.toContain('Resetar inventário V2 (preview)');
    expect(view).toContain('Cadastrar 3 providers base');
    expect(view).toContain('WaveSpeed, Atlas Cloud e Runware');
    expect(admin).toContain('AdminRoutingV2');
    expect(admin).toContain("id:'ai-routing'");
    expect(admin).not.toContain('AdminAIProvidersHub');
    expect(admin).not.toContain('AdminPricing');
  });

  it('allows the idempotent core provider bootstrap in production while keeping admin auth',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    expect(routes).toContain("post('/admin/routing-v2/providers/bootstrap-core',...guard");
    const start=routes.indexOf("post('/admin/routing-v2/providers/bootstrap-core'");
    const end=routes.indexOf("post('/admin/routing-v2/providers',",start);
    const providerBootstrap=routes.slice(start,end);
    expect(providerBootstrap).not.toContain('ROUTING_V2_BOOTSTRAP_PREVIEW_ONLY');
    expect(providerBootstrap).toContain('routingV2ProviderService.bootstrapCore()');
  });

  it('keeps Atlas and Runware live catalog discovery wired through wrapper adapters',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    const wrapper=read('server/routing-v2/legacyWrapperAdapter.ts');
    const catalog=read('server/routing-v2/providerCatalogService.ts');
    const providers=read('server/routing-v2/providerService.ts');

    expect(routes).toContain("startsWith('wrapper:')");
    expect(routes).toContain('adapter.listModels(provider,rawQuery)');
    expect(wrapper).toContain("providerId === 'provider-atlas'");
    expect(wrapper).toContain("providerId === 'provider-runware'");
    expect(wrapper).toContain('listAtlasCatalogModels');
    expect(wrapper).toContain('listRunwareCatalogModels');
    expect(catalog).toContain('/api/v1/models');
    expect(catalog).toContain("taskType:'modelSearch'");
    expect(catalog).toContain("const rawSearch=clean(query)");
    expect(catalog).toContain("const search=(rawSearch||'ai').slice(0,48)");
    expect(catalog).toContain("if(search.length<2)");
    expect(catalog).not.toContain("source:'featured'");
    expect(catalog).toContain("visibility:'public'");
    expect(catalog).toContain("sort:'popularity'");
    expect(catalog).toContain("body?.errors");
    expect(providers).toContain("await this.update(input.provider_id,{adapter_id:input.adapter_id,priority:input.priority})");
  });










  it('parses image model identity universally by family version tier variant and capability',()=>{
    const seedreamA=parseCatalogModelIdentity('Seedream 5.0 Pro','bytedance:seedream@5.0-pro','ByteDance');
    const seedreamB=parseCatalogModelIdentity('Seedream V5.0 Pro','seedream-v5.0-pro/text-to-image','ByteDance');
    const seedreamLite=parseCatalogModelIdentity('Seedream V5.0 Lite','seedream-v5.0-lite','ByteDance');
    const seedreamSequential=parseCatalogModelIdentity('Seedream V5.0 Pro Sequential','seedream-v5.0-pro-sequential','ByteDance');
    const nano=parseCatalogModelIdentity('Nano Banana 2 Reference To Image','google/nano-banana-2/reference-to-image','Google');
    const generic=parseCatalogModelIdentity('Text To Image Ultra','text-to-image-ultra','WaveSpeed');

    expect(seedreamA.version).toBe('5.0');
    expect(seedreamB.version).toBe('5.0');
    expect(shouldGroupCatalogModels(seedreamA,seedreamB)).toBe(true);
    expect(shouldGroupCatalogModels(seedreamA,seedreamLite)).toBe(false);
    expect(shouldGroupCatalogModels(seedreamA,seedreamSequential)).toBe(false);
    expect(nano.family).toBe('nano-banana');
    expect(nano.version).toBe('2');
    expect(nano.capabilities).toContain('image-to-image');
    expect(generic.generic_endpoint).toBe(true);
    expect(parseCatalogModelIdentity('Nano Banana Pro','google:4@2','Google').version).toBe('');
  });

  it('uses structured identity as universal fallback while preserving provider discovery',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    expect(routes).toContain('parseCatalogModelIdentity(rawName,identifier,detectedVendor)');
    expect(routes).toContain('identity.canonical_key');
    expect(routes).toContain('identity.display_name');
    expect(routes).toContain('isCatalogIdentityUsable(identity)');
    expect(routes).toContain("listAtlasCatalogModels()");
    expect(routes).toContain("listRunwareCatalogModels(runwareTerm)");
  });

  it('prioritizes canonical image models and hides generic endpoint noise only at presentation layer',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    const identity=read('server/routing-v2/imageCatalogIdentity.ts');
    expect(routes).toContain('CANONICAL_IMAGE_IDS');
    expect(routes).toContain('isGenericGroupedCatalogNoise');
    expect(routes).toContain('bCanonical-aCanonical');
    expect(identity).toContain('GENERIC_ENDPOINT_PATTERN');
    expect(identity).toContain('reference[\\s/_-]*to[\\s/_-]*image');
    expect(routes).toContain("listAtlasCatalogModels()");
    expect(routes).toContain("listRunwareCatalogModels(runwareTerm)");
  });

  it('filters unified catalog rows before canonical grouping and repairs existing model identity',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    const models=read('server/routing-v2/modelService.ts');
    expect(routes).toContain('matchesUnifiedCatalogQuery');
    expect(routes).toContain('if(!matchesUnifiedCatalogQuery(row,query,terms))continue');
    expect(routes).toContain('if(rows.length>=250)break');
    expect(routes).toContain('routingV2ModelService.updateIdentity');
    expect(models).toContain('async updateIdentity');
  });

  it('cleans technical image catalog noise without changing provider discovery',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    expect(routes).toContain("isTechnicalImageCatalogNoise");
    expect(routes).toContain("\\bdeveloper\\b");
    expect(routes).toContain("[\\s\\/_-])(video|3d|audio");
    expect(routes).toContain("if(isTechnicalImageCatalogNoise(rawName,identifier,canonical))continue");
    expect(routes).toContain("listAtlasCatalogModels()");
    expect(routes).toContain("listRunwareCatalogModels(runwareTerm)");
  });

  it('keeps unified catalog within runtime budget and returns partial provider results',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    const catalog=read('server/routing-v2/providerCatalogService.ts');
    expect(routes).toContain("const runwareTerm=terms.find");
    expect(routes).toContain("withTimeout");
    expect(routes).toContain("ms=6500");
    expect(routes).toContain("listRunwareCatalogModels(runwareTerm)");
    expect(routes).not.toContain("Promise.allSettled(terms.map(term=>listRunwareCatalogModels(term)))");
    expect(catalog).toContain("controller.abort(),5500");
  });

  it('fetches WaveSpeed Atlas and Runware directly in unified catalog and exposes diagnostics',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    const client=read('src/services/routingV2AdminService.ts');
    expect(routes).toContain("provider.provider_id==='provider-wavespeed'");
    expect(routes).toContain('listWaveSpeedCatalogModels(query)');
    expect(routes).toContain("provider.provider_id==='provider-atlas'");
    expect(routes).toContain('listAtlasCatalogModels()');
    expect(routes).toContain("provider.provider_id==='provider-runware'");
    expect(routes).toContain('listRunwareCatalogModels(runwareTerm)');
    expect(routes).toContain('provider_diagnostics');
    expect(view).toContain('catalogDiagnostics');
    expect(view).toContain('resultado(s)');
    expect(client).toContain('RoutingV2UnifiedCatalogDiagnosticAdmin');
  });

  it('resolves provider-specific image slugs and AIR ids to the same canonical model',()=>{
    expect(resolveCanonicalImageModel('GPT Image 2','openai:gpt-image@2','OpenAI')?.canonical_id).toBe('gpt-image-2');
    expect(resolveCanonicalImageModel('openai/gpt-image-2/text-to-image','openai/gpt-image-2/text-to-image','OpenAI')?.canonical_id).toBe('gpt-image-2');
    expect(resolveCanonicalImageModel('GPT-Image-2.5 Flare','openai:gpt-image@2.5-flare','OpenAI')?.canonical_id).toBe('gpt-image-2-5-flare');
    expect(resolveCanonicalImageModel('Nano Banana 2','google:4@3','Google')?.canonical_id).toBe('nano-banana-2');
    expect(resolveCanonicalImageModel('Seedream 5.0 Pro','bytedance:seedream@5.0-pro','ByteDance')?.canonical_id).toBe('seedream-5-0-pro');
    expect(resolveCanonicalImageModel('Seedream V5.0 Pro','bytedance/seedream-v5.0-pro','ByteDance')?.canonical_id).toBe('seedream-5-0-pro');
    expect(resolveCanonicalImageModel('Seedream V5.0 Pro Text to Image','seedream-v5.0-pro/text-to-image','ByteDance')?.canonical_id).toBe('seedream-5-0-pro');
    expect(resolveCanonicalImageModel('FLUX.2 [pro]','bfl:5@1','Black Forest Labs')?.canonical_id).toBe('flux-2-pro');
    expect(catalogSearchTerms('gpt')).toContain('GPT Image 2');
  });

  it('does not rely on stale supports_catalog_sync or intermediary adapters for unified discovery',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    expect(routes).toContain("['provider-wavespeed','provider-atlas','provider-runware']");
    expect(routes).toContain("provider.provider_id==='provider-wavespeed'");
    expect(routes).toContain('listWaveSpeedCatalogModels(query)');
    expect(routes).toContain('canonical?.default_capabilities');
    expect(routes).not.toContain("p.status!=='DISABLED'&&p.supports_catalog_sync");
  });

  it('groups image endpoint variants into one logical model with capability-specific bindings',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    expect(routes).toContain('IMAGE_SUFFIXES');
    expect(routes).toContain("'text-to-image'");
    expect(routes).toContain("'image-edit'");
    expect(routes).toContain('NON_IMAGE_HINT');
    expect(routes).toContain('catalogBase(identifier)');
    expect(routes).toContain('bindingCapabilities');
    expect(view).toContain('capabilities:p.capabilities');
    expect(view).toContain('uniqueCatalogProviders(row.providers)');
  });

  it('supports unified provider catalog and bulk model import',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    const client=read('src/services/routingV2AdminService.ts');
    expect(routes).toContain('/admin/routing-v2/catalog-unified');
    expect(routes).toContain('/admin/routing-v2/models/bulk-import');
    expect(routes).toContain("mapping_source:'PROVIDER_CATALOG_API'");
    expect(routes).toContain('Promise.allSettled');
    expect(view).toContain('Catálogo unificado de modelos');
    expect(view).toContain('Configurar selecionados');
    expect(view).toContain('Bindings encontrados');
    expect(client).toContain('searchUnifiedCatalog');
    expect(client).toContain('bulkImportModels');
  });


  it('uses the approved economics policy as the single pricing source and invalidates old snapshots',()=>{
    const settings=read('server/routing-v2/pricingSettingsService.ts');
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    expect(settings).toContain('target_margin_percent:55');
    expect(settings).toContain('safety_buffer_percent:8');
    expect(settings).toContain('reference_credit_value_brl:0.01');
    expect(settings).toContain('price_freshness_ttl_minutes:120');
    expect(settings).toContain('LEGACY_ROUTING_V2_PRICING_SETTINGS');
    expect(settings).toContain("pricing_status:'STALE'");
    expect(settings).toContain("status:route.pricing_snapshot?'DEGRADED'");
    expect(view).toContain('55% margem · 8% buffer · R$ 0,01 por crédito');
    expect(view).toContain('Salvar economics e recalcular');
    expect(view).toContain('operationalizeAll()');
  });

  it('groups route and pricing administration by logical model without changing router semantics',()=>{
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    const router=read('server/routing-v2/routerService.ts');
    expect(view).toContain('routeGroups');
    expect(view).toContain('groupedRoutesView');
    expect(view).toContain('Melhor READY');
    expect(view).toContain('provider(s)');
    expect(view).toContain('capability(s)');
    expect(view).toContain('groupedRoutesView(false)');
    expect(view).toContain('groupedRoutesView(true)');
    expect(router).toContain("route.status!=='READY'");
    expect(router).toContain("route.pricing_status!=='CURRENT'");
    expect(router).toContain("route.runtime_status!=='HEALTHY'");
    expect(router).toContain('a.safe_cogs_brl-b.safe_cogs_brl||b.priority-a.priority');
    expect(router).toContain("strategy:'LOWEST_SAFE_COGS'");
  });

  it('operationalizes imported routes through factual health pricing FX and READY reconciliation',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    const priceSync=read('server/routing-v2/priceSyncService.ts');
    const resolver=read('server/routing-v2/adapterResolver.ts');
    const health=read('server/routing-v2/healthAdapter.ts');
    const fx=read('server/routing-v2/fxRateService.ts');
    const wrapper=read('server/routing-v2/legacyWrapperAdapter.ts');
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    const client=read('src/services/routingV2AdminService.ts');

    expect(routes).toContain('/admin/routing-v2/operationalize');
    expect(routes).toContain('const limit=Math.min(5');
    expect(priceSync).toContain('resolveRoutingV2ProviderAdapter(provider)');
    expect(priceSync).toContain('await getUsdBrlRate()');
    expect(resolver).toContain("['provider-wavespeed','provider-atlas','provider-runware']");
    expect(health).toContain("provider.provider_id==='provider-wavespeed'");
    expect(health).toContain("provider.provider_id==='provider-atlas'");
    expect(health).toContain("provider.provider_id==='provider-runware'");
    expect(fx).toContain('olinda.bcb.gov.br');
    expect(wrapper).toContain('PROVIDER_CATALOG_API');
    expect(wrapper).toContain('ROUTING_V2_MAPPING_CAPABILITY_MISMATCH');
    expect(view).toContain('Ativar rotas agora');
    expect(view).toContain('Sincronizar e ativar rotas');
    expect(client).toContain("operationalize:(cursor=0,limit=5)=>post<any>('/api/admin/routing-v2/operationalize',{cursor,limit})");
    expect(view).toContain('operationalizeAll');
  });


  it('keeps each Cloudflare activation invocation bounded and configures paid subrequest headroom',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    const wrangler=read('wrangler.jsonc');
    expect(routes).toContain('const limit=Math.min(5');
    expect(routes).not.toContain('for(let index=0;index<100;index++)');
    expect(view).toContain('routingV2AdminService.operationalize(cursor,5)');
    expect(view).toContain('for(let i=0;i<100;i++)');
    expect(wrangler).toContain('"subrequests": 50000');
  });

  it('supports Atlas image execution and live price estimation',()=>{
    const atlas=read('server/adapters/atlasProviderAdapter.ts');
    expect(atlas).toContain("mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE'");
    expect(atlas).toContain("'generateImage':'generateVideo'");
    expect(atlas).toContain('/api/v1/model/calculate');
    expect(atlas).toContain('Imagem de origem obrigatória para edição na Atlas.');
  });

  it('uses official WaveSpeed model-list catalog contract and provider types as capabilities',()=>{
    const catalog=read('server/routing-v2/providerCatalogService.ts');
    expect(catalog).toContain('/api/v3/models');
    expect(catalog).toContain('model_id');
    expect(catalog).toContain('base_price');
    expect(catalog).toContain('catalogCapability(row?.type');
    expect(catalog).toContain('WAVESPEED_API_KEY');
  });

  it('normalizes catalog vendor objects instead of rendering object Object',()=>{
    const catalog=read('server/routing-v2/providerCatalogService.ts');
    expect(catalog).toContain("for(const key of ['name','displayName','display_name','provider','vendor','creator','slug','id'])");
    expect(catalog).toContain("if(typeof value==='object')");
  });

  it('never accepts API keys through the V2 admin provider form',()=>{
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    expect(view).not.toContain('api_key');
    expect(view).not.toContain('API_KEY');
    expect(routes).not.toContain('api_key');
    expect(routes).not.toContain('API_KEY');
  });
});
