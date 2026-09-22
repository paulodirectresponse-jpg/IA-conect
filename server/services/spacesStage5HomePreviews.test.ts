import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces stage 5 real Home previews',()=>{
 it('loads a dedicated Home summary instead of deriving covers client-side',()=>{
  const client=read('src/services/spacesClient.ts');
  const view=read('src/components/views/SpacesView.tsx');
  expect(client).toContain("home:()=>apiRequest<SpaceHomeItem[]>('/api/spaces/home')");
  expect(view).toContain('spacesClient.home()');
  expect(view).toContain('homeItems');
 });

 it('builds previews from persisted visual outputs already owned by the user',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain("spacesRouter.get('/spaces/home'");
  expect(routes).toContain('betaFlowRuntimeRepository.listUserNodeRuns');
  expect(routes).toContain("asset.type==='IMAGE'||asset.type==='VIDEO'");
  expect(routes).toContain("nodeRun.status!=='SUCCEEDED'");
  expect(routes).toContain('nodeRun.output_asset_ids');
  expect(routes).toContain('preview_nodes');
 });

 it('does not issue one backend request per Space card',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('Promise.all([');
  expect(routes).toContain('listUserNodeRuns(userId,500)');
  expect(routes).toContain('assetRepository.listUserAssets(userId,{includeUniversal:true})');
  expect(routes).not.toMatch(/for\s*\([^)]*flow[^)]*\)[\s\S]{0,300}getAsset\(/);
 });

 it('renders real visual media inside the graph nodes on the Home card',()=>{
  const home=read('src/components/spaces/SpacesHome.tsx');
  expect(home).toContain('NodeMedia');
  expect(home).toContain('item?.preview_nodes');
  expect(home).toContain("asset.type==='VIDEO'");
  expect(home).toContain('object-contain');
  expect(home).toContain('loading="lazy"');
 });

 it('keeps the graph visible even when nodes do not have visual outputs',()=>{
  const home=read('src/components/spaces/SpacesHome.tsx');
  expect(home).toContain('RealWorkspacePreview');
  expect(home).toContain('node.label');
  expect(home).toContain('Space vazio');
 });

 it('keeps at most three recent visual assets in the Home payload',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('if(bucket.length<3)');
  expect(routes).toContain('if(bucket.length>=3)break');
  expect(routes).toContain('recent_assets:recent');
 });

 it('persists only universal asset ids for preview state, never duplicate media URLs',()=>{
  const flowTypes=read('server/beta/flows/flowTypes.ts');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(flowTypes).not.toContain('cover_asset');
  expect(flowTypes).not.toContain('preview_url');
  expect(workspace).toContain('space_preview_assets:previewAssetIds');
 });
});