import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Stable Spaces canvas',()=>{
 it('exposes Spaces as a Stable full-height destination',()=>{
  const app=read('src/App.tsx'),sidebar=read('src/components/layout/Sidebar.tsx'),layout=read('src/components/layout/AppLayout.tsx');
  expect(app).toContain("currentSafeView==='spaces'");
  expect(sidebar).toContain("id:'spaces'");
  expect(sidebar).toContain("label:'Spaces'");
  expect(layout).toContain("currentView === 'spaces'");
 });
 it('provides the requested visual canvas interactions',()=>{
  const view=read('src/components/views/SpacesView.tsx');
  expect(view).toContain('onContextMenu={onCanvasContext}');
  expect(view).toContain('onWheel={onWheel}');
  expect(view).toContain('dragRef');
  expect(view).toContain('panRef');
  expect(view).toContain('pathFor');
  expect(view).toContain('Buscar ferramenta');
  expect(view).toContain('Inspector');
  expect(view).toContain('minimap');
 });
 it('uses existing flow runtime, universal assets and capability catalog',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('betaFlowService');
  expect(routes).toContain('betaFlowEconomicRuntimeService');
  expect(routes).toContain('assetRepository.listUserAssets');
  expect(routes).toContain('publicCapabilityCatalog');
  expect(routes).toContain('betaCatalogPolicyService');
 });
 it('does not depend on beta.enabled for Stable Spaces access',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain("getFeatureFlag('beta.flows')");
  expect(routes).not.toContain("getFeatureFlag('beta.enabled')");
 });
 it('keeps provider and economics decisions server-side',()=>{
  const client=read('src/services/spacesClient.ts'),routes=read('server/routes/spacesRoutes.ts');
  expect(client).not.toMatch(/api[_-]?key|bearer/i);
  expect(routes).toContain('betaFlowEconomicRuntimeService.quote');
  expect(routes).toContain('betaFlowEconomicRuntimeService.start');
 });
 it('does not create parallel jobs, assets, credits or libraries',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).not.toMatch(/spaces_jobs|spaces_assets|spaces_credits|spaces_library/);
 });
});
