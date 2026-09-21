import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-09 3D V1 architecture',()=>{
  it('keeps provider identifiers out of React and inside server mappings',()=>{
    const catalog=read('server/repositories/catalogRepository.ts');
    const ui=read('src/beta/views/BetaThreeDView.tsx');
    expect(catalog).toContain("mapping('map-three-d-v1-wave','three-d-v1','provider-wavespeed','wavespeed-ai/hunyuan3d-v3')");
    expect(ui).not.toMatch(/wavespeed|hunyuan3d|provider_id|provider_model_identifier/i);
  });

  it('executes 3D through universal Jobs and existing credit authority',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const generation=read('server/services/generationService.ts');
    expect(jobs).toContain("capabilityId==='text-to-3d'");
    expect(jobs).toContain('generationService.createAndStartGeneration');
    expect(generation).toContain('creditWalletService.reserveForGeneration');
    expect(generation).toContain('creditWalletService.captureForGeneration');
    expect(jobs).toContain("return'MODEL_3D'");
  });

  it('enforces owned image inputs and bounded multi-image count on the server',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain('assetRepository.getAsset(ref.asset_id,userId)');
    expect(jobs).toContain("request.capability_id==='image-to-3d'");
    expect(jobs).toContain("request.capability_id==='multi-image-to-3d'");
    expect(jobs).toContain('assets.length<2||assets.length>4');
  });

  it('archives generated 3D binaries in universal storage instead of Firestore blobs',()=>{
    const generation=read('server/services/generationService.ts');
    expect(generation).toContain("mediaType==='MODEL_3D'?'model/gltf-binary'");
    expect(generation).toContain("mediaType==='MODEL_3D'?'glb'");
    expect(generation).toContain('generatedAssetStorageService.archive');
    expect(generation).not.toMatch(/base64.*MODEL_3D|MODEL_3D.*base64/i);
  });

  it('lazy-loads the 3D workspace and leaves Stable unaware of it',()=>{
    const beta=read('src/beta/BetaApp.tsx');
    const app=read('src/App.tsx');
    expect(beta).toContain("lazy(()=>import('./views/BetaThreeDView.js')");
    expect(app).not.toContain('BetaThreeDView');
    expect(app).not.toContain('Model3DPreview');
  });

  it('ships a local lightweight GLB viewer with no heavy 3D dependency or CDN',()=>{
    const viewer=read('src/beta/components/Model3DPreview.tsx');
    const pkg=read('package.json');
    expect(viewer).toContain("canvas.getContext('webgl'");
    expect(viewer).toContain('parseGlb');
    expect(viewer).toContain("getExtension('OES_element_index_uint')");
    expect(pkg).not.toMatch(/three|babylon|model-viewer/i);
    expect(viewer).not.toMatch(/https:\/\/.*(three|babylon|modelviewer)/i);
  });

  it('has an explicit 3D kill switch and responsive mobile layout',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const css=read('src/beta/styles/beta.css');
    expect(jobs).toContain("featureFlagService.getFlag('beta.three_d')");
    expect(jobs).toContain('THREE_D_MODULE_DISABLED');
    expect(css).toContain('.ia-beta-3d-layout');
    expect(css).toContain('@media(max-width:767px)');
  });
});
