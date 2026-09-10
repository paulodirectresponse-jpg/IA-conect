import { describe,it,expect } from 'vitest';
import { pricingSignatureService } from './pricingSignatureService.js';

describe('pricingSignatureService invariants',()=>{
  const base={model_id:'kling-3-0',mode:'TEXT_TO_VIDEO' as const,resolution:'1080p',duration_seconds:10,aspect_ratio:'16:9',number_of_outputs:1,audio_enabled:true,reference_mode:'none',reference_count:0,model_variant:'standard',pricing_options:{quality:'standard',flag:true}};
  it('is deterministic regardless of pricing option key order',()=>{
    const a=pricingSignatureService.create(base);
    const b=pricingSignatureService.create({...base,pricing_options:{flag:true,quality:'standard'}});
    expect(a.hash).toBe(b.hash);
    expect(a.normalized).toBe(b.normalized);
  });
  it('changes when any cost-affecting dimension changes',()=>{
    const original=pricingSignatureService.create(base).hash;
    const variants=[
      {...base,resolution:'720p'},
      {...base,duration_seconds:5},
      {...base,number_of_outputs:2},
      {...base,audio_enabled:false},
      {...base,reference_mode:'initial',reference_count:1},
      {...base,model_variant:'pro'},
      {...base,pricing_options:{quality:'premium'}},
    ];
    for(const variant of variants)expect(pricingSignatureService.create(variant).hash).not.toBe(original);
  });
  it('bands references consistently',()=>{
    expect(pricingSignatureService.create({...base,reference_count:0}).reference_count_band).toBe('0');
    expect(pricingSignatureService.create({...base,reference_count:1}).reference_count_band).toBe('1');
    expect(pricingSignatureService.create({...base,reference_count:4}).reference_count_band).toBe('2-4');
    expect(pricingSignatureService.create({...base,reference_count:5}).reference_count_band).toBe('5+');
  });
});
