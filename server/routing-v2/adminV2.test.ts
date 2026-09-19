import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Routing Core V2 Admin',()=>{
  it('exposes isolated V2 provider model route pricing and health endpoints',()=>{
    const source=read('server/routes/adminRoutingV2Routes.ts');
    for(const endpoint of [
      '/admin/routing-v2/providers',
      '/admin/routing-v2/models',
      '/admin/routing-v2/routes',
      '/admin/routing-v2/pricing/settings',
      '/admin/routing-v2/pricing/sync',
      '/admin/routing-v2/health',
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

  it('renders the five simple V2 admin areas without replacing V1 admin',()=>{
    const view=read('src/components/admin/AdminRoutingV2.tsx');
    const admin=read('src/components/views/AdminView.tsx');
    for(const label of ['Providers','Models','Routes','Pricing','Health'])expect(view).toContain(label);
    expect(view).toContain('PRE-CUTOVER');
    expect(view).toContain('Route READY');
    expect(admin).toContain('AdminRoutingV2');
    expect(admin).toContain("id:'routing-v2'");
    expect(admin).toContain('AdminAIProvidersHub');
    expect(admin).toContain('AdminPricing');
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
