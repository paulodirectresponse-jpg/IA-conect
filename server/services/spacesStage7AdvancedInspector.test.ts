import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces stage 7 advanced inspector',()=>{
 it('keeps frequent controls in the generator card and advanced controls in a separate Inspector',()=>{
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  const inspector=read('src/components/spaces/inspector/SpaceAdvancedInspector.tsx');
  expect(generator).toContain("controls.has('aspect_ratio')");
  expect(generator).toContain("controls.has('resolution')");
  expect(generator).toContain("controls.has('duration')");
  expect(inspector).toContain("const BASIC=new Set(['aspect_ratio','resolution','duration'])");
  expect(inspector).toContain('Parâmetros avançados');
 });

 it('derives advanced fields only from controls declared by the selected capability',()=>{
  const inspector=read('src/components/spaces/inspector/SpaceAdvancedInspector.tsx');
  expect(inspector).toContain('selectedCapability?.controls');
  expect(inspector).toContain('.filter(control=>!BASIC.has(control))');
  expect(inspector).toContain('Somente controles declarados pelo catálogo Routing V2 são exibidos.');
 });

 it('uses Routing V2 enumerated options instead of inventing free-form values when available',()=>{
  const catalog=read('server/routing-v2/catalogService.ts');
  const client=read('src/beta/capabilityClient.ts');
  const inspector=read('src/components/spaces/inspector/SpaceAdvancedInspector.tsx');
  expect(catalog).toContain('control_options=Object.fromEntries');
  expect(client).toContain('control_options?:Record<string,(string|number)[]>');
  expect(inspector).toContain('declaredOptions.length');
  expect(inspector).toContain('Padrão do modelo');
 });

 it('keeps reference controls connection-driven instead of duplicating asset pickers',()=>{
  const inspector=read('src/components/spaces/inspector/SpaceAdvancedInspector.tsx');
  expect(inspector).toContain("CONNECTION_MANAGED=new Set(['reference_image','first_frame','last_frame'])");
  expect(inspector).toContain('Gerenciado pelas conexões do canvas.');
 });

 it('supports specialized advanced control input types',()=>{
  const inspector=read('src/components/spaces/inspector/SpaceAdvancedInspector.tsx');
  expect(inspector).toContain("key==='negative_prompt'");
  expect(inspector).toContain('BOOLEAN.has(key)');
  expect(inspector).toContain('NUMBER.has(key)');
  expect(inspector).toContain("key==='variation_strength'?0:undefined");
 });

 it('opens Inspector from the node shell and edits the same node controls',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(shell).toContain('Abrir Inspector');
  expect(workspace).toContain('setInspectorOpen(true)');
  expect(workspace).toContain('<SpaceAdvancedInspector');
  expect(workspace).toContain('onPatch={patch=>patchNode(selected.node_id,patch)}');
 });

 it('does not create a second control schema or backend path for Inspector edits',()=>{
  const inspector=read('src/components/spaces/inspector/SpaceAdvancedInspector.tsx');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(inspector).not.toContain('apiRequest');
  expect(inspector).not.toContain('spacesClient');
  expect(workspace).toContain('patchNode');
  expect(workspace).toContain('spacesClient.save');
 });
});