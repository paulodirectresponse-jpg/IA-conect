import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunwareProviderAdapter } from './multiProviderAdapters.js';

describe('Runware provider cost reporting',()=>{
  afterEach(()=>{
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('preserves the exact USD cost returned by getResponse',async()=>{
    vi.stubEnv('RUNWARE_API_KEY','runware-test-key');
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:[{
      taskUUID:'task-1',status:'success',videoURL:'https://example.test/output.mp4',cost:0.903,
    }]}),{status:200,headers:{'Content-Type':'application/json'}})));

    const result=await new RunwareProviderAdapter().checkStatus('task-1');

    expect(result).toMatchObject({status:'SUCCEEDED',provider_cost_usd:0.903,result_video_url:'https://example.test/output.mp4'});
  });

  it('does not invent a cost when Runware omits cost from the response',async()=>{
    vi.stubEnv('RUNWARE_API_KEY','runware-test-key');
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:[{
      taskUUID:'task-2',status:'success',videoURL:'https://example.test/output.mp4',
    }]}),{status:200,headers:{'Content-Type':'application/json'}})));

    const result=await new RunwareProviderAdapter().checkStatus('task-2');

    expect(result.status).toBe('SUCCEEDED');
    expect(result).not.toHaveProperty('provider_cost_usd');
  });
});
