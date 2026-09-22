import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 phase 1 empty-state onboarding',()=>{
 it('replaces the generic first-tool CTA with the richer empty-state surface',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('<SpaceEmptyState');
  expect(workspace).not.toContain('Adicionar primeira ferramenta');
  expect(workspace).not.toContain('Comece instantaneamente');
 });

 it('keeps exactly the same root actions that already existed in Spaces',()=>{
  const registry=read('src/shared/spaceToolRegistry.ts');
  for(const capability of ['text-to-image','text-to-video','image-edit','video-edit','video-extend']){
   expect(registry).toContain(`capability:'${capability}'`);
  }
  expect((registry.match(/root:true/g)||[]).length).toBe(5);
  const empty=read('src/components/spaces/SpaceEmptyState.tsx');
  expect(empty).toContain('Imagem da Biblioteca');
  expect(empty).toContain('Vídeo da Biblioteca');
 });

 it('uses one shared action source for both empty state and quick menu',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('const rootQuickActions=useMemo');
  expect(workspace).toContain(':rootQuickActions');
  expect(workspace).toContain('actions={rootQuickActions}');
 });

 it('creates the selected action directly on the visible canvas',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('const emptyPoint=');
  expect(workspace).toContain('addTool(action.capability,p.x,p.y,null)');
  expect(workspace).toContain("addEmptyAsset('IMAGE')");
  expect(workspace).toContain("addEmptyAsset('VIDEO')");
 });

 it('keeps drag, paste, slash shortcut and existing runtime contracts intact',()=>{
  const empty=read('src/components/spaces/SpaceEmptyState.tsx');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(empty).toContain('Arraste imagem ou vídeo para o canvas');
  expect(empty).toContain('Cole mídia com Ctrl+V');
  expect(empty).toContain('Use “/” para abrir ações');
  expect(workspace).toContain("window.addEventListener('paste',onPaste)");
  expect(workspace).toContain("if(event.key==='/')");
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.save');
 });
});
