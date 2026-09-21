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

 it('builds covers from persisted visual outputs already owned by the user',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain("spacesRouter.get('/spaces/home'");
  expect(routes).toContain('betaFlowRuntimeRepository.listUserNodeRuns');
  expect(routes).toContain("asset.type==='IMAGE'||asset.type==='VIDEO'");
  expect(routes).toContain("nodeRun.status!=='SUCCEEDED'");
  expect(routes).toContain('nodeRun.output_asset_ids');
  expect(routes).toContain('cover_asset:byFlow.get(flow.flow_id)?.[0]||null');
 });

 it('does not issue one backend request per Space card',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('Promise.all([');
  expect(routes).toContain('listUserNodeRuns(userId,500)');
  expect(routes).toContain('assetRepository.listUserAssets(userId,{includeUniversal:true})');
  expect(routes).not.toMatch(/for\s*\([^)]*flow[^)]*\)[\s\S]{0,300}getAsset\(/);
 });

 it('uses the latest real creation as the primary card cover',()=>{
  const home=read('src/components/spaces/SpacesHome.tsx');
  expect(home).toContain('MediaCover');
  expect(home).toContain('item?.cover_asset');
  expect(home).toContain("cover.type==='VIDEO'?'Vídeo recente':'Criação recente'");
  expect(home).toContain('object-cover');
  expect(home).toContain('loading="lazy"');
 });

 it('keeps graph preview only as fallback when no visual creation exists',()=>{
  const home=read('src/components/spaces/SpacesHome.tsx');
  expect(home).toContain('GraphFallback');
  expect(home).toContain('if(!cover)return <GraphFallback flow={flow}/>');
  expect(home).toContain('Space vazio');
 });

 it('keeps at most three recent visual assets in the Home payload',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('if(bucket.length>=3)continue');
  expect(routes).toContain('if(bucket.length>=3)break');
  expect(routes).toContain('recent_assets:byFlow.get(flow.flow_id)||[]');
 });

 it('does not persist cover URLs or duplicate media state into the flow graph',()=>{
  const flowTypes=read('server/beta/flows/flowTypes.ts');
  const routes=read('server/routes/spacesRoutes.ts');
  expect(flowTypes).not.toContain('cover_asset');
  expect(flowTypes).not.toContain('preview_url');
  expect(routes).not.toMatch(/beta_flows[^\n]*cover/);
 });
});