import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces visual redesign stage 2 interactions',()=>{
 it('closes the add/quick menu on outside pointer interaction',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const menu=read('src/components/spaces/canvas/SpaceQuickMenu.tsx');
  expect(menu).toContain('data-space-popover="quick-menu"');
  expect(workspace).toContain("document.addEventListener('pointerdown',onPointerDown,true)");
  expect(workspace).toContain("target?.closest('[data-space-popover=\"quick-menu\"],[data-space-popover-trigger=\"add\"]')");
  expect(workspace).toContain("document.removeEventListener('pointerdown',onPointerDown,true)");
 });

 it('keeps interactions inside the quick menu from dismissing it prematurely',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("if(target?.closest('[data-space-popover=\"quick-menu\"],[data-space-popover-trigger=\"add\"]'))return");
 });

 it('closes contextual UI with Escape and resets the search state',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("if(event.key==='Escape'){setQuick(null);setQuickQuery('');setLinking(null);setInspectorOpen(false);setAssetPicker(null);return;}");
 });

 it('keeps only one contextual panel open at a time',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("setInspectorOpen(false);setLinking(null);setQuick({x:Math.min");
  expect(workspace).toContain("setSelectedId(null);setInspectorOpen(false);setLinking(null);setQuick");
  expect(workspace).toContain("setQuick(null);setQuickQuery('');setLinking(null);setSelectedId(node.node_id);setInspectorOpen(true)");
 });

 it('closes the menu after an action or library item is selected',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("setQuick(null);setQuickQuery('');focusNodePrompt");
  expect(workspace).toContain("onAddImageAsset={()=>");
  expect(workspace).toContain("onAddImageAsset={()=>openAssetPicker('IMAGE'");
  expect(workspace).toContain("onAddVideoAsset={()=>openAssetPicker('VIDEO'");
 });

 it('exposes add-menu expanded state on the toolbar',()=>{
  const toolbar=read('src/components/spaces/canvas/SpaceToolbar.tsx');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(toolbar).toContain('addOpen:boolean');
  expect(toolbar).toContain('aria-haspopup="dialog"');
  expect(toolbar).toContain('aria-expanded={addOpen}');
  expect(toolbar).toContain('data-space-popover-trigger="add"');
  expect(workspace).toContain('addOpen={Boolean(quick&&!quick.fromId)}');
 });

 it('opens connection-created contextual menus without leaving the Inspector on top',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("!connected&&linking.anchor==='OUTPUT'&&!hoverId&&r&&linking.fromId");
 });

 it('does not change generation, execution or persistence contracts',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.advance');
  expect(workspace).toContain('spacesClient.save');
  expect(workspace).not.toContain('localStorage');
 });
});
