import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Stable Spaces visual workspace',()=>{
 it('exposes Spaces as a Stable full-height destination',()=>{
  const app=read('src/App.tsx'),sidebar=read('src/components/layout/Sidebar.tsx'),layout=read('src/components/layout/AppLayout.tsx');
  expect(app).toContain("currentSafeView==='spaces'");
  expect(sidebar).toContain("id: 'spaces'");
  expect(sidebar).toContain("label: 'Spaces'");
  expect(sidebar).toContain('Fluxos');
  expect(layout).toContain("currentView === 'spaces'");
 });
 it('opens on a focused home before entering the canvas',()=>{
  const view=read('src/components/views/SpacesView.tsx'),home=read('src/components/spaces/SpacesHome.tsx');
  expect(view).toContain('SpacesHome');
  expect(view).toContain('SpaceWorkspace');
  expect(home).toContain('Novo Space');
  expect(home).toContain('Seus Spaces');
  expect(home).not.toContain('Templates');
  expect(home).not.toContain('Compartilhado');
  expect(home).toContain('Excluir Space');
  expect(view).toContain('spacesClient.remove');
  expect(view).toContain('window.confirm');
 });
 it('provides the requested visual canvas interactions',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('onWheel={onWheel}');
  expect(workspace).toContain('dragRef');
  expect(workspace).toContain('panRef');
  expect(workspace).toContain('pathFor');
  expect(workspace).toContain("window.addEventListener('paste'");
  expect(workspace).toContain('onDrop={onDrop}');
  expect(workspace).toContain('O que deseja fazer com esta saída?');
  expect(workspace).toContain('Arraste para conectar');
 });
 it('keeps the V1 focused on image/video generation and editing',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  for(const capability of ['text-to-image','image-to-image','image-edit','text-to-video','image-to-video','video-edit','video-extend'])expect(workspace).toContain(capability);
  for(const future of ['text-to-speech','music','text-to-3d','webhook','if/else','loop'])expect(workspace).not.toContain(future);
 });
 it('uses existing flow runtime, universal assets and capability catalog',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('betaFlowService');
  expect(routes).toContain('betaFlowEconomicRuntimeService');
  expect(routes).toContain('assetRepository.listUserAssets');
  expect(routes).toContain('publicCapabilityCatalog');
  expect(routes).toContain('betaCatalogPolicyService');
 });
 it('publishes only capabilities already promoted to Stable',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  for(const capability of ['text-to-image','image-edit','text-to-video','video-extend','video-edit','text-to-speech','music','text-to-3d','image-to-3d','multi-image-to-3d'])expect(routes).toContain(`'${capability}'`);
  for(const futureCapability of ['sound-effects','transcription','subtitles','authorized-voice-clone','dubbing','texture-3d'])expect(routes).not.toContain(`'${futureCapability}'`);
 });
 it('only exposes provider-ready and priced model capabilities while tolerating degraded metadata reads',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('providerCatalogService.listProviders');
  expect(routes).toContain('providerPricingCatalogService.list');
  expect(routes).toContain('providerRegistry.listAdapters');
  expect(routes).toContain('configured.get');
  expect(routes).toContain('verifiedPriceKeys');
  expect(routes).toContain('Promise.allSettled');
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
