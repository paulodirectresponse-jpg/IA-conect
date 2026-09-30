import { afterEach, describe, expect, it, vi } from 'vitest';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { providerPricingCatalogService, ProviderPricingRule } from './providerPricingCatalogService.js';

const rule=(provider_id:string):Omit<ProviderPricingRule,'pricing_id'|'updated_at'>=>({
  provider_id,
  provider_model_identifier:'model/example',
  capability_id:'text-to-image',
  unit:'REQUEST',
  unit_price_usd:0.1,
  verified:true,
  source:'MANUAL_VERIFIED',
  verified_at:'2026-09-30T00:00:00.000Z',
});

afterEach(()=>{
  vi.restoreAllMocks();
  providerPricingCatalogService.clearCache();
});

describe('provider pricing official-provider boundary',()=>{
  it('accepts pricing for an official provider and persists its canonical id',async()=>{
    const set=vi.spyOn(firestoreAdminRest,'set').mockResolvedValue(undefined as any);

    const saved=await providerPricingCatalogService.save(rule(' provider-atlas '));

    expect(saved.provider_id).toBe('provider-atlas');
    expect(set).toHaveBeenCalledOnce();
  });

  it('rejects pricing writes for providers outside WaveSpeed, Atlas and Runware',async()=>{
    const set=vi.spyOn(firestoreAdminRest,'set').mockResolvedValue(undefined as any);

    await expect(providerPricingCatalogService.save(rule('provider-fal')))
      .rejects.toMatchObject({code:'PROVIDER_NOT_OFFICIAL'});
    expect(set).not.toHaveBeenCalled();
  });

  it('validates every batch entry before writing any pricing rows',async()=>{
    const commit=vi.spyOn(firestoreAdminRest,'commit').mockResolvedValue(undefined as any);

    await expect(providerPricingCatalogService.saveMany([
      rule('provider-wavespeed'),
      rule('provider-replicate'),
    ])).rejects.toMatchObject({code:'PROVIDER_NOT_OFFICIAL'});
    expect(commit).not.toHaveBeenCalled();
  });

  it('does not read legacy pricing rules for nonofficial providers',async()=>{
    const get=vi.spyOn(firestoreAdminRest,'get');

    await expect(providerPricingCatalogService.get('provider-kie','model/example')).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('does not quote using a legacy provider even if stale pricing data exists',async()=>{
    const get=vi.spyOn(firestoreAdminRest,'get');

    await expect(providerPricingCatalogService.quote('provider-fal',{} as any))
      .rejects.toMatchObject({code:'PROVIDER_NOT_OFFICIAL'});
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps stored legacy pricing hidden from the active pricing catalog',async()=>{
    vi.spyOn(firestoreAdminRest,'runQuery').mockResolvedValue([
      {data:{...rule('provider-atlas'),pricing_id:'atlas',updated_at:'2026-09-30T00:00:00.000Z'}},
      {data:{...rule('provider-fal'),pricing_id:'fal',updated_at:'2026-09-30T00:00:00.000Z'}},
    ] as any);

    await expect(providerPricingCatalogService.list()).resolves.toMatchObject([
      {provider_id:'provider-atlas',pricing_id:'atlas'},
    ]);
  });
});
