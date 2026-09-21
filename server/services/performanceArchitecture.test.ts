import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('performance architecture stages 4 and 5',()=>{
  it('splits heavy views out of the initial app chunk',()=>{
    const source=read('src/App.tsx');
    expect(source).toContain("lazy(()=>import('./components/views/");
    expect(source).toContain('<Suspense');
    expect(source).not.toContain("import { AdminView } from './components/views/AdminView.js'");
    expect(source).not.toContain("import { CreateHubView } from './components/views/CreateHubView.js'");
  });

  it('deduplicates GETs and exposes a user-scoped shared response cache',()=>{
    const source=read('src/services/apiClient.ts');
    expect(source).toContain('const inFlightGets=new Map');
    expect(source).toContain('const responseCache=new Map');
    expect(source).toContain('export function apiRequestCached');
    expect(source).toContain("auth.currentUser?.uid||'anonymous'");
  });

  it('batches model pricing previews instead of issuing one HTTP quote per model',()=>{
    const image=read('src/components/views/UnifiedImageCreateView.tsx');
    const video=read('src/components/views/CreateView.tsx');
    const client=read('src/services/universalGenerationClient.ts');
    const routes=read('server/routes/generationRoutes.ts');
    expect(image).toContain('universalGenerationClient.quoteBatch(requests)');
    expect(video).toContain('universalGenerationClient.quoteBatch(requests)');
    expect(client).toMatch(/["']\/api\/generations\/quote-batch["']/);
    expect(routes).toMatch(/["']\/generations\/quote-batch["']/);
    expect(routes).toMatch(/pricing:\s*\{\s*model_id:\s*draft\.model_id/);
  });

  it('polls only active generation ids and batch-reads their records',()=>{
    const gallery=read('src/components/workspace/CreationGallery.tsx');
    const client=read('src/services/generationClient.ts');
    const routes=read('server/routes/generationRoutes.ts');
    const repo=read('server/repositories/generationRepository.ts');
    expect(gallery).toContain('generationClient.statusBatch(activeGenerationIds)');
    expect(client).toMatch(/["']\/api\/generations\/status-batch["']/);
    expect(routes).toMatch(/["']\/generations\/status-batch["']/);
    expect(repo).toContain('firestoreAdminRest.batchGet(paths)');
  });

  it('caches catalog reads with explicit invalidation on writes',()=>{
    const source=read('server/repositories/catalogRepository.ts');
    expect(source).toContain('CATALOG_CACHE_TTL_MS=30_000');
    expect(source).toContain("cachedRows<ModelRegistryItem>('models'");
    expect(source).toContain("invalidateCatalog('models')");
    expect(source).toContain("invalidateCatalog('providers')");
  });

  it('avoids serial community reference reads and writes during recreate',()=>{
    const source=read('server/routes/communityRoutes.ts');
    const start=source.indexOf("communityRouter.post('/community/:generationId/recreate'");
    const block=source.slice(start);
    expect(block).toContain('firestoreAdminRest.batchGet(paths)');
    expect(block).toContain('if(writes.length)await firestoreAdminRest.commit(writes)');
    expect(block).not.toContain('await firestoreAdminRest.get(`assets/');
  });
});
