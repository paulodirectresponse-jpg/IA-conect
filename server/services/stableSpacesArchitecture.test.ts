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
  expect(view).toContain('bottom-5 right-5 z-20 h-28 w-44');
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
 it('only exposes provider-ready and priced model capabilities',()=>{
  const routes=read('server/routes/spacesRoutes.ts');
  expect(routes).toContain('providerCatalogService.listProviders');
  expect(routes).toContain('providerPricingCatalogService.list');
  expect(routes).toContain('providerRegistry.listAdapters');
  expect(routes).toContain('configured.get');
  expect(routes).toContain('verifiedPriceKeys');
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
