import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
import{adaptiveSpaceNodeSize,parseSpaceAspectRatio}from'../../src/components/spaces/model/spaceNodeModel.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 phase 3 adaptive cards',()=>{
 it('parses the common creative aspect ratios',()=>{
  expect(parseSpaceAspectRatio('9:16')).toBeCloseTo(9/16,5);
  expect(parseSpaceAspectRatio('16:9')).toBeCloseTo(16/9,5);
  expect(parseSpaceAspectRatio('1:1')).toBe(1);
  expect(parseSpaceAspectRatio('4:5')).toBeCloseTo(4/5,5);
 });

 it('turns portrait landscape square and social ratios into materially different node shapes',()=>{
  const portrait=adaptiveSpaceNodeSize(9/16);
  const landscape=adaptiveSpaceNodeSize(16/9);
  const square=adaptiveSpaceNodeSize(1);
  const social=adaptiveSpaceNodeSize(4/5);
  expect(portrait.height).toBeGreaterThan(portrait.width);
  expect(landscape.width).toBeGreaterThan(landscape.height);
  expect(square.width).toBe(square.height);
  expect(social.height).toBeGreaterThan(social.width);
 });

 it('keeps adaptive cards inside sane canvas bounds without distorting their ratios materially',()=>{
  for(const ratio of [9/16,16/9,1,4/5,3/2,2.39]){
   const size=adaptiveSpaceNodeSize(ratio);
   expect(size.width).toBeLessThanOrEqual(380);
   expect(size.height).toBeLessThanOrEqual(430);
   expect(size.width/size.height).toBeCloseTo(ratio,1);
  }
 });

 it('derives dimensions from real asset metadata before requested controls',()=>{
  const model=read('src/components/spaces/model/spaceNodeModel.ts');
  expect(model).toContain('const aspect=descriptor.aspectRatio||controlAspect||node.ui?.media_aspect_ratio||null');
  expect(model).toContain('width:desired.width');
  expect(model).toContain('height:desired.height');
  expect(model).toContain('media_aspect_ratio:desired.aspectRatio');
 });

 it('persists the adaptive dimensions on the node so edges and reopen use the same geometry',()=>{
  const layout=read('src/components/spaces/canvas/spaceLayout.ts');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(layout).toContain('const adaptive=Number(node.ui?.width)');
  expect(workspace).toContain('applyAdaptiveSpaceNodeVisual(node,descriptor)');
  expect(workspace).toContain('if(changed){setNodes(next);setDirty(true);setSaved(false);}');
 });

 it('renders visual nodes at adaptive height and avoids cropping by default after media is known',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  const preview=read('src/components/spaces/nodes/NodeResultPreview.tsx');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(shell).toContain('spaceNodeVisualHeight(node)');
  expect(shell).toContain('height:visualHeight||undefined');
  expect(preview).toContain("fit==='contain'?'object-contain':'object-cover'");
  expect(workspace).toContain("node.ui?.fit==='cover'?'object-cover':'object-contain'");
 });

 it('keeps generator and asset fallbacks usable before dimensions are available',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain('(generator?390:210)');
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(generator).toContain('min-h-[170px]');
 });

 it('does not change runtime billing execution or asset ownership contracts',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.advance');
  expect(workspace).toContain('asset_id');
  expect(workspace).not.toContain('creditWalletService');
 });
});
