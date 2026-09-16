import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-06 Library API contract',()=>{
  it('exposes all required multimodal and organization filters',()=>{
    const routes=read('server/routes/betaLibraryRoutes.ts');
    for(const key of ['type','search','origin','favorite','project_id','collection_id','tag','cursor','limit']){
      expect(routes).toContain(`req.query.${key}`);
    }
    expect(routes).toContain("['IMAGE','VIDEO','AUDIO','MODEL_3D']");
  });

  it('exposes CRUD for projects and collections and asset organization',()=>{
    const routes=read('server/routes/betaLibraryRoutes.ts');
    expect(routes).toContain("patch('/beta/library/assets/:assetId'");
    expect(routes).toContain("post('/beta/projects'");
    expect(routes).toContain("patch('/beta/projects/:projectId'");
    expect(routes).toContain("delete('/beta/projects/:projectId'");
    expect(routes).toContain("post('/beta/collections'");
    expect(routes).toContain("patch('/beta/collections/:collectionId'");
    expect(routes).toContain("delete('/beta/collections/:collectionId'");
  });
});
