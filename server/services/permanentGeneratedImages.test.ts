import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('permanent generated image stage 1',()=>{
  it('does not finalize generated output from a provider URL alone',()=>{
    const execution=read('server/routing-v2/executionService.ts');
    const storage=read('server/services/generatedAssetStorageService.ts');
    expect(execution).toContain('generatedAssetStorageService.archive');
    expect(execution).toContain('media_metadata?.archived===true');
    expect(execution).toContain('assetRepository.updateAsset');
    expect(storage).toContain('ASSET_ARCHIVE_NOT_VISIBLE');
    expect(storage).toContain("method:'HEAD'");
  });

  it('renders image assets through the shared resilient media component',()=>{
    const gallery=read('src/components/workspace/CreationGallery.tsx');
    const assets=read('src/components/views/AssetsView.tsx');
    const history=read('src/components/views/HistoryView.tsx');
    expect(gallery).toContain('<ResilientImage');
    expect(assets).toContain('<ResilientImage');
    expect(history).toContain('<ResilientImage');
  });

  it('tries thumbnail preview and original before showing an IA Connect fallback',()=>{
    const component=read('src/components/common/ResilientImage.tsx');
    const gallery=read('src/components/workspace/CreationGallery.tsx');
    expect(component).toContain('Imagem indisponível');
    expect(component).toContain('Tentar novamente');
    expect(gallery).toContain('asset.thumbnail_url,asset.preview_url,asset.public_url');
  });
});
