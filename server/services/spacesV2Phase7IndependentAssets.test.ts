import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
import{libraryAssetToSpaceAsset,sameUniversalAsset,spaceAssetToLibraryAsset}from'../../src/components/spaces/model/spaceAssets.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const asset:any={asset_id:'ast_1',type:'IMAGE',category:'GENERIC',name:'Resultado',alias:'resultado',status:'READY',origin:'GENERATED',public_url:'https://example.com/a.png',preview_url:'https://example.com/a.png',preview_mime_type:'image/png',mime_type:'image/png',size_bytes:10,width:1080,height:1350,duration_seconds:null,source_generation_id:'gen_1',source_job_id:'job_1',derived_from_asset_id:null,source_output_index:0,source_model_id:'model_1',media_metadata:{},created_at:'2026-09-22T00:00:00.000Z',updated_at:'2026-09-22T00:00:00.000Z'};

describe('Spaces V2 phase 7 independent assets',()=>{
 it('keeps the exact universal asset identity when moving between Spaces and Library UI',()=>{
  const picker=spaceAssetToLibraryAsset(asset);
  const roundTrip=libraryAssetToSpaceAsset(picker);
  expect(roundTrip.asset_id).toBe(asset.asset_id);
  expect(roundTrip.source_generation_id).toBe('gen_1');
  expect(roundTrip.source_job_id).toBe('job_1');
  expect(roundTrip.width).toBe(1080);
  expect(roundTrip.height).toBe(1350);
  expect(sameUniversalAsset(asset,roundTrip)).toBe(true);
 });

 it('opens the shared IA Connect AssetPicker instead of silently choosing the first library item',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("import{AssetPickerModal}from'../workspace/AssetPickerModal.js'");
  expect(workspace).toContain("openAssetPicker('IMAGE'");
  expect(workspace).toContain("openAssetPicker('VIDEO'");
  expect(workspace).toContain('Escolha um Asset reutilizável da Biblioteca');
  expect(workspace).not.toContain("assets.find(a=>a.type===type)");
 });

 it('lets a generated output become an independent Asset node without duplicating the underlying asset',()=>{
  const preview=read('src/components/spaces/nodes/NodeResultPreview.tsx');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(preview).toContain('Adicionar resultado como Asset independente');
  expect(preview).toContain('onAddAssetNode(asset)');
  expect(workspace).toContain('addIndependentAssetNode');
  expect(workspace).toContain('asset_id:asset.asset_id');
  expect(workspace).not.toContain('registerGeneratedAsset');
 });

 it('allows the same universal Asset to be instantiated more than once on the canvas',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("const addAssetNode=(asset:SpaceAsset,x:number,y:number)=>addNode");
  expect(workspace).not.toContain('nodes.some(n=>n.asset_id===asset.asset_id)');
 });

 it('deleting a canvas node removes only graph references and never deletes the global Asset',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('setNodes(rows=>rows.filter(n=>n.node_id!==id))');
  expect(workspace).toContain('setEdges(rows=>rows.filter(e=>e.from_node_id!==id&&e.to_node_id!==id))');
  expect(workspace).not.toContain('deleteAsset(');
  expect(workspace).not.toContain('softDeleteAsset');
 });

 it('keeps generated outputs in the shared user asset repository and lineage metadata',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  const repository=read('server/repositories/assetRepository.ts');
  expect(routes).toContain("assetRepository.listUserAssets(req.user!.uid,{includeUniversal:true})");
  expect(repository).toContain("origin:params.origin||'UPLOAD'");
  expect(repository).toContain('source_generation_id:params.source_generation_id??null');
  expect(repository).toContain('derived_from_asset_id:params.derived_from_asset_id??null');
 });

 it('keeps runtime billing and generation architecture untouched',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.save');
  expect(workspace).not.toContain('creditWalletService');
 });
});
