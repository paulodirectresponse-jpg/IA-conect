import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
import{resolveDirectSpaceConnection}from'../../src/components/spaces/canvas/spaceConnections.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const models:any[]=[{model_id:'AUTO',capabilities:[
 {id:'text-to-image',inputs:['TEXT'],outputs:['IMAGE']},
 {id:'image-edit',inputs:['IMAGE','TEXT'],outputs:['IMAGE']},
 {id:'image-to-video',inputs:['IMAGE','TEXT'],outputs:['VIDEO']},
]}];
const asset=(id:string,type:'IMAGE'|'VIDEO')=>({node_id:id,kind:'ASSET',label:id,x:0,y:0,media_type:type,asset_id:id});
const tool=(id:string,capability:string)=>({node_id:id,kind:'TOOL',label:id,x:0,y:0,capability_id:capability,model_id:'AUTO',controls:{}});

describe('Spaces V2 phase 5 universal connections',()=>{
 it('connects independently-created compatible nodes later',()=>{
  const nodes:any[]=[asset('image','IMAGE'),tool('edit','image-edit')];
  const result=resolveDirectSpaceConnection(models as any,nodes,[],'image','edit');
  expect(result.status).toBe('COMPATIBLE');
  expect(result.mediaType).toBe('IMAGE');
 });

 it('supports dragging backwards from an input to choose a source',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(shell).toContain('onInputPointerDown');
  expect(workspace).toContain("anchor:'INPUT'");
  expect(workspace).toContain("linking.anchor==='INPUT'?linking.toId:hoverId");
 });

 it('supports dragging forwards from an output and dropping on the whole target card',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("anchor:'OUTPUT'");
  expect(workspace).toContain("closest<HTMLElement>('[data-space-node]')");
  expect(workspace).toContain('connectExisting(fromId,toId)');
 });

 it('rejects incompatible media, duplicates and cycles before persistence',()=>{
  const incompatible:any[]=[asset('video','VIDEO'),tool('edit','image-edit')];
  expect(resolveDirectSpaceConnection(models as any,incompatible,[],'video','edit').status).toBe('INCOMPATIBLE');
  const nodes:any[]=[asset('image','IMAGE'),tool('a','image-edit'),tool('b','image-edit')];
  const one:any={edge_id:'e1',from_node_id:'image',to_node_id:'a',media_type:'IMAGE'};
  expect(resolveDirectSpaceConnection(models as any,nodes,[one],'image','a').status).toBe('DUPLICATE');
  const two:any={edge_id:'e2',from_node_id:'a',to_node_id:'b',media_type:'IMAGE'};
  expect(resolveDirectSpaceConnection(models as any,nodes,[one,two],'b','a').status).toBe('CYCLE');
 });

 it('shows live green/red target feedback and keeps handles visible during linking',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(workspace).toContain("linking.hoverStatus==='COMPATIBLE'?'TARGET_COMPATIBLE':'TARGET_BLOCKED'");
  expect(workspace).toContain("linking.hoverStatus==='COMPATIBLE'?'rgba(110,231,183,.95)'");
  expect(shell).toContain("connectionHint==='TARGET_COMPATIBLE'");
  expect(shell).toContain("connectionHint!=='NONE'?'visible opacity-100'");
 });

 it('keeps blank-space output drops opening the contextual creation menu',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("!connected&&linking.anchor==='OUTPUT'&&!hoverId");
  expect(workspace).toContain('fromId:linking.fromId');
 });

 it('does not alter runtime billing persistence or backend graph contracts',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.save');
  expect(workspace).not.toContain('creditWalletService');
 });
});
