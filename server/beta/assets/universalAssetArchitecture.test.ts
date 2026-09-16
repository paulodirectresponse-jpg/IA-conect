import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-05 Universal Assets architecture',()=>{
  it('supports all universal media types without creating separate libraries',()=>{
    const types=read('src/types/index.ts');
    expect(types).toContain("export type AssetType='IMAGE'|'VIDEO'|'AUDIO'|'MODEL_3D'");
    expect(types).toContain('source_job_id?:string|null');
    expect(types).toContain('derived_from_asset_id?:string|null');
    expect(types).toContain('preview_url?:string|null');
    expect(types).toContain('media_metadata?:Record');
  });

  it('keeps MODEL_3D hidden from Stable list calls by default',()=>{
    const repo=read('server/repositories/assetRepository.ts');
    expect(repo).toContain("!filters?.includeUniversal&&asset.type==='MODEL_3D'");
    expect(repo).toContain('includeUniversal?:boolean');
  });

  it('requires Beta generated outputs to be archived outside Firestore before READY registration',()=>{
    const generation=read('server/services/generationService.ts');
    expect(generation).toContain('strictArchive=Boolean(generation.source_job_id)');
    expect(generation).toContain('generatedAssetStorageService.archive');
    expect(generation).toContain("storage_path:storagePath");
    expect(generation).not.toMatch(/base64.*createAsset|createAsset.*base64/i);
  });

  it('propagates Job lineage into generated assets',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const generation=read('server/services/generationService.ts');
    expect(jobs).toContain('source_job_id:running.job_id');
    expect(jobs).toContain('derived_from_asset_id:derivedAssetIdForRequest');
    expect(generation).toContain('source_job_id:generation.source_job_id');
    expect(generation).toContain('derived_from_asset_id:generation.derived_from_asset_id');
  });

  it('keeps universal asset endpoints authenticated, beta-gated and provider-agnostic',()=>{
    const routes=read('server/routes/betaAssetRoutes.ts');
    const service=read('server/beta/assets/universalAssetService.ts');
    expect(routes).toContain("betaAssetRouter.use('/beta/assets',requireAuth,requireBetaEnabled)");
    expect(service).toContain('assetRepository.getAsset(assetId,userId)');
    expect(service).not.toContain('providerRegistry');
    expect(service).not.toContain('source_provider_id:');
  });

  it('does not store generated binary payloads inside Firestore documents',()=>{
    const storage=read('server/services/generatedAssetStorageService.ts');
    const repo=read('server/repositories/assetRepository.ts');
    expect(storage).toContain('/storage/v1/object/');
    expect(storage).toContain('body:buffer');
    expect(repo).not.toMatch(/binary_data|file_bytes|base64_data/);
  });
});
