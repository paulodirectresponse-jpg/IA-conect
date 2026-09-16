import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-06 Projects + Library 2.0 architecture',()=>{
  it('keeps project, collection and library routes authenticated and beta-gated',()=>{
    const routes=read('server/routes/betaLibraryRoutes.ts');
    expect(routes).toContain("betaLibraryRouter.use('/beta/library',requireAuth,requireBetaEnabled)");
    expect(routes).toContain("betaLibraryRouter.use('/beta/projects',requireAuth,requireBetaEnabled)");
    expect(routes).toContain("betaLibraryRouter.use('/beta/collections',requireAuth,requireBetaEnabled)");
  });

  it('validates ownership through the canonical asset repository before organization or intents',()=>{
    const service=read('server/beta/library/libraryService.ts');
    expect(service).toContain('assetRepository.getAsset(assetId,userId)');
    expect(service).toContain('await ownedAsset(userId,assetId)');
    expect(service).toContain("action:'REMIX'|'USE_IN'");
  });

  it('provides cursor pagination and bounded page sizes',()=>{
    const service=read('server/beta/library/libraryService.ts');
    const routes=read('server/routes/betaLibraryRoutes.ts');
    expect(service).toContain("toString('base64url')");
    expect(service).toContain('Math.min(60,Math.max(1');
    expect(service).toContain('next_cursor');
    expect(routes).toContain('cursor:String(req.query.cursor');
  });

  it('supports projects, collections, tags and favorites without copying binary assets',()=>{
    const repo=read('server/beta/library/libraryRepository.ts');
    expect(repo).toContain('beta_projects');
    expect(repo).toContain('beta_collections');
    expect(repo).toContain('beta_library_items');
    expect(repo).toContain('is_favorite');
    expect(repo).toContain('tags:string[]');
    expect(repo).not.toMatch(/binary_data|file_bytes|base64_data|storage_path/);
  });

  it('keeps the Stable application free of Library 2.0 imports',()=>{
    const app=read('src/App.tsx');
    const layout=read('src/components/layout/AppLayout.tsx');
    expect(app).not.toContain('BetaLibraryView');
    expect(app).not.toContain('libraryClient');
    expect(layout).not.toContain('BetaLibraryView');
  });

  it('keeps Library 2.0 inside the lazy Beta bundle with responsive mobile behavior',()=>{
    const app=read('src/App.tsx');
    const beta=read('src/beta/BetaApp.tsx');
    const css=read('src/beta/styles/beta.css');
    expect(app).toContain("const BetaApp=lazy(");
    expect(beta).toContain('<BetaLibraryView');
    expect(css).toContain('@media(max-width:900px)');
    expect(css).toContain('@media(max-width:767px)');
    expect(css).toContain('.ia-beta-library-drawer');
  });

  it('persists Remix and Use-in intent without duplicating the asset',()=>{
    const beta=read('src/beta/BetaApp.tsx');
    const client=read('src/beta/libraryClient.ts');
    expect(beta).toContain("sessionStorage.setItem(INTENT_KEY");
    expect(beta).toContain("CustomEvent('ia:beta:library-intent'");
    expect(client).toContain('/remix');
    expect(client).toContain('/use-in');
    expect(client).not.toContain('provider_id');
  });
});
