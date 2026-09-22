import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 phase 4 contextual controls',()=>{
 it('hides visual node chrome until hover focus or selection',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain("const chromeVisibility=selected?'visible opacity-100'");
  expect(shell).toContain('group-hover:visible group-hover:opacity-100');
  expect(shell).toContain('group-focus-within:visible group-focus-within:opacity-100');
  expect(shell).toContain("data-selected={selected?'true':'false'}");
 });

 it('keeps connection ports visually secondary until the node is actionable',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain("const portVisibility=selected||connectionHint!=='NONE'?'visible opacity-100'");
  expect(shell).toContain('invisible opacity-0');
  expect(shell).toContain('aria-label="Entrada do node"');
  expect(shell).toContain('aria-label="Saída do node; arraste para conectar"');
 });

 it('hides generator prompt model format duration resolution and button when idle',()=>{
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(generator).toContain("const controlsVisibility=selected?'visible translate-y-0 opacity-100 pointer-events-auto'");
  expect(generator).toContain('pointer-events-none');
  expect(generator).toContain('group-hover:pointer-events-auto');
  expect(generator).toContain('group-focus-within:pointer-events-auto');
 });

 it('keeps selected generator controls fully visible without requiring hover',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(workspace).toContain('selected={selectedNow}');
  expect(generator).toContain('selected:boolean');
  expect(generator).toContain("selected?'opacity-100':'opacity-0");
 });

 it('keeps keyboard access by making the node focusable and revealing contextual UI on focus-within',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain('tabIndex={0}');
  expect(shell).toContain('group-focus-within:visible');
 });

 it('does not alter generation runtime persistence billing or graph execution',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.advance');
  expect(workspace).toContain('spacesClient.save');
  expect(workspace).not.toContain('creditWalletService');
 });
});
