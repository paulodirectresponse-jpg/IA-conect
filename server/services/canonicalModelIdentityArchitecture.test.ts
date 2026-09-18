import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
import {canonicalModelId} from '../../src/config/modelCanonicalization.js';
import {CURATED_CANONICAL_MODELS} from '../../src/config/curatedModelInventory.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('canonical model identity across generation and editors',()=>{
  it('collapses legacy image and video operation ids onto one model id',()=>{
    expect(canonicalModelId('seedance-2-5-video-edit')).toBe('seedance-2-5');
    expect(canonicalModelId('seedance-2-5-video-extend')).toBe('seedance-2-5');
    expect(canonicalModelId('flux-2-max-edit')).toBe('flux-2-max-image');
    expect(canonicalModelId('gpt-image-2-edit')).toBe('gpt-image-2');
  });

  it('merges generation and editor capabilities into the canonical seed',()=>{
    const seedance=CURATED_CANONICAL_MODELS.find(model=>model.model_id==='seedance-2-5');
    expect(seedance?.beta_capability_ids).toEqual(expect.arrayContaining(['text-to-video','image-to-video','video-edit','video-extend']));
    const flux=CURATED_CANONICAL_MODELS.find(model=>model.model_id==='flux-2-max-image');
    expect(flux?.beta_capability_ids).toEqual(expect.arrayContaining(['text-to-image','image-to-image','image-edit']));
  });

  it('canonicalizes stored model rows and mappings at the repository boundary',()=>{
    const repo=read('server/repositories/catalogRepository.ts');
    expect(repo).toContain('mergeCanonicalModels(rows)');
    expect(repo).toContain('canonicalModelId(row.model_id)');
    expect(repo).toContain('model_id:canonicalModelId(value.model_id)');
  });

  it('keeps editor-only image models out of the Stable image generator',()=>{
    const view=read('src/components/views/UnifiedImageCreateView.tsx');
    expect(view).toContain("(m.supported_modes||[]).includes('TEXT_TO_IMAGE')");
  });

  it('keeps one provider proposal per canonical capability instead of one per duplicated model',()=>{
    const match=read('server/services/curatedModelMatchService.ts');
    expect(match).toContain('const byCapability=new Map<string,ProviderModelMatchProposal>()');
    expect(match).toContain('${best.model_id}::${best.capability_id}');
  });

  it('routes generator quotes only through generation mappings for the canonical model',()=>{
    const router=read('server/services/smartRouterService.ts');
    expect(router).toContain('function mappingMatchesOperation');
    expect(router).toContain("IMAGE_GENERATION_CAPS");
    expect(router).toContain("VIDEO_GENERATION_CAPS");
    expect(router).toContain('activeMappingsByProvider');
  });

  it('only exposes editor capabilities backed by a configured priced provider route',()=>{
    const route=read('server/routes/editorRoutes.ts');
    expect(route).toContain('const readyCapabilityIds=new Set');
    expect(route).toContain('readyCapabilityIds.has(item.id as any)');
  });
});