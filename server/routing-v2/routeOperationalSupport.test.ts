import { describe, expect, it, vi } from 'vitest';
import { assertOperationalRouteSupported } from './priceSyncService.js';
import { RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';
import { createRoutingV2LegacyWrapperAdapter } from './legacyWrapperAdapter.js';

const provider:RoutingV2Provider={
  provider_id:'provider-atlas',name:'Atlas Cloud',slug:'atlas',type:'AGGREGATOR',status:'ACTIVE',priority:100,
  adapter_id:'wrapper:provider-atlas',supports_catalog_sync:true,supports_pricing_sync:true,supports_balance:false,
  health_status:'HEALTHY',created_at:'2026-01-01T00:00:00.000Z',updated_at:'2026-01-01T00:00:00.000Z',
};

const route:RoutingV2ProviderRoute={
  route_id:'route-test',model_id:'seedance-2',capability_id:'text-to-video',provider_id:'provider-atlas',
  provider_model_identifier:'bytedance/seedance-2.0/text-to-video',mapping_source:'PROVIDER_CATALOG_API',
  mapping_source_reference:'catalog:provider-atlas:bytedance/seedance-2.0/text-to-video',mapping_verified_at:'2026-01-01T00:00:00.000Z',
  status:'MAPPED',pricing_status:'UNKNOWN',runtime_status:'UNKNOWN',billing_type:'PER_GENERATION',
  billing_config:{type:'PER_GENERATION',currency:'USD',price_per_generation:0},priority:100,
  created_at:'2026-01-01T00:00:00.000Z',updated_at:'2026-01-01T00:00:00.000Z',
};

describe('routing v2 operational route support',()=>{
  it('keeps provider-incompatible model routes out of pricing readiness',()=>{
    const adapter={supportsRoute:vi.fn(()=>false)} as any;

    expect(()=>assertOperationalRouteSupported(adapter,provider,{
      ...route,capability_id:'text-to-speech',provider_model_identifier:'bytedance/speech-model',
    })).toThrow(/Atlas Cloud não aceita text-to-speech/);
    expect(adapter.supportsRoute).toHaveBeenCalledWith(provider,'seedance-2','text-to-speech','bytedance/speech-model');
  });

  it('permits supported route mappings and keeps compatibility for adapters without a support probe',()=>{
    expect(()=>assertOperationalRouteSupported({supportsRoute:()=>true} as any,provider,route)).not.toThrow();
    expect(()=>assertOperationalRouteSupported({} as any,provider,route)).not.toThrow();
  });

  it('uses the official provider adapter capability matrix without submitting a generation',()=>{
    const adapter=createRoutingV2LegacyWrapperAdapter('provider-atlas');
    expect(adapter?.supportsRoute?.(provider,'seedance-2','text-to-video','bytedance/seedance-2.0/text-to-video')).toBe(true);
    expect(adapter?.supportsRoute?.(provider,'seedance-speech','text-to-speech','bytedance/speech-model')).toBe(false);
  });
});
