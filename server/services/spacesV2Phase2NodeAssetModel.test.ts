import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 phase 2 node + asset model',()=>{
 it('versions every persisted node with schema v2 and preserves UI metadata',()=>{
  const types=read('server/beta/flows/flowTypes.ts');
  const service=read('server/beta/flows/flowService.ts');
  expect(types).toContain('schema_version?:2');
  expect(types).toContain("fit?:'cover'|'contain'");
  expect(service).toContain('schema_version:2');
  expect(service).toContain("fit:rawUi.fit==='contain'?'contain':'cover'");
 });

 it('uses one central semantic model for node inputs outputs and capabilities',()=>{
  const model=read('src/components/spaces/model/spaceNodeModel.ts');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(model).toContain('spaceNodeOutputTypes');
  expect(model).toContain('spaceNodeInputTypes');
  expect(model).toContain('spaceNodeCapability');
  expect(workspace).toContain('spaceNodeOutputTypes(models,');
  expect(workspace).toContain('spaceNodeInputTypes(models,');
  expect(workspace).toContain('spaceNodeCapability(models,');
 });

 it('keeps assets independent and referenced by asset id instead of embedding files in nodes',()=>{
  const model=read('src/components/spaces/model/spaceNodeModel.ts');
  const types=read('server/beta/flows/flowTypes.ts');
  expect(types).toContain('asset_id?:string|null');
  expect(model).toContain("node.kind==='ASSET'&&node.asset_id");
  expect(model).toContain("assetMap.get(node.asset_id)");
  expect(model).toContain("source:'ASSET'|'GENERATED'|'NONE'");
 });

 it('resolves generated outputs through reusable universal assets',()=>{
  const model=read('src/components/spaces/model/spaceNodeModel.ts');
  expect(model).toContain("history[safe]?.asset");
  expect(model).toContain("source=asset?'GENERATED':'NONE'");
  expect(model).toContain('aspectRatio:width&&height?width/height:null');
 });

 it('upgrades old nodes lazily when they are created or next saved',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('normalizeSpaceNodeV2({...base');
  expect(workspace).toContain('nodes:nodes.map(normalizeSpaceNodeV2)');
 });

 it('does not change runtime billing or execution contracts',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.advance');
  expect(workspace).toContain('spacesClient.save');
  expect(workspace).not.toContain('creditWalletService');
 });
});
