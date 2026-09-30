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
      code:'ATLAS_PRICE_HTTP_400',http_status:400,message:'Atlas pricing HTTP 400 · video field is required',
    });
  });

  it('preserves Cloudflare rate-limit diagnostics for Atlas pricing failures',async()=>{
    vi.stubEnv('ATLAS_API_KEY','test-key');
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('error code: 1015',{status:403,headers:{'cf-ray':'ray-123','retry-after':'60'}})));
    await expect(new AtlasProviderAdapter().quoteCostUsd(params())).rejects.toMatchObject({
      code:'ATLAS_PRICE_HTTP_403',http_status:403,cf_ray:'ray-123',retry_after:'60',
      message:'Atlas pricing HTTP 403 · cf-ray ray-123 · Retry-After 60 · error code: 1015',
    });
  });
});

describe('Atlas FLUX.2 Pro Edit pricing payload',()=>{
  it('sends all source images in the documented images array',async()=>{
    vi.stubEnv('ATLAS_API_KEY','test-key');
    let payload:any;
    vi.stubGlobal('fetch',vi.fn(async(_url:any,init:any)=>{
      payload=JSON.parse(init.body);
      return new Response(JSON.stringify({data:{price:.045,origin_price:.045,discount:100}}),{status:200,headers:{'Content-Type':'application/json'}});
    }));
    await new AtlasProviderAdapter().quoteCostUsd(params({
      model_id:'flux-2-pro',mode:'IMAGE_TO_IMAGE',capability_id:'image-edit',
      provider_model_identifier:'black-forest-labs/flux-2-pro/edit',prompt:'Edit the reference.',
      references:[
        {asset_id:'image-1',type:'IMAGE',category:'GENERIC',provider_accessible_url:'https://example.com/input-1.webp',storage_path:'pricing-probe://image-1',mime_type:'image/webp',role:'SOURCE'},
        {asset_id:'image-2',type:'IMAGE',category:'GENERIC',provider_accessible_url:'https://example.com/input-2.webp',storage_path:'pricing-probe://image-2',mime_type:'image/webp',role:'REFERENCE'},
      ],
    }));
    expect(payload).toEqual({
      model:'black-forest-labs/flux-2-pro/edit',prompt:'Edit the reference.',
      enable_sync_mode:false,enable_base64_output:false,
      images:['https://example.com/input-1.webp','https://example.com/input-2.webp'],
    });
    expect(payload.image).toBeUndefined();
  });
});
