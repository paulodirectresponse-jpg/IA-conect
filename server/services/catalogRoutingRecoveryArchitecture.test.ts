import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('catalog routing, editor separation and pricing fixes',()=>{
  it('bulk-loads catalog policies without one Firestore read/write per model',()=>{
    const service=read('server/beta/catalog/catalogPolicyService.ts');
    const listBlock=service.slice(service.indexOf('async listCatalog()'),service.indexOf('async resolveModel'));
    expect(listBlock).toContain('catalogPolicyRepository.listModelPolicies()');
    expect(listBlock).toContain('catalogRepository.listMappings()');
    expect(listBlock).not.toContain('Promise.all(models.map');
    expect(listBlock).not.toContain('this.ensureModelPolicy(model)');
  });

  it('keeps video edit and extend out of the normal video generator',()=>{
    const view=read('src/beta/views/BetaVideoView.tsx');
    const client=read('src/beta/videoClient.ts');
    const toolSection=view.slice(view.indexOf('const TOOLS'),view.indexOf('const DEFAULT_DURATIONS'));
    expect(toolSection).not.toContain("id:'video-edit'");
    expect(toolSection).not.toContain("id:'video-extend'");
    expect(client).toContain("new Set(['text-to-video','image-to-video','first-frame','last-frame'])");
  });

  it('keeps edit and extend available through editor routes',()=>{
    const route=read('server/routes/editorRoutes.ts');
    expect(route).toContain("const VIDEO_CAPABILITIES=['video-extend','video-edit']");
  });

  it('syncs WaveSpeed pricing for image and video curated functions',()=>{
    const scan=read('server/services/providerModelScanService.ts');
    expect(scan).toContain("const livePriceBudget=12");
    expect(scan).toContain('verifiedExisting.has(exactKey)');
    expect(scan).toContain("'IMAGE_GENERATION','IMAGE_EDIT','VIDEO_GENERATION','VIDEO_EDIT','VIDEO_EXTEND','VOICE','MUSIC','THREE_D'");
  });

  it('auto-publishes a model when approved mapping plus verified pricing makes it ready',()=>{
    const route=read('server/routes/providerScanRoutes.ts');
    expect(route).toContain('stableModelPublicationService.publish(model.model_id)');
    expect(route).toContain('published:Boolean(publication)');
  });
});
