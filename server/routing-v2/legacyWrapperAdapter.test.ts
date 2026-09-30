import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoutingV2LegacyWrapperAdapter } from './legacyWrapperAdapter.js';
import { providerRegistry } from '../adapters/providerRegistry.js';

describe('routing v2 legacy wrapper pricing catalog reuse',()=>{
  afterEach(()=>{
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads the WaveSpeed catalog once when pricing several routes in the same batch',async()=>{
    vi.stubEnv('WAVESPEED_API_KEY','wavespeed-test-key');
    const fetchMock=vi.fn(async()=>new Response(JSON.stringify({data:[
      {model_id:'bytedance/seedance-2.0/text-to-video',name:'Seedance 2',base_price:0.4},
      {model_id:'bytedance/seedance-2.5/text-to-video',name:'Seedance 2.5',base_price:0.8},
    ]}),{status:200,headers:{'Content-Type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);

    const adapter=createRoutingV2LegacyWrapperAdapter('provider-wavespeed');
    expect(adapter?.getPrice).toBeDefined();
    const provider={provider_id:'provider-wavespeed'} as any;
    const first=await adapter!.getPrice!(provider,'bytedance/seedance-2.0/text-to-video','text-to-video');
    const second=await adapter!.getPrice!(provider,'bytedance/seedance-2.5/text-to-video','text-to-video');

    expect(first.billing_config).toMatchObject({type:'PER_GENERATION',price_per_generation:0.4});
    expect(second.billing_config).toMatchObject({type:'PER_GENERATION',price_per_generation:0.8});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forwards Runware reported cost into Routing V2 status without exposing costs from other providers',async()=>{
    const legacy={
      isConfigured:()=>true,
      supports:()=>true,
      checkStatus:vi.fn(async()=>({provider_job_id:'task-3',status:'SUCCEEDED',result_urls:['https://example.test/output.mp4'],provider_cost_usd:0.903})),
    } as any;
    const getAdapter=vi.spyOn(providerRegistry,'getAdapter').mockReturnValue(legacy);

    const runware=createRoutingV2LegacyWrapperAdapter('provider-runware');
    const runwareStatus=await runware!.checkGeneration!({provider_id:'provider-runware'} as any,'task-3');
    expect(runwareStatus.provider_cost_usd).toBe(0.903);

    const atlas=createRoutingV2LegacyWrapperAdapter('provider-atlas');
    const atlasStatus=await atlas!.checkGeneration!({provider_id:'provider-atlas'} as any,'task-3');
    expect(atlasStatus).not.toHaveProperty('provider_cost_usd');
    getAdapter.mockRestore();
  });
});
