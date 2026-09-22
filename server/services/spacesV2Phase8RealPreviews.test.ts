import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 phase 8 real project previews',()=>{
 it('persists the asset currently shown by each visual node',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('const previewAssetIds=useMemo');
  expect(workspace).toContain('space_preview_assets:previewAssetIds');
  expect(workspace).toContain("historyIndexByNode[node.node_id]||0");
  expect(workspace).toContain('setDirty(true);setSaved(false)');
 });

 it('builds home preview nodes from the current graph geometry and persisted asset selection',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('const previewIds=');
  expect(routes).toContain('space_preview_assets');
  expect(routes).toContain('preview_nodes=(flow.graph?.nodes||[]).map');
  expect(routes).toContain('width=Number(node.ui?.width)');
  expect(routes).toContain('height=Number(node.ui?.height)');
  expect(routes).toContain('assetMap.get(previewIds[node.node_id])');
 });

 it('falls back to the latest generated output for older Spaces without a persisted preview snapshot',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('latestByFlowNode');
  expect(routes).toContain("if(!asset&&node.kind==='TOOL')");
  expect(routes).toContain('latest?.output_asset_ids?.find');
 });

 it('renders the actual graph instead of replacing the project with a single recent cover',()=>{
  const home=read('src/components/spaces/SpacesHome.tsx');
  expect(home).toContain('const RealWorkspacePreview');
  expect(home).toContain("const nodes=item?.preview_nodes||[]");
  expect(home).toContain('node.width');
  expect(home).toContain('node.height');
  expect(home).toContain('<NodeMedia node={node}/>');
  expect(home).toContain('edges.map(edge=>');
  expect(home).toContain('<RealWorkspacePreview flow={flow} item={item}/>');
  expect(home).not.toContain('<Preview flow={flow} item={item}/>');
 });

 it('shows real image and video media inside their corresponding mini nodes',()=>{
  const home=read('src/components/spaces/SpacesHome.tsx');
  expect(home).toContain("asset.type==='IMAGE'");
  expect(home).toContain("asset.type==='VIDEO'");
  expect(home).toContain('object-contain');
 });

 it('keeps preview data attached to the home contract',()=>{
  const client=read('src/services/spacesClient.ts');
  expect(client).toContain('export interface SpaceHomePreviewNode');
  expect(client).toContain('preview_nodes:SpaceHomePreviewNode[]');
 });

 it('does not alter runtime billing or provider routing',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.save');
  expect(workspace).not.toContain('creditWalletService');
 });
});
