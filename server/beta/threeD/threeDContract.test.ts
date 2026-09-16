import { describe,expect,it } from 'vitest';
import { STUDIO_SEED_MODELS } from '../../../src/config/studioCatalog.js';
import { getCapabilityDefinition,publicCapabilityCatalog,validateModelCapability } from '../capabilityRegistry.js';

describe('PR-09 3D V1 contracts',()=>{
  const model=STUDIO_SEED_MODELS.find(item=>item.model_id==='three-d-v1')!;

  it('exposes text, image and multi-image 3D capabilities',()=>{
    const catalog=publicCapabilityCatalog([model])[0];
    expect(catalog.category).toBe('MODEL_3D');
    expect(catalog.capabilities.map(cap=>cap.id)).toEqual(expect.arrayContaining(['text-to-3d','image-to-3d','multi-image-to-3d']));
    expect(catalog.capabilities.every(cap=>cap.outputs.includes('MODEL_3D'))).toBe(true);
  });

  it('keeps mesh controls provider independent',()=>{
    expect(getCapabilityDefinition('text-to-3d')?.controls).toEqual(expect.arrayContaining(['output_format','mesh_mode','pbr','target_faces','topology']));
    expect(validateModelCapability(model,'image-to-3d',['reference_image','mesh_mode','pbr','target_faces','topology']).valid).toBe(true);
  });

  it('does not advertise standalone texture execution before its executor exists',()=>{
    expect(model.beta_capability_ids).not.toContain('texture-3d');
  });
});
