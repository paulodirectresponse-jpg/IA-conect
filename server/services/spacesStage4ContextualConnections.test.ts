import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces stage 4 smart contextual connections',()=>{
 it('derives contextual actions from the output media type',()=>{
  const contextual=read('src/components/spaces/canvas/contextualCreation.ts');
  expect(contextual).toContain('contextualActionsFor');
  expect(contextual).toContain("accepts:['IMAGE']");
  expect(contextual).toContain("accepts:['VIDEO']");
  for(const capability of ['image-to-image','image-edit','image-to-video','background-remove-replace','upscale','outpaint','variations','video-edit','video-extend'])expect(contextual).toContain(`capability:'${capability}'`);
 });

 it('groups contextual choices by creative intent instead of exposing a flat technical catalog',()=>{
  const menu=read('src/components/spaces/canvas/SpaceQuickMenu.tsx');
  expect(menu).toContain("['POPULAR','TRANSFORMAR','VÍDEO']");
  expect(menu).toContain('O que deseja fazer com esta saída?');
  expect(menu).toContain('conectar →');
  expect(menu).toContain('sourceTypeLabel');
 });

 it('creates downstream nodes in an open position to the right of their source',()=>{
  const contextual=read('src/components/spaces/canvas/contextualCreation.ts');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(contextual).toContain('smartConnectedNodePosition');
  expect(contextual).toContain('source.x+spaceNodeWidth(source)+120');
  expect(contextual).toContain('overlaps');
  expect(contextual).toContain('candidates=[0,220,-220,440,-440,660,-660]');
  expect(workspace).toContain('smartConnectedNodePosition(source,nodes,{x,y})');
 });

 it('connects the new node immediately with the compatible media type',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('capabilityForOutput(models,source)');
  expect(workspace).toContain('capabilityForInput(models,next)');
  expect(workspace).toContain('from_node_id:source.node_id');
  expect(workspace).toContain('to_node_id:next.node_id');
 });

 it('focuses the new node prompt after contextual creation',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('focusNodePrompt');
  expect(workspace).toContain('requestAnimationFrame');
  expect(workspace).toContain('[data-space-node=');
  expect(workspace).toContain('textarea`);el?.focus()');
 });

 it('keeps Auto fallback when a compatible tool has no READY model yet',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const menu=read('src/components/spaces/canvas/SpaceQuickMenu.tsx');
  expect(workspace).toContain("model?.model_id||'AUTO'");
  expect(menu).toContain('será salvo em Auto até a rota ficar disponível');
 });

 it('does not introduce a parallel backend or expand contextual V1 into audio/3D',()=>{
  const contextual=read('src/components/spaces/canvas/contextualCreation.ts');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(contextual).not.toMatch(/text-to-speech|music|text-to-3d|image-to-3d/);
  expect(workspace).toContain('spacesClient.start');
  expect(contextual).not.toContain('apiRequest');
 });
});