import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';

const mocks=vi.hoisted(()=>({
  repository:{
    listRoutes:vi.fn(),listModels:vi.fn(),getProvider:vi.fn(),saveProvider:vi.fn(),saveRoute:vi.fn(),
  },
  settings:{get:vi.fn()},
  adapter:{isConfigured:vi.fn(),getPrice:vi.fn()},
  migrate:vi.fn(),repair:vi.fn(),
  checkHealth:vi.fn(),
}));

vi.mock('./repository.js',()=>({routingV2Repository:mocks.repository}));
vi.mock('./pricingSettingsService.js',()=>({routingV2PricingSettingsService:mocks.settings}));
vi.mock('./adapterResolver.js',()=>({resolveRoutingV2ProviderAdapter:()=>mocks.adapter}));
vi.mock('./providerService.js',()=>({isOfficialRoutingV2Provider:(id:string)=>['provider-atlas','provider-wavespeed','provider-runware'].includes(id)}));
vi.mock('./providerModelMigrationService.js',()=>({routingV2ProviderModelMigrationService:{migrateDeprecatedRunwareModels:mocks.migrate}}));
vi.mock('./capabilityMappingRepairService.js',()=>({routingV2CapabilityMappingRepairService:{repair:mocks.repair}}));
vi.mock('./capabilityMappingValidation.js',()=>({assertIdentifierMatchesCapability:vi.fn()}));
vi.mock('./healthAdapter.js',()=>({checkProviderHealth:mocks.checkHealth}));

import { routingV2PriceSyncService } from './priceSyncService.js';
import { RoutingV2Provider,RoutingV2ProviderRoute } from './domain.js';

const now='2026-09-30T06:18:00.000Z';

function provider(overrides:Partial<RoutingV2Provider>={}):RoutingV2Provider{
  return{
    provider_id:'provider-atlas',name:'Atlas Cloud',slug:'atlas',type:'AGGREGATOR',status:'ACTIVE',priority:100,
    adapter_id:'wrapper:provider-atlas',supports_catalog_sync:true,supports_pricing_sync:true,supports_balance:false,
    health_status:'HEALTHY',last_health_check_at:now,created_at:now,updated_at:now,...overrides,
  };
}

function route(routeId:string,overrides:Partial<RoutingV2ProviderRoute>={}):RoutingV2ProviderRoute{
  return{
    route_id:routeId,model_id:'model-test',capability_id:'text-to-video',provider_id:'provider-atlas',
    provider_model_identifier:'bytedance/seedance-2.0/text-to-video',mapping_source:'PROVIDER_DOCS',
    mapping_source_reference:'https://atlascloud.ai/models/seedance-2',mapping_verified_at:now,
    status:'MAPPED',pricing_status:'INVALID',runtime_status:'HEALTHY',billing_type:'PER_SECOND',
    billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},priority:100,
    created_at:now,updated_at:now,...overrides,
  };
}

describe('Routing V2 price-sync provider cooldown',()=>{
  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    vi.clearAllMocks();
    mocks.repository.listRoutes.mockResolvedValue([]);
    mocks.repository.listModels.mockResolvedValue([{model_id:'model-test',status:'ACTIVE',capabilities:['text-to-video']}]);
    mocks.repository.getProvider.mockImplementation(async()=>provider());
    mocks.repository.saveProvider.mockImplementation(async(value)=>value);
    mocks.repository.saveRoute.mockImplementation(async(value)=>value);
    mocks.settings.get.mockResolvedValue({
      target_margin_percent:55,safety_buffer_percent:8,reference_credit_value_brl:0.01,
      price_sync_interval_minutes:30,price_freshness_ttl_minutes:120,stale_grace_minutes:30,
    });
    mocks.adapter.isConfigured.mockReturnValue(true);
    mocks.adapter.getPrice.mockResolvedValue({
      billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
      source:'PROVIDER_QUOTE_API',source_reference:'https://atlascloud.ai/calculate',fetched_at:now,
    });
    mocks.migrate.mockResolvedValue(null);
    mocks.repair.mockResolvedValue(null);
    mocks.checkHealth.mockResolvedValue({status:'HEALTHY',checked_at:now});
  });

  afterEach(()=>vi.useRealTimers());

  it('skips external pricing requests while a persisted provider cooldown is active',async()=>{
    const cooling=provider({
      price_sync_cooldown_until:'2026-09-30T06:19:00.000Z',
      price_sync_cooldown_error:'Atlas pricing HTTP 1015',
      price_sync_cooldown_failures:1,
    });
    mocks.repository.listRoutes.mockResolvedValue([route('route-1')]);
    mocks.repository.getProvider.mockResolvedValue(cooling);

    const result=await routingV2PriceSyncService.runBatch({cursor:0,limit:1,fx_rate_usd_brl:5.4});

    expect(mocks.adapter.getPrice).not.toHaveBeenCalled();
    expect(result.rows[0].error).toContain('Atlas pricing HTTP 1015');
    expect(result.rows[0].error).toContain('2026-09-30T06:19:00.000Z');
    expect(mocks.repository.saveRoute).toHaveBeenCalledWith(expect.objectContaining({
      last_sync_error:expect.stringContaining('novas consultas pausadas'),
      pricing_status:'INVALID',
    }));
  });

  it('persists cooldown after HTTP 429 and suppresses calls for later routes in the same provider batch',async()=>{
    mocks.repository.listRoutes.mockResolvedValue([route('route-1'),route('route-2')]);
    mocks.adapter.getPrice.mockRejectedValue(Object.assign(new Error('Atlas pricing HTTP 429'),{code:'ATLAS_PRICE_HTTP_429'}));

    const result=await routingV2PriceSyncService.runBatch({cursor:0,limit:2,fx_rate_usd_brl:5.4});

    expect(mocks.adapter.getPrice).toHaveBeenCalledTimes(1);
    expect(mocks.repository.saveProvider).toHaveBeenCalledWith(expect.objectContaining({
      price_sync_cooldown_until:'2026-09-30T06:19:00.000Z',
      price_sync_cooldown_error:'Atlas pricing HTTP 429',
      price_sync_cooldown_failures:1,
    }));
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1].error).toContain('Atlas pricing HTTP 429');
  });
});
