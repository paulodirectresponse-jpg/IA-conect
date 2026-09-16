import { describe,expect,it } from 'vitest';
import { STUDIO_SEED_MODELS } from '../../src/config/studioCatalog.js';
import { getCapabilityDefinition,publicCapabilityCatalog,validateModelCapability } from './capabilityRegistry.js';

describe('Beta Capability Registry',()=>{
  it('recognizes valid capability and rejects unknown capability',()=>{
    expect(getCapabilityDefinition('text-to-image')?.outputs).toEqual(['IMAGE']);
    expect(getCapabilityDefinition('provider-secret-mode')).toBeNull();
  });

  it('allows one model to expose multiple capabilities',()=>{
    const image=STUDIO_SEED_MODELS.find(model=>model.category==='IMAGE')!;
    const item=publicCapabilityCatalog([image])[0];
    expect(item.capabilities.map(capability=>capability.id)).toEqual(expect.arrayContaining(['text-to-image','image-to-image']));
  });

  it('does not announce incompatible controls',()=>{
    const model=STUDIO_SEED_MODELS.find(item=>item.model_id==='gpt-image-2')!;
    const item=publicCapabilityCatalog([model])[0].capabilities.find(capability=>capability.id==='text-to-image')!;
    expect(item.controls).not.toContain('seed');
    expect(item.controls).not.toContain('negative_prompt');
  });

  it('keeps Stable IMAGE and VIDEO modes represented',()=>{
    const catalog=publicCapabilityCatalog(STUDIO_SEED_MODELS);
    expect(catalog.some(model=>model.capabilities.some(capability=>capability.id==='text-to-image'))).toBe(true);
    expect(catalog.some(model=>model.capabilities.some(capability=>capability.id==='text-to-video'))).toBe(true);
  });

  it('rejects incompatible capability and controls before execution',()=>{
    const image=STUDIO_SEED_MODELS.find(model=>model.category==='IMAGE')!;
    expect(validateModelCapability(image,'text-to-video').code).toBe('CAPABILITY_NOT_SUPPORTED');
    expect(validateModelCapability(image,'text-to-image',['voice']).code).toBe('CAPABILITY_CONTROL_NOT_SUPPORTED');
  });

  it('returns a safe empty catalog and does not expose provider data',()=>{
    expect(publicCapabilityCatalog([])).toEqual([]);
    const json=JSON.stringify(publicCapabilityCatalog(STUDIO_SEED_MODELS));
    expect(json).not.toContain('provider_id');
    expect(json).not.toContain('provider_model_identifier');
    expect(json).not.toContain('api_key');
  });
});
