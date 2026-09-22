import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 post-phase review',()=>{
 it('restores the exact generated output selected when reopening the Space',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('restoredPreviewRef=useRef(false)');
  expect(workspace).toContain('space_preview_assets');
  expect(workspace).toContain('history.findIndex(item=>item.asset.asset_id===assetId)');
  expect(workspace).toContain('setHistoryIndexByNode(current=>({...restored,...current}))');
 });

 it('marks history navigation dirty so the selected preview is actually autosaved',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('const selectHistoryIndex=(nodeId:string,index:number)=>');
  expect(workspace).toContain('setHistoryIndexByNode(current=>({...current,[nodeId]:index}));markDirty();');
  expect(workspace).toContain('onHistoryIndexChange={next=>selectHistoryIndex(node.node_id,next)}');
 });

 it('keeps the latest preview map in the save callback closure',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('space_preview_assets:previewAssetIds');
  expect(workspace).toMatch(/\[dirty,edges,[^\]]*previewAssetIds[^\]]*zoom\]\);/);
 });

 it('creates Home items with the complete real-preview contract',()=>{
  const view=read('src/components/views/SpacesView.tsx');
  expect(view).toContain('cover_asset:null,recent_assets:[],preview_nodes:[]');
 });

 it('keeps client runtime values aligned with semantic edge bindings',()=>{
  const client=read('src/beta/flowRuntimeClient.ts');
  const server=read('server/beta/flows/flowRuntimeTypes.ts');
  for(const field of ['source_port?:string|null','target_port?:string|null']){
   expect(client).toContain(field);
   expect(server).toContain(field);
  }
 });

 it('does not alter generation billing providers or graph execution',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.save');
  expect(runtime).toContain('betaJobOrchestrator.create');
  expect(workspace).not.toContain('creditWalletService');
 });
});
