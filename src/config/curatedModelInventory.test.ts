import { describe, expect, it } from 'vitest';
import { CURATED_MODEL_BLUEPRINTS, CURATED_MODEL_POSITION_COUNTS, CURATED_MODEL_SEEDS } from './curatedModelInventory.js';

describe('IA Connect curated model inventory',()=>{
  it('keeps the approved 86-position product catalog',()=>{
    expect(CURATED_MODEL_BLUEPRINTS).toHaveLength(86);
    expect(CURATED_MODEL_POSITION_COUNTS).toEqual({
      IMAGE_GENERATION:12,IMAGE_EDIT:10,VIDEO_GENERATION:12,VIDEO_EDIT:10,VIDEO_EXTEND:10,VOICE:10,MUSIC:8,SFX:6,THREE_D:8,
    });
  });

  it('uses unique canonical model ids and preserves the twelve existing real models',()=>{
    const ids=CURATED_MODEL_BLUEPRINTS.map(row=>row.model_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CURATED_MODEL_BLUEPRINTS.filter(row=>row.existing)).toHaveLength(12);
    expect(CURATED_MODEL_SEEDS).toHaveLength(74);
  });

  it('keeps every new model experimental and beta-only until provider verification',()=>{
    expect(CURATED_MODEL_SEEDS.every(model=>model.status==='EXPERIMENTAL'&&model.beta_only===true)).toBe(true);
  });

  it('does not seed the discontinued Suno PiAPI integration',()=>{
    expect(CURATED_MODEL_BLUEPRINTS.some(row=>/suno/i.test(row.name)||/suno/i.test(row.model_id))).toBe(false);
  });
});
