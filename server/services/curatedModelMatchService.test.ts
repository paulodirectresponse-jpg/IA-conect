import { describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/catalogRepository.js',()=>({catalogRepository:{listMappings:async()=>[]}}));
import { curatedModelMatchService } from './curatedModelMatchService.js';
import type { ProviderScanCandidate } from './providerModelScanService.js';

function row(id:string,name=id):ProviderScanCandidate{return{provider_id:'provider-wavespeed',provider_model_identifier:id,name};}

describe('curated provider model matching',()=>{
  it('keeps video edit separate from the base generation family',async()=>{
    const matches=await curatedModelMatchService.propose('provider-wavespeed',[row('bytedance/seedance-2.5/video-edit')]);
    expect(matches).toHaveLength(1);
    expect(matches[0].model_id).toBe('seedance-2-5-video-edit');
    expect(matches[0].capability_id).toBe('video-edit');
  });

  it('keeps Veo Fast extension separate from ordinary Veo generation',async()=>{
    const matches=await curatedModelMatchService.propose('provider-wavespeed',[row('google/veo3.1-fast/video-extend')]);
    expect(matches).toHaveLength(1);
    expect(matches[0].model_id).toBe('veo-3-1-fast-video-extend');
    expect(matches[0].capability_id).toBe('video-extend');
  });

  it('normalizes TTS provider identifiers into the voice catalog',async()=>{
    const matches=await curatedModelMatchService.propose('provider-wavespeed',[row('minimax/speech-2.8-hd')]);
    expect(matches).toHaveLength(1);
    expect(matches[0].model_id).toBe('minimax-speech-2-8-hd');
    expect(matches[0].capability_id).toBe('text-to-speech');
  });

  it('ignores unrelated low-confidence provider models',async()=>{
    const matches=await curatedModelMatchService.propose('provider-wavespeed',[row('random/legacy-model-123','Legacy Random Model')]);
    expect(matches).toEqual([]);
  });
});
