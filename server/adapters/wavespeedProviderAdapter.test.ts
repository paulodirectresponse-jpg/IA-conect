import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaveSpeedProviderAdapter } from './wavespeedProviderAdapter.js';
import { ProviderGenerationParams } from './videoProviderAdapter.js';

function response(body:any,status=200){
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)} as Response;
}

const params:ProviderGenerationParams={
  generation_id:'gen_test',
  user_id:'user_test',
  model_id:'seedream-5-pro-image',
  mode:'TEXT_TO_IMAGE',
  prompt:'cinematic image',
  duration_seconds:1,
  resolution:'1K',
  aspect_ratio:'1:1',
  number_of_outputs:2,
  references:[],
};

describe('WaveSpeed image batches',()=>{
  const originalKey=process.env.WAVESPEED_API_KEY;

  beforeEach(()=>{
    process.env.WAVESPEED_API_KEY='test-key';
  });

  afterEach(()=>{
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if(originalKey===undefined)delete process.env.WAVESPEED_API_KEY;
    else process.env.WAVESPEED_API_KEY=originalKey;
  });

  it('creates one provider order for each requested image output',async()=>{
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(response({data:{id:'job-1'}}))
      .mockResolvedValueOnce(response({data:{id:'job-2'}}));
    vi.stubGlobal('fetch',fetchMock);

    const adapter=new WaveSpeedProviderAdapter();
    const submitted=await adapter.submitGeneration(params);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(call=>String(call[0]).endsWith('/api/v3/bytedance/seedream-v5.0-pro'))).toBe(true);
    expect(submitted.provider_job_id.startsWith('batch:')).toBe(true);
  });

  it('waits for every image order and combines all completed outputs',async()=>{
    const submitFetch=vi.fn()
      .mockResolvedValueOnce(response({data:{id:'job-1'}}))
      .mockResolvedValueOnce(response({data:{id:'job-2'}}));
    vi.stubGlobal('fetch',submitFetch);

    const adapter=new WaveSpeedProviderAdapter();
    const submitted=await adapter.submitGeneration(params);

    const statusFetch=vi.fn()
      .mockResolvedValueOnce(response({data:{status:'completed',outputs:['https://cdn.example/1.png']}}))
      .mockResolvedValueOnce(response({data:{status:'completed',outputs:['https://cdn.example/2.png']}}));
    vi.stubGlobal('fetch',statusFetch);

    const status=await adapter.checkStatus(submitted.provider_job_id);

    expect(statusFetch).toHaveBeenCalledTimes(2);
    expect(status.status).toBe('SUCCEEDED');
    expect(status.result_urls).toEqual(['https://cdn.example/1.png','https://cdn.example/2.png']);
  });

  it('keeps a multi-image generation processing until every order finishes',async()=>{
    const submitFetch=vi.fn()
      .mockResolvedValueOnce(response({data:{id:'job-1'}}))
      .mockResolvedValueOnce(response({data:{id:'job-2'}}));
    vi.stubGlobal('fetch',submitFetch);

    const adapter=new WaveSpeedProviderAdapter();
    const submitted=await adapter.submitGeneration(params);

    const statusFetch=vi.fn()
      .mockResolvedValueOnce(response({data:{status:'completed',outputs:['https://cdn.example/1.png']}}))
      .mockResolvedValueOnce(response({data:{status:'processing',progress:40}}));
    vi.stubGlobal('fetch',statusFetch);

    const status=await adapter.checkStatus(submitted.provider_job_id);

    expect(status.status).toBe('PROCESSING');
    expect(status.progress_percent).toBe(70);
    expect(status.result_urls).toBeUndefined();
  });
});
