import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 phase 11 UX polish',()=>{
 it('shows live graph execution progress without changing runtime semantics',()=>{
  const hud=read('src/components/spaces/canvas/SpaceExecutionStatus.tsx');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(hud).toContain('execution_order');
  expect(hud).toContain('execution_layers');
  expect(hud).toContain('reused_node_ids');
  expect(workspace).toContain('<SpaceExecutionStatus');
  expect(workspace).toContain('spacesClient.retry(run.run_id)');
 });

 it('keeps execution state visible directly on visual nodes',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain("status&&visual");
  expect(shell).toContain("Node executando");
  expect(shell).toContain("animate-pulse bg-cyan-200");
 });

 it('colors graph edges according to execution state',()=>{
  const layer=read('src/components/spaces/canvas/SpaceConnectionLayer.tsx');
  expect(layer).toContain('nodeRuns');
  expect(layer).toContain("target?.status==='RUNNING'");
  expect(layer).toContain("target?.status==='FAILED'");
  expect(layer).toContain("target?.status==='SUCCEEDED'");
 });

 it('adds discoverable keyboard shortcuts without removing existing commands',()=>{
  const shortcuts=read('src/components/spaces/canvas/SpaceShortcuts.tsx');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const toolbar=read('src/components/spaces/canvas/SpaceToolbar.tsx');
  expect(shortcuts).toContain('Atalhos do Space');
  expect(shortcuts).toContain('Ctrl/⌘ + D');
  expect(workspace).toContain("event.key==='?'");
  expect(workspace).toContain("event.key.toLowerCase()==='f'");
  expect(workspace).toContain("event.key==='/ '").toBe(false);
  expect(workspace).toContain("event.key==='/ '").toBe(false);
  expect(workspace).toContain("event.key==='/'");
  expect(toolbar).toContain('Ver atalhos do Space');
 });

 it('keeps canvas controls contextual and lightweight',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(shell).toContain('group-hover:visible');
  expect(generator).toContain('pointer-events-none');
  expect(generator).toContain('group-hover:opacity-100');
 });

 it('keeps billing providers persistence and graph execution untouched',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.save');
  expect(runtime).toContain('betaJobOrchestrator.create');
  expect(workspace).not.toContain('creditWalletService');
 });
});
