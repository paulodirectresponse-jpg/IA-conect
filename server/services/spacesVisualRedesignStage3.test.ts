import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces visual redesign stage 3 final polish',()=>{
 it('treats generator and asset nodes as visual surfaces with overlay chrome',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain("const visual=generator||node.kind==='ASSET'");
  expect(shell).toContain('{visual?<div');
  expect(shell).toContain('{!visual&&<div');
  expect(shell).toContain('from-black/70 via-black/30 to-transparent');
 });

 it('uses subtler selection, hover and connection treatments',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  const connections=read('src/components/spaces/canvas/SpaceConnectionLayer.tsx');
  expect(shell).toContain('ring-cyan-300/45');
  expect(shell).toContain('ring-white/[0.04]');
  expect(shell).toContain('hover:ring-white/[0.10]');
  expect(connections).toContain("target?.status==='RUNNING'");
  expect(connections).toContain("done?'rgba(110,231,183,.46)'");
  expect(connections).toContain('width=active?2.2:done?1.7:1.35');
 });

 it('keeps connection ports compact and visually secondary',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain('h-3 w-3');
  expect(shell).toContain('bg-zinc-600');
  expect(shell).toContain('bg-cyan-300/85');
  expect(shell).not.toContain('h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2');
 });

 it('lazy-loads the heavy workspace so it does not burden initial application startup',()=>{
  const view=read('src/components/views/SpacesView.tsx');
  expect(view).toContain("lazy(()=>import('../spaces/SpaceWorkspace.js'))");
  expect(view).toContain('<Suspense fallback=');
  expect(view).not.toContain("import{SpaceWorkspace}from'../spaces/SpaceWorkspace.js'");
 });

 it('preserves stage 2 click-away and contextual exclusivity behavior',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("document.addEventListener('pointerdown',onPointerDown,true)");
  expect(workspace).toContain("if(event.key==='Escape'){setQuick(null);setQuickQuery('');setLinking(null);setInspectorOpen(false);setAssetPicker(null);setShortcutsOpen(false);return;}");
  expect(workspace).toContain('addOpen={Boolean(quick&&!quick.fromId)}');
 });

 it('keeps full-bleed generation media and compact card dimensions from stage 1',()=>{
  const layout=read('src/components/spaces/canvas/spaceLayout.ts');
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  const preview=read('src/components/spaces/nodes/NodeResultPreview.tsx');
  expect(layout).toContain('SPACE_GENERATOR_NODE_W=286');
  expect(generator).toContain('className="relative h-full min-h-[170px] overflow-hidden"');
  expect(preview).toContain('fullBleed');
  expect(preview).toContain("fit==='contain'?'object-contain':'object-cover'");
 });

 it('does not alter runtime, billing, history or backend contracts',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.advance');
  expect(workspace).toContain('spacesClient.history');
  expect(workspace).not.toContain('creditWalletService');
  expect(workspace).not.toContain('apiRequest');
 });
});
