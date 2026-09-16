import { describe,expect,it } from 'vitest';
import { STUDIO_SEED_MODELS } from '../../../src/config/studioCatalog.js';
import { getCapabilityDefinition,publicCapabilityCatalog } from '../capabilityRegistry.js';

describe('PR-10 Image Editor contracts',()=>{
  const model=STUDIO_SEED_MODELS.find(item=>item.model_id==='image-editor-v1')!;

  it('exposes all V1 editor capabilities through one logical model',()=>{
    const catalog=publicCapabilityCatalog([model])[0];
    expect(catalog.category).toBe('IMAGE');
    expect(catalog.capabilities.map(cap=>cap.id)).toEqual(expect.arrayContaining([
      'image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations',
    ]));
  });

  it('defines mask and editor-specific controls without provider terminology',()=>{
    expect(getCapabilityDefinition('inpaint-mask')?.inputs).toEqual(['TEXT','IMAGE','MASK']);
    expect(getCapabilityDefinition('background-remove-replace')?.controls).toContain('background_mode');
    expect(getCapabilityDefinition('variations')?.controls).toContain('variation_strength');
    expect(JSON.stringify(publicCapabilityCatalog([model]))).not.toMatch(/wavespeed|openai\/gpt-image/i);
  });
});
