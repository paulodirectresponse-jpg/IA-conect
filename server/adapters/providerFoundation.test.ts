import { afterEach, describe, expect, it } from 'vitest';
import { providerRegistry } from './providerRegistry.js';
import {
  RunwareProviderAdapter,FalProviderAdapter,DeepInfraProviderAdapter,ReplicateProviderAdapter,AimlProviderAdapter,PiApiProviderAdapter,KieProviderAdapter,
} from './multiProviderAdapters.js';
import { PROVIDER_DEFINITIONS } from '../services/providerCatalogService.js';

const envKeys=['RUNWARE_API_KEY','FAL_API_KEY','DEEPINFRA_API_KEY','REPLICATE_API_TOKEN','AIML_API_KEY','PIAPI_API_KEY','KIE_API_KEY'] as const;
const original=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
afterEach(()=>{for(const key of envKeys){const value=original[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}});

describe('multi-provider foundation',()=>{
  it('registers Atlas, WaveSpeed and every new provider in the central registry',()=>{
    const ids=providerRegistry.listAdapters().map(adapter=>adapter.providerId);
    expect(new Set(ids).size).toBe(9);
    expect(ids).toEqual(expect.arrayContaining([
      'provider-atlas','provider-wavespeed','provider-runware','provider-fal','provider-deepinfra','provider-replicate','provider-aiml','provider-piapi','provider-kie',
    ]));
  });

  it('keeps provider catalog and adapter registry aligned',()=>{
    const catalogIds=PROVIDER_DEFINITIONS.map(provider=>provider.provider_id).sort();
    const adapterIds=providerRegistry.listAdapters().map(adapter=>adapter.providerId).sort();
    expect(adapterIds).toEqual(catalogIds);
  });

  it('does not consider a new provider configured without its server secret',()=>{
    for(const key of envKeys)delete process.env[key];
    const adapters=[new RunwareProviderAdapter(),new FalProviderAdapter(),new DeepInfraProviderAdapter(),new ReplicateProviderAdapter(),new AimlProviderAdapter(),new PiApiProviderAdapter(),new KieProviderAdapter()];
    expect(adapters.every(adapter=>adapter.isConfigured()===false)).toBe(true);
  });

  it('requires an explicit provider model identifier before claiming support',()=>{
    const adapters=[new RunwareProviderAdapter(),new FalProviderAdapter(),new DeepInfraProviderAdapter(),new ReplicateProviderAdapter(),new AimlProviderAdapter(),new PiApiProviderAdapter(),new KieProviderAdapter()];
    for(const adapter of adapters)expect(adapter.supports('model','TEXT_TO_IMAGE',undefined)).toBe(false);
  });
});
