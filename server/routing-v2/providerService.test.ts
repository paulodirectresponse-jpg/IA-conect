import {describe,expect,it} from 'vitest';
import {providerRegistry} from '../adapters/providerRegistry.js';
import './adapter.init.js';
import {ROUTING_V2_CORE_PROVIDERS} from './providerService.js';
import {createRoutingV2LegacyWrapperAdapter} from './legacyWrapperAdapter.js';

describe('Routing V2 core providers',()=>{
  it('includes all registered provider adapters with deterministic priorities',()=>{
    const expected:Array<[string,string,string,number]>=[
      ['provider-wavespeed','WaveSpeed AI','v2:provider-wavespeed',110],
      ['provider-atlas','Atlas Cloud','wrapper:provider-atlas',100],
      ['provider-runware','Runware','wrapper:provider-runware',95],
      ['provider-fal','fal.ai','wrapper:provider-fal',90],
      ['provider-deepinfra','DeepInfra','wrapper:provider-deepinfra',85],
      ['provider-replicate','Replicate','wrapper:provider-replicate',80],
      ['provider-aiml','AI/ML API','wrapper:provider-aiml',75],
      ['provider-piapi','PiAPI','wrapper:provider-piapi',70],
      ['provider-kie','Kie.ai','wrapper:provider-kie',65],
    ];

    expect(ROUTING_V2_CORE_PROVIDERS.map(({provider_id,name,adapter_id,priority})=>[provider_id,name,adapter_id,priority])).toEqual(expected);
    expect(new Set(ROUTING_V2_CORE_PROVIDERS.map(({provider_id})=>provider_id)).size).toBe(expected.length);
    for(const [providerId,,adapterId] of expected){
      expect(providerRegistry.getAdapter(providerId)).not.toBeNull();
      if(adapterId.startsWith('wrapper:'))expect(createRoutingV2LegacyWrapperAdapter(providerId as string)).not.toBeNull();
    }
  });
});
