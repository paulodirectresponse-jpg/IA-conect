import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateRoutingV2ProviderCost } from '../routing-v2/billingEngine.js';
import { calculateRunwareCatalogPrice, clearRunwarePricingCacheForTests, fetchRunwarePricingMetadata } from './runwarePricingService.js';

const metadata=(air:string,pricingRates:Array<{amount:number;unit:string;label?:string}>)=>({air,status:'live',pricingRates});

describe('Runware official pricing metadata',()=>{
  beforeEach(()=>{clearRunwarePricingCacheForTests();vi.unstubAllGlobals();});
  it('selects the exact Seedance 2.5 second rate by resolution and capability',()=>{
    const result=calculateRunwareCatalogPrice(metadata('bytedance:seedance@2.5',[
      {amount:.1025,unit:'durationSecond',label:'Text/Image to Video · 480p'},
      {amount:.2304,unit:'durationSecond',label:'Text/Image to Video · 720p'},
      {amount:.1313,unit:'durationSecond',label:'Video-to-Video · 480p'},
      {amount:.2953,unit:'durationSecond',label:'Video-to-Video · 720p'},
    ]),{provider_model_identifier:'bytedance:seedance@2.5',capability_id:'text-to-video',resolution:'720p',duration_seconds:5});
    expect(result.unit).toBe('durationSecond');
    expect(result.amount).toBeCloseTo(1.152);
  });
  it('adds Nano Banana 2 input image fees to the selected output tier',()=>{
    const result=calculateRunwareCatalogPrice(metadata('google:4@3',[
      {amount:.04657,unit:'output',label:'512x512'},{amount:.06895,unit:'output',label:'1K'},
      {amount:.10255,unit:'output',label:'2K'},{amount:.15295,unit:'output',label:'4K'},
      {amount:.00028,unit:'inputImage'},
    ]),{provider_model_identifier:'google:4@3',capability_id:'image-edit',resolution:'1K',number_of_outputs:2,image_reference_count:3});
    expect(result.amount).toBeCloseTo(.13874);
  });
  it('uses the Runware reference-image tier for Krea editing',()=>{
    const result=calculateRunwareCatalogPrice(metadata('krea:krea@2-large',[
      {amount:.06,unit:'output',label:'1024x1024'},{amount:.065,unit:'output',label:'1024x1024 · reference image'},
    ]),{provider_model_identifier:'krea:krea@2-large',capability_id:'image-to-image',resolution:'1K',image_reference_count:1});
    expect(result.amount).toBe(.065);
  });
  it('uses Ideogram Default when the request does not select a quality tier',()=>{
    const result=calculateRunwareCatalogPrice(metadata('ideogram:4@0',[
      {amount:.03,unit:'output',label:'Turbo'},{amount:.06,unit:'output',label:'Default'},{amount:.1,unit:'output',label:'Quality'},
    ]),{provider_model_identifier:'ideogram:4@0',capability_id:'text-to-image',resolution:'1K'});
    expect(result.amount).toBe(.06);
  });
  it('rejects token-only pricing and stale model identifiers without inventing a price',()=>{
    expect(()=>calculateRunwareCatalogPrice(metadata('google:gemini@omni-flash-1.1',[
      {amount:.0000015,unit:'inputToken'},{amount:.000009,unit:'outputToken',label:'Text output'},
    ]),{provider_model_identifier:'google:gemini@omni-flash-1.1',capability_id:'text-to-video',resolution:'720p'})).toThrow(/tokens/);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('not found',{status:404})));
    return expect(fetchRunwarePricingMetadata('google:gemini@omni-flash')).rejects.toMatchObject({code:'RUNWARE_PRICE_CATALOG_HTTP_404'});
  });
  it('uses the model pricing snapshot for V2 output cost at the requested resolution',()=>{
    const result=calculateRoutingV2ProviderCost({
      type:'CUSTOM_FORMULA',currency:'USD',formula_id:'runware-catalog-pricing-v1',
      parameters:{
        provider_model_identifier:'google:4@3',capability_id:'text-to-image',default_resolution:'1K',default_duration_seconds:1,
        pricing_rates_json:JSON.stringify([{amount:.04657,unit:'output',label:'512x512'},{amount:.06895,unit:'output',label:'1K'},{amount:.10255,unit:'output',label:'2K'}]),
      },
    },{number_of_outputs:2,dimensions:{resolution:'2K'}});
    expect(result.amount).toBeCloseTo(.2051);
  });
});
