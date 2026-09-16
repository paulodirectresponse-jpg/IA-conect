import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-11 Video Unification architecture',()=>{
  it('keeps provider identifiers outside React and inside server mappings',()=>{
    const catalog=read('server/repositories/catalogRepository.ts');
    const ui=read('src/beta/views/BetaVideoView.tsx');
    expect(catalog).toContain("mapping('map-video-studio-v1-wave','video-studio-v1','provider-wavespeed','alibaba/wan-3.0-prime')");
    expect(ui).not.toMatch(/wavespeed|provider_id|provider_model_identifier|alibaba\/wan/i);
  });

  it('routes extend and edit through the existing multimodal video execution mode',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain("capabilityId==='video-extend'||capabilityId==='video-edit'");
    expect(jobs).toContain("return'REFERENCE_TO_VIDEO'");
    expect(jobs).toContain('generationService.createAndStartGeneration');
  });

  it('validates owned source media before video transformations',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain('assetRepository.getAsset(ref.asset_id,userId)');
    expect(jobs).toContain("['video-extend','video-edit'].includes(request.capability_id)");
    expect(jobs).toContain("first?.type!=='VIDEO'");
  });

  it('preserves lineage for image and video derived outputs',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const generation=read('server/services/generationService.ts');
    expect(jobs).toContain("'video-extend','video-edit'");
    expect(jobs).toContain("request.references.find(ref=>ref.role==='SOURCE')");
    expect(generation).toContain("origin:generation.derived_from_asset_id?'DERIVED':'GENERATED'");
  });

  it('uses Universal Jobs, credits and Universal Assets instead of a second video pipeline',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const generation=read('server/services/generationService.ts');
    expect(jobs).toContain('betaEconomicsService.resolveQuote');
    expect(generation).toContain('creditWalletService.reserveForGeneration');
    expect(generation).toContain('creditWalletService.captureForGeneration');
    expect(generation).toContain('registerGeneratedAssets');
  });

  it('lazy-loads Video V1 and keeps Stable UI unaware of it',()=>{
    const beta=read('src/beta/BetaApp.tsx');
    const stable=read('src/App.tsx');
    expect(beta).toContain("lazy(()=>import('./views/BetaVideoView.js')");
    expect(stable).not.toContain('BetaVideoView');
    expect(stable).not.toContain('videoClient');
  });

  it('keeps Beta logical models out of the Stable catalog endpoint',()=>{
    const route=read('server/routes/catalogRoutes.ts');
    const types=read('src/types/index.ts');
    const seed=read('src/config/studioCatalog.ts');
    expect(types).toContain('beta_only?:boolean');
    expect(route).toContain('models.filter(model=>model.beta_only!==true)');
    expect(seed).toContain("model_id:'video-studio-v1',beta_only:true");
  });

  it('ships explicit video kill switches and responsive mobile layout',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const flags=read('src/beta/betaFlags.ts');
    const css=read('src/beta/styles/beta.css');
    expect(jobs).toContain("getFeatureFlag('beta.video')");
    expect(jobs).toContain("getFeatureFlag('beta.video_editor')");
    expect(flags).toContain("flag_key: 'beta.video'");
    expect(css).toContain('.ia-beta-video-layout');
    expect(css).toContain('@media(max-width:767px)');
  });
});
