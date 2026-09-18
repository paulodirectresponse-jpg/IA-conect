import fs from 'fs';
import path from 'path';
import { describe,expect,it,beforeEach } from 'vitest';
import { routingV2AdapterRegistry } from './adapterRegistry.js';
import { RoutingV2ProviderAdapter } from './adapter.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

function fakeAdapter(id='google-direct'):RoutingV2ProviderAdapter{
  return{
    adapter_id:id,
    provider_id:'provider-google-direct',
    isConfigured:()=>true,
    health:async()=>({status:'HEALTHY',checked_at:'2026-09-18T00:00:00.000Z'}),
    listModels:async()=>[],
    getPrice:async()=>({
      billing_config:{type:'PER_GENERATION',currency:'USD',price_per_generation:0.1},
      source:'PROVIDER_CATALOG_API',
      fetched_at:'2026-09-18T00:00:00.000Z',
    }),
  };
}

describe('Routing Core V2 provider and route registries',()=>{
  beforeEach(()=>routingV2AdapterRegistry.clearForTests());

  it('registers adapters by a stable adapter id and rejects duplicates',()=>{
    const adapter=fakeAdapter();
    routingV2AdapterRegistry.register(adapter);
    expect(routingV2AdapterRegistry.get('google-direct')).toBe(adapter);
    expect(()=>routingV2AdapterRegistry.register(fakeAdapter())).toThrow(/já registrado/);
  });

  it('keeps optional provider features explicit on the adapter contract',()=>{
    const minimal:RoutingV2ProviderAdapter={
      adapter_id:'manual-provider',
      provider_id:'provider-manual',
      isConfigured:()=>false,
      health:async()=>({status:'UNKNOWN',checked_at:'2026-09-18T00:00:00.000Z'}),
    };
    expect(()=>routingV2AdapterRegistry.register(minimal)).not.toThrow();
    expect(routingV2AdapterRegistry.get('manual-provider')?.listModels).toBeUndefined();
    expect(routingV2AdapterRegistry.get('manual-provider')?.getPrice).toBeUndefined();
  });

  it('creates routes as MAPPED and never manually promotes them to READY',()=>{
    const service=read('server/routing-v2/routeService.ts');
    expect(service).toContain("status:'MAPPED'");
    expect(service).toContain("pricing_status:'UNKNOWN'");
    expect(service).toContain("runtime_status:'UNKNOWN'");
    expect(service).not.toContain("status:'READY' as const");
  });

  it('resets pricing when billing configuration changes',()=>{
    const service=read('server/routing-v2/routeService.ts');
    expect(service).toContain('billingChanged');
    expect(service).toContain("pricing_status:'UNKNOWN'");
    expect(service).toContain('pricing_snapshot:null');
    expect(service).toContain('last_price_sync_at:null');
  });

  it('validates model, capability and provider before creating a route',()=>{
    const service=read('server/routing-v2/routeService.ts');
    expect(service).toContain("if(!model)throw new Error('Model V2 não encontrado.')");
    expect(service).toContain("!model.capabilities.includes(input.capability_id)");
    expect(service).toContain("if(!provider)throw new Error('Provider V2 não encontrado.')");
    expect(service).toContain("provider.status==='DISABLED'");
  });

  it('keeps V2 registries independent from V1 routing/pricing state',()=>{
    for(const file of ['server/routing-v2/providerService.ts','server/routing-v2/modelService.ts','server/routing-v2/routeService.ts','server/routing-v2/adapterRegistry.ts']){
      const source=read(file);
      expect(source).not.toContain('catalogPolicyService');
      expect(source).not.toContain('ProviderModelMapping');
      expect(source).not.toContain('stableModelPublicationService');
      expect(source).not.toContain('providerPricingCatalogService');
      expect(source).not.toContain('smartRouterService');
    }
  });
});
