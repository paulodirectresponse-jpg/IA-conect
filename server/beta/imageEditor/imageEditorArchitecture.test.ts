import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-10 Image Editor architecture',()=>{
  it('keeps provider mapping on the server and provider IDs out of React',()=>{
    const catalog=read('server/repositories/catalogRepository.ts');
    const ui=read('src/beta/views/BetaImageEditorView.tsx');
    expect(catalog).toContain("mapping('map-image-editor-v1-wave','image-editor-v1','provider-wavespeed','openai/gpt-image-2')");
    expect(ui).not.toMatch(/wavespeed|provider_id|provider_model_identifier|openai\/gpt-image/i);
  });

  it('executes every editor capability through Universal Jobs',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain("'image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'");
    expect(jobs).toContain("return'IMAGE_TO_IMAGE'");
    expect(jobs).toContain('generationService.createAndStartGeneration');
  });

  it('enforces source and mask ownership on the server',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain('assetRepository.getAsset(ref.asset_id,userId)');
    expect(jobs).toContain("ref.role==='SOURCE'");
    expect(jobs).toContain("ref.role==='MASK'");
    expect(jobs).toContain('MASK_REQUIRED');
  });

  it('preserves derivation lineage from the source image',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const generation=read('server/services/generationService.ts');
    expect(jobs).toContain("request.references.find(ref=>ref.role==='SOURCE')");
    expect(jobs).toContain('derived_from_asset_id:derivedAssetIdForRequest(running.request)');
    expect(generation).toContain("origin:generation.derived_from_asset_id?'DERIVED':'GENERATED'");
  });

  it('uploads masks as owned assets and never embeds base64 into jobs',()=>{
    const ui=read('src/beta/views/BetaImageEditorView.tsx');
    const types=read('server/beta/jobs/jobTypes.ts');
    expect(ui).toContain("new File([blob],'mask-'");
    expect(ui).toContain('assetService.uploadAsset');
    expect(types).not.toMatch(/base64|data_url|mask_bytes/i);
  });

  it('hides editor masks from Stable and Beta library listings',()=>{
    const repo=read('server/repositories/assetRepository.ts');
    expect(repo).toContain('asset.media_metadata?.editor_mask===true');
    const client=read('src/beta/imageEditorClient.ts');
    expect(client).toContain('editor_mask:true');
  });

  it('lazy-loads the editor and preserves Stable application isolation',()=>{
    const beta=read('src/beta/BetaApp.tsx');
    const app=read('src/App.tsx');
    expect(beta).toContain("lazy(()=>import('./views/BetaImageEditorView.js')");
    expect(app).not.toContain('BetaImageEditorView');
    expect(app).not.toContain('imageEditorClient');
  });

  it('contains explicit responsive and touch mask behavior',()=>{
    const css=read('src/beta/styles/beta.css');
    const ui=read('src/beta/views/BetaImageEditorView.tsx');
    expect(css).toContain('.ia-beta-image-mask');
    expect(css).toContain('touch-action:none');
    expect(css).toContain('@media(max-width:767px)');
    expect(ui).toContain('onPointerMove={move}');
  });
});
