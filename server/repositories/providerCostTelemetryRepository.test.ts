import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./firestoreAdminRest.js',()=>({firestoreAdminRest:{
  get:vi.fn(),commit:vi.fn(),docName:vi.fn((path:string)=>path),fields:vi.fn((value:any)=>value),
}}));

import { firestoreAdminRest } from './firestoreAdminRest.js';
import { normalizeProviderCostUsd, saveRunwareProviderCost } from './providerCostTelemetryRepository.js';

describe('Runware provider cost telemetry repository',()=>{
  afterEach(()=>vi.resetAllMocks());

  it('accepts only finite non-negative USD values',()=>{
    expect(normalizeProviderCostUsd(0.903)).toBe(0.903);
    expect(normalizeProviderCostUsd(0)).toBe(0);
    expect(normalizeProviderCostUsd(-0.1)).toBeNull();
    expect(normalizeProviderCostUsd('0.903')).toBeNull();
    expect(normalizeProviderCostUsd(Number.NaN)).toBeNull();
  });

  it('writes the exact provider-reported amount into the private economics record',async()=>{
    vi.mocked(firestoreAdminRest.get).mockResolvedValue({exists:false,data:null,updateTime:null} as any);
    vi.mocked(firestoreAdminRest.commit).mockResolvedValue(undefined as any);

    const saved=await saveRunwareProviderCost('gen-cost-1',0.903);

    expect(saved).toMatchObject({provider_reported_cost_usd:0.903,provider_reported_cost_currency:'USD',provider_reported_cost_source:'RUNWARE_TASK_RESPONSE'});
    expect(firestoreAdminRest.commit).toHaveBeenCalledWith([expect.objectContaining({currentDocument:{exists:false}})]);
  });

  it('keeps an existing exact cost idempotent and rejects a conflicting amount',async()=>{
    vi.mocked(firestoreAdminRest.get).mockResolvedValue({exists:true,updateTime:'now',data:{generation_id:'gen-cost-2',provider_reported_cost_usd:0.903}} as any);
    expect(await saveRunwareProviderCost('gen-cost-2',0.903)).toMatchObject({provider_reported_cost_usd:0.903});
    await expect(saveRunwareProviderCost('gen-cost-2',1.2)).rejects.toMatchObject({code:'PROVIDER_COST_CONFLICT'});
    expect(firestoreAdminRest.commit).not.toHaveBeenCalled();
  });
});
