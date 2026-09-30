import {beforeEach,describe,expect,it,vi} from 'vitest';
import {providerRegistry} from '../adapters/providerRegistry.js';
import './adapter.init.js';
const repositoryMocks=vi.hoisted(()=>({providers:[] as any[],listProviders:vi.fn(),getProvider:vi.fn()}));
vi.mock('./repository.js',()=>({routingV2Repository:{listProviders:repositoryMocks.listProviders,getProvider:repositoryMocks.getProvider}}));
import {ROUTING_V2_CORE_PROVIDERS,routingV2ProviderService} from './providerService.js';
import {createRoutingV2LegacyWrapperAdapter} from './legacyWrapperAdapter.js';

describe('Routing V2 official providers',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    repositoryMocks.providers=[
      {provider_id:'provider-wavespeed',name:'WaveSpeed AI',status:'ACTIVE',adapter_id:'v2:provider-wavespeed'},
      {provider_id:'provider-atlas',name:'Atlas Cloud',status:'ACTIVE',adapter_id:'wrapper:provider-atlas'},
      {provider_id:'provider-runware',name:'Runware',status:'ACTIVE',adapter_id:'wrapper:provider-runware'},
      {provider_id:'provider-fal',name:'fal.ai',status:'ACTIVE',adapter_id:'wrapper:provider-fal'},
    ];
    repositoryMocks.listProviders.mockImplementation(async()=>repositoryMocks.providers);
    repositoryMocks.getProvider.mockImplementation(async(id:string)=>repositoryMocks.providers.find(row=>row.provider_id===id)||null);
  });

  it('includes only the three official providers with deterministic priorities',()=>{
    const expected:Array<[string,string,string,number]>=[
      ['provider-wavespeed','WaveSpeed AI','v2:provider-wavespeed',110],
      ['provider-atlas','Atlas Cloud','wrapper:provider-atlas',100],
      ['provider-runware','Runware','wrapper:provider-runware',95],
    ];

    expect(ROUTING_V2_CORE_PROVIDERS.map(({provider_id,name,adapter_id,priority})=>[provider_id,name,adapter_id,priority])).toEqual(expected);
    expect(new Set(ROUTING_V2_CORE_PROVIDERS.map(({provider_id})=>provider_id)).size).toBe(expected.length);
    for(const [providerId,,adapterId] of expected){
      expect(providerRegistry.getAdapter(providerId)).not.toBeNull();
      if(adapterId.startsWith('wrapper:'))expect(createRoutingV2LegacyWrapperAdapter(providerId as string)).not.toBeNull();
    }
  });

  it('does not expose legacy providers in the admin provider list or provider lookup',async()=>{
    const providers=await routingV2ProviderService.list();
    expect(providers.map(provider=>provider.provider_id)).toEqual(['provider-wavespeed','provider-atlas','provider-runware']);
    expect(await routingV2ProviderService.get('provider-fal')).toBeNull();
    expect(repositoryMocks.getProvider).not.toHaveBeenCalled();
  });
});
