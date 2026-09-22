import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces stage 1 visual foundation',()=>{
 it('keeps SpaceWorkspace focused on orchestration instead of inline presentation primitives',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("SpaceToolbar");
  expect(workspace).toContain("SpaceConnectionLayer");
  expect(workspace).toContain("SpaceQuickMenu");
  expect(workspace).toContain("SpaceNodeShell");
  expect(workspace).not.toContain('shadow-[0_20px_70px_rgba(0,0,0,.35)]');
 });

 it('centralizes canvas dimensions and connection geometry',()=>{
  const layout=read('src/components/spaces/canvas/spaceLayout.ts');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(layout).toContain('SPACE_WORLD_W=8000');
  expect(layout).toContain('SPACE_WORLD_H=5000');
  expect(layout).toContain('SPACE_NODE_W=260');
  expect(layout).toContain('SPACE_BASE_NODE_H=156');
  expect(workspace).toContain('SPACE_NODE_W');
  expect(workspace).toContain('SPACE_BASE_NODE_H');
 });

 it('keeps node shell responsible only for common node chrome and ports',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain('data-space-node');
  expect(shell).toContain('Arraste para conectar');
  expect(shell).toContain('onInputPointerDown');
  expect(shell).toContain('onOutputPointerDown');
  expect(shell).toContain('onDuplicate');
  expect(shell).toContain('onDelete');
  expect(shell).not.toContain('spacesClient');
  expect(shell).not.toContain('routingV2');
 });

 it('preserves existing workspace behavior while preparing capability-specific nodes',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  for(const behavior of ['ResizeObserver','spacesClient.start','spacesClient.advance',"window.addEventListener('paste'",'onDrop={onDrop}','onContextMenu={onCanvasContext}','model?.model_id||\'AUTO\''])expect(workspace).toContain(behavior);
 });

 it('keeps contextual creation isolated from graph execution',()=>{
  const menu=read('src/components/spaces/canvas/SpaceQuickMenu.tsx');
  expect(menu).toContain('O que deseja fazer com esta saída?');
  expect(menu).toContain('Adicionar ao Space');
  expect(menu).not.toContain('spacesClient');
  expect(menu).not.toContain('startRun');
 });
});
