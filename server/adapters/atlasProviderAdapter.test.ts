import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasProviderAdapter } from './atlasProviderAdapter.js';

const params=(overrides:Record<string,unknown>={})=>({
  generation_id:'pricing-probe',user_id:'system',model_id:'gemini-omni-flash',
  mode:'REFERENCE_TO_VIDEO' as const,capability_id:'video-edit',
  provider_model_identifier:'google/gemini-omni-flash/video-edit',
  prompt:'Update this clip.',duration_seconds:5,resolution:'720p',aspect_ratio:'16:9',number_of_outputs:1,
  references:[{asset_id:'video-ref',type:'VIDEO' as const,category:'GENERIC',provider_accessible_url:'https://example.com/input.mp4',
    storage_path:'pricing-probe://video',mime_type:'video/mp4',slot_type:'GENERAL' as const,role:'SOURCE' as const}],
  ...overrides,
} as any);

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('Atlas Gemini Omni video edit pricing payload',()=>{
  it('sends the documented source video field and omits unsupported generic fields',async()=>{
    vi.stubEnv('ATLAS_API_KEY','test-key');
    let payload:any;
    vi.stubGlobal('fetch',vi.fn(async(_url:any,init:any)=>{
      payload=JSON.parse(init.body);
      return new Response(JSON.stringify({data:{price:.1,origin_price:.1,discount:100}}),{status:200,headers:{'Content-Type':'application/json'}});
    }));
    await new AtlasProviderAdapter().quoteCostUsd(params());
    expect(payload).toEqual({
      model:'google/gemini-omni-flash/video-edit',prompt:'Update this clip.',
      video:'https://example.com/input.mp4',resolution:'720p',
    });
  });

  it('surfaces the provider validation details for pricing failures',async()=>{
    vi.stubEnv('ATLAS_API_KEY','test-key');
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:{message:'video field is required'}}),{status:400})));
    await expect(new AtlasProviderAdapter().quoteCostUsd(params())).rejects.toMatchObject({
      code:'ATLAS_PRICE_HTTP_400',message:'video field is required',
    });
  });
});
