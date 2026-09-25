import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('legacy image recovery stage 2',()=>{
  it('recovers old successful image generations into official storage in bounded batches',()=>{
    const service=read('server/services/legacyImageRecoveryService.ts');
    expect(service).toContain('generatedAssetStorageService.archive');
    expect(service).toContain("Math.min(5");
    expect(service).toContain('listUserGenerationsPage');
    expect(service).toContain("source_output_index:index");
  });

  it('rewrites generation outputs to recovered permanent assets',()=>{
    const service=read('server/services/legacyImageRecoveryService.ts');
    expect(service).toContain('anyG.result_asset_ids=assetIds');
    expect(service).toContain('anyG.result_url=urls[0]||null');
    expect(service).toContain('anyG.thumbnail_url=urls[0]');
    expect(service).toContain("media_recovery_status");
  });

  it('marks truly unrecoverable media without deleting historical records',()=>{
    const service=read('server/services/legacyImageRecoveryService.ts');
    expect(service).toContain("recovery_status:'UNAVAILABLE'");
    expect(service).toContain("media_recovery_status='UNAVAILABLE'");
    expect(service).not.toContain('softDeleteAsset');
  });

  it('avoids repeatedly hammering dead provider URLs',()=>{
    const service=read('server/services/legacyImageRecoveryService.ts');
    expect(service).toContain("recoveryStatus==='UNAVAILABLE'?24*60*60*1000");
    expect(service).toContain("7*24*60*60*1000");
  });

  it('runs recovery automatically from gallery library and history without blocking initial render',()=>{
    const gallery=read('src/components/workspace/CreationGallery.tsx');
    const assets=read('src/components/views/AssetsView.tsx');
    const history=read('src/components/views/HistoryView.tsx');
    const client=read('src/services/assetService.ts');
    expect(gallery).toContain('recoverLegacyGeneratedHistory');
    expect(assets).toContain('recoverLegacyGeneratedHistory');
    expect(history).toContain('recoverLegacyGeneratedHistory');
    expect(client).toContain('legacyRecoveryPromise');
    expect(client).toContain('for(let i=0;i<40;i++)');
  });

  it('keeps recovery user-scoped and authenticated',()=>{
    const routes=read('server/routes/assetRoutes.ts');
    expect(routes).toContain("assetRouter.post('/assets/recover-generated', requireAuth");
    expect(routes).toContain('userId:req.user!.uid');
  });
});
