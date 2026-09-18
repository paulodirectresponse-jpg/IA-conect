import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('Admin bulk curated AI add',()=>{
  it('uses a curated-only bulk endpoint with a hard request limit',()=>{
    const route=read('server/routes/adminRoutes.ts');
    expect(route).toContain("adminRouter.post('/admin/models/bulk-curated'");
    expect(route).toContain("if(modelIds.length>50)");
    expect(route).toContain('providerCatalogService.ensureCuratedModels(modelIds)');
  });

  it('batches Firestore writes instead of issuing one request per model',()=>{
    const repository=read('server/repositories/catalogRepository.ts');
    expect(repository).toContain('async saveModelsBulk(values:ModelRegistryItem[])');
    expect(repository).toContain('const chunkSize=25');
    expect(repository).toContain('firestoreAdminRest.commit');
  });

  it('only persists known curated seeds and keeps them experimental',()=>{
    const service=read('server/services/providerCatalogService.ts');
    expect(service).toContain('const seed=modelSeedById.get(modelId)');
    expect(service).toContain('rejected.push(modelId)');
    const inventory=read('src/config/curatedModelInventory.ts');
    expect(inventory).toContain("status:'EXPERIMENTAL'");
    expect(inventory).toContain('beta_only:true');
  });

  it('makes the bulk action visible and states that mappings and pricing are not auto-enabled',()=>{
    const ui=read('src/components/admin/AdminAIProvidersHub.tsx');
    expect(ui).toContain('Adicionar IAs em massa');
    expect(ui).toContain('Isso não ativa mapping, provider nem preço automaticamente');
    expect(ui).toContain('Máximo 50 por operação.');
  });
});
