import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

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
    expect(catalog).toContain("const search=clean(query)||'a'");
    expect(catalog).not.toContain("source:'featured'");
    expect(catalog).toContain("visibility:'public'");
    expect(catalog).toContain("sort:'popularity'");
    expect(catalog).toContain("body?.errors");
    expect(providers).toContain("await this.update(input.provider_id,{adapter_id:input.adapter_id,priority:input.priority})");
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
