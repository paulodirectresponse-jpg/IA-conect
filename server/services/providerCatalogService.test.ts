import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks=vi.hoisted(()=>({
  listProviders:vi.fn(async()=>[]),
  getProvider:vi.fn(async()=>null),
  saveProvider:vi.fn(async(item:any)=>item),
  getModel:vi.fn(async()=>null),
  saveModel:vi.fn(async(item:any)=>item),
}));

vi.mock('../repositories/catalogRepository.js',()=>({
  catalogRepository:{
    listProviders:mocks.listProviders,
    getProvider:mocks.getProvider,
    saveProvider:mocks.saveProvider,
    getModel:mocks.getModel,
    saveModel:mocks.saveModel,
  },
}));

import { PROVIDER_DEFINITIONS, providerCatalogService } from './providerCatalogService.js';

describe('providerCatalogService Worker-safe reads',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.listProviders.mockResolvedValue([]);
    mocks.getProvider.mockResolvedValue(null);
    mocks.getModel.mockResolvedValue(null);
  });

  it('does not persist providers or models while serving read paths',async()=>{
    await providerCatalogService.ensureSeeded();
    const providers=await providerCatalogService.listProviders();

    expect(providers).toHaveLength(PROVIDER_DEFINITIONS.length);
    expect(mocks.saveProvider).not.toHaveBeenCalled();
    expect(mocks.saveModel).not.toHaveBeenCalled();
  });

  it('persists only one curated model when explicitly requested',async()=>{
    const model=await providerCatalogService.ensureCuratedModel('veo-3-1');

    expect(model?.model_id).toBe('veo-3-1');
    expect(mocks.saveModel).toHaveBeenCalledTimes(1);
    expect(mocks.saveProvider).not.toHaveBeenCalled();
  });

  it('persists only the requested canonical provider when required for routing',async()=>{
    const provider=await providerCatalogService.ensureProviderRecord('provider-runware');

    expect(provider?.provider_id).toBe('provider-runware');
    expect(mocks.saveProvider).toHaveBeenCalledTimes(1);
    expect(mocks.saveModel).not.toHaveBeenCalled();
  });
});