import { describe,expect,it } from 'vitest';
import { STUDIO_SEED_MODELS } from '../../../src/config/studioCatalog.js';
import { publicCapabilityCatalog,getCapabilityDefinition } from '../capabilityRegistry.js';

describe('PR-11 Video Unification contracts',()=>{
  const model=STUDIO_SEED_MODELS.find(item=>item.model_id==='video-studio-v1')!;

  it('exposes the complete video toolset through one logical Beta model',()=>{
    const catalog=publicCapabilityCatalog([model])[0];
    expect(catalog.category).toBe('VIDEO');
    expect(catalog.capabilities.map(cap=>cap.id)).toEqual(expect.arrayContaining([
      'text-to-video','image-to-video','first-frame','last-frame','video-extend','video-edit',
    ]));
  });

  it('keeps edit and extend as VIDEO-in VIDEO-out capabilities',()=>{
    expect(getCapabilityDefinition('video-extend')?.inputs).toEqual(['VIDEO']);
    expect(getCapabilityDefinition('video-extend')?.outputs).toEqual(['VIDEO']);
    expect(getCapabilityDefinition('video-edit')?.inputs).toEqual(['TEXT','VIDEO']);
    expect(getCapabilityDefinition('video-edit')?.outputs).toEqual(['VIDEO']);
  });

  it('provides duration and resolution controls for video transforms',()=>{
    expect(getCapabilityDefinition('video-extend')?.controls).toEqual(expect.arrayContaining(['duration','resolution','output_format']));
    expect(getCapabilityDefinition('video-edit')?.controls).toEqual(expect.arrayContaining(['duration','resolution','output_format']));
  });

  it('publishes model-safe option sets beside each capability',()=>{
    const catalog=publicCapabilityCatalog([model])[0];
    const textToVideo=catalog.capabilities.find(cap=>cap.id==='text-to-video')!;
    expect(textToVideo.supported_durations).toEqual(model.supported_durations);
    expect(textToVideo.supported_resolutions).toEqual(model.supported_resolutions);
    expect(textToVideo.supported_aspect_ratios).toEqual(model.supported_aspect_ratios);
    const edit=catalog.capabilities.find(cap=>cap.id==='video-edit')!;
    expect(edit.supported_aspect_ratios).toEqual([]);
  });
});
