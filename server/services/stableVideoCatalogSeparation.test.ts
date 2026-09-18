import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Stable video generator catalog separation',()=>{
  it('lists only actual video-generation models in CreateView',()=>{
    const view=read('src/components/views/CreateView.tsx');
    expect(view).toContain("m.category==='VIDEO'");
    expect(view).toContain("includes('TEXT_TO_VIDEO')");
    expect(view).toContain("includes('IMAGE_TO_VIDEO')");
  });

  it('keeps editor-only video models represented as editor capabilities',()=>{
    const inventory=read('src/config/curatedModelInventory.ts');
    expect(inventory).toContain("case'VIDEO_EDIT'");
    expect(inventory).toContain("beta_capability_ids:['video-edit']");
    expect(inventory).toContain("case'VIDEO_EXTEND'");
    expect(inventory).toContain("beta_capability_ids:['video-extend']");
  });
});
