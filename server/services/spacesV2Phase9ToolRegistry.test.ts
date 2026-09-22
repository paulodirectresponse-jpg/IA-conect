import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
import{SPACE_CAPABILITY_IDS,SPACE_TOOL_REGISTRY,spaceRootTools,spaceToolsForOutputTypes,spaceToolLabel}from'../../src/shared/spaceToolRegistry.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 phase 9 single Tool Registry',()=>{
 it('keeps one canonical definition for every capability exposed to Spaces backend catalog',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain("import {SPACE_CAPABILITY_IDS} from '../../src/shared/spaceToolRegistry.js'");
  expect(routes).toContain('listCapabilityModels([...SPACE_CAPABILITY_IDS])');
  expect(routes).not.toContain('STABLE_CAPABILITY_IDS');
  expect(new Set(SPACE_CAPABILITY_IDS).size).toBe(SPACE_CAPABILITY_IDS.length);
  expect(SPACE_TOOL_REGISTRY.length).toBe(SPACE_CAPABILITY_IDS.length);
 });

 it('preserves exactly the five current root tools and their order',()=>{
  expect(spaceRootTools().map(tool=>tool.capability)).toEqual(['text-to-image','text-to-video','image-edit','video-edit','video-extend']);
 });

 it('preserves the current image contextual options without leaking audio or 3D',()=>{
  const actions=spaceToolsForOutputTypes(['IMAGE']).map(tool=>tool.capability);
  for(const id of ['image-to-image','image-edit','image-to-video','background-remove-replace','upscale','outpaint','variations'])expect(actions).toContain(id);
  for(const id of ['text-to-speech','music','text-to-3d','image-to-3d','multi-image-to-3d'])expect(actions).not.toContain(id);
 });

 it('preserves the current video contextual options',()=>{
  expect(spaceToolsForOutputTypes(['VIDEO']).map(tool=>tool.capability)).toEqual(expect.arrayContaining(['video-edit','video-extend']));
 });

 it('feeds empty state, add menu, contextual menu and node labels from the registry',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spaceRootTools().map(toQuickAction)');
  expect(workspace).toContain('spaceToolsForOutputTypes(types).map(toQuickAction)');
  expect(workspace).toContain("spaceToolLabel(node.capability_id||'')");
  expect(workspace).not.toContain('const capabilityLabels:Record');
 });

 it('keeps legacy contextualCreation as a registry-backed compatibility facade, not a second catalog',()=>{
  const contextual=read('src/components/spaces/canvas/contextualCreation.ts');
  expect(contextual).toContain('SPACE_TOOL_REGISTRY');
  expect(contextual).toContain('.filter(tool=>tool.contextual');
  expect(contextual).not.toContain("{id:'image-to-image'");
 });

 it('uses registry labels as the canonical capability labels',()=>{
  expect(spaceToolLabel('text-to-image')).toBe('Gerar imagem');
  expect(spaceToolLabel('video-extend')).toBe('Estender vídeo');
  expect(spaceToolLabel('future-capability')).toBe('future-capability');
 });

 it('does not change runtime billing persistence or provider routing',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const routes=read('server/routes/spacesRoutes.ts');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.save');
  expect(routes).toContain('routingV2CatalogService.listCapabilityModels');
  expect(workspace).not.toContain('creditWalletService');
 });
});
