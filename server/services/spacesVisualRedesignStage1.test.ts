import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces visual redesign stage 1',()=>{
 it('makes generator cards materially more compact',()=>{
  const layout=read('src/components/spaces/canvas/spaceLayout.ts');
  expect(layout).toContain('SPACE_GENERATOR_NODE_W=286');
  expect(layout).toContain('SPACE_BASE_NODE_H=156');
  expect(layout).not.toContain('SPACE_GENERATOR_NODE_W=340');
 });

 it('uses generation media as the card surface instead of a separate framed preview block',()=>{
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  const preview=read('src/components/spaces/nodes/NodeResultPreview.tsx');
  expect(generator).toContain('className="relative h-full min-h-[170px] overflow-hidden"');
  expect(generator).toContain('fullBleed');
  expect(generator).toContain("fit={node.ui?.fit||'cover'}");
  expect(preview).toContain("fit==='contain'?'object-contain':'object-cover'");
  expect(generator).not.toContain('space-y-3 p-3');
 });

 it('overlays prompt and primary generation controls over the media',()=>{
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(generator).toContain('absolute inset-x-0 bottom-0');
  expect(generator).toContain('bg-gradient-to-b');
  expect(generator).toContain('backdrop-blur-md');
  expect(generator).toContain('value={node.prompt||');
  expect(generator).toContain('onClick={onGenerate}');
 });

 it('removes heavy generator header/footer boxes in favor of overlay chrome',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain("const GENERATORS=new Set");
  expect(shell).toContain('bg-gradient-to-b from-black/70 via-black/30 to-transparent');
  expect(shell).toContain("visual?<div");
  expect(shell).toContain("!visual&&<div");
  expect(shell).not.toContain('border-b border-white/[0.06] p-3');
 });

 it('keeps assets visual-first and full-cover',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('isAsset?<div className="h-full min-h-[170px] overflow-hidden');
  expect(workspace).toContain("node.ui?.fit==='cover'?'object-cover':'object-contain'");
  expect(workspace).toContain('className={`h-full w-full bg-black/30 ${fit}`}');
 });

 it('does not change Spaces runtime, history, inspector or execution contracts',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.advance');
  expect(workspace).toContain('SpaceAdvancedInspector');
  expect(generator).toContain('NodeResultPreview');
  expect(generator).not.toContain('apiRequest');
 });
});
