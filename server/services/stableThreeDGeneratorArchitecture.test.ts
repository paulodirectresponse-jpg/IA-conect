import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Stable 3D generator foundation',()=>{
 it('exposes 3D as a first-class Stable create destination',()=>{
  const app=read('src/App.tsx'),sidebar=read('src/components/layout/Sidebar.tsx'),navbar=read('src/components/layout/Navbar.tsx');
  expect(app).toContain("currentSafeView==='create-3d'");expect(app).toContain('ThreeDCreateView');
  expect(sidebar).toContain("id: 'create-3d'");expect(navbar).toContain("navigate('create-3d')");expect(navbar).toContain("'create-3d': { title: 'Gerar 3D'");
 });
 it('supports text, image and multi-image 3D without a second job system',()=>{
  const routes=read('server/routes/threeDGenerationRoutes.ts'),view=read('src/components/views/ThreeDCreateView.tsx');
  for(const capability of ['text-to-3d','image-to-3d','multi-image-to-3d']){expect(routes).toContain(capability);expect(view).toContain(capability);}
  expect(routes).toContain('betaJobOrchestrator.create');expect(routes).toContain('betaJobOrchestrator.quote');expect(routes).toContain('betaJobOrchestrator.queue');
  expect(routes).not.toMatch(/three_d_jobs|3d_jobs_collection|model3d_jobs/);
 });
 it('keeps pricing and provider eligibility server authoritative and hidden from the generator UI',()=>{
  const routes=read('server/routes/threeDGenerationRoutes.ts'),view=read('src/components/views/ThreeDCreateView.tsx'),client=read('src/services/threeDGenerationClient.ts');
  expect(routes).toContain('routingV2CatalogService.listCapabilityModels');const catalog=read('server/routing-v2/catalogService.ts');expect(catalog).toContain('routingV2RouteService.listReady');expect(read('server/routing-v2/routeService.ts')).toContain("route.status!=='READY'");
  expect(view).toContain('job?.quote?.credit_price');expect(view).toContain('StableGeneratorModelPicker');
  expect(view).not.toContain('preferred_provider_id');expect(view).not.toContain('AUTO · Mais econômico/saudável');
  expect(client).not.toMatch(/api[_-]?key|authorization|bearer/i);expect(view).not.toMatch(/wavespeed|runware|deepinfra|replicate|aiml|piapi|kie\.ai/i);
 });
 it('preserves the 3D kill switch and existing Universal Assets ownership',()=>{
  const routes=read('server/routes/threeDGenerationRoutes.ts');
  expect(routes).toContain("getFeatureFlag('beta.three_d')");expect(routes).toContain('assetRepository.getAsset');expect(routes).toContain("asset.type!=='MODEL_3D'");
  expect(routes).toContain("listUserAssets(req.user!.uid,{type:'MODEL_3D',includeUniversal:true})");expect(routes).not.toMatch(/three_d_assets|3d_library|model3d_library/);
 });
 it('uses the exact canonical create shell and controls',()=>{
  const controls=read('src/components/workspace/GeneratorControls.tsx'),mobile=read('src/components/workspace/MobileStudioLayout.tsx'),picker=read('src/components/workspace/StableGeneratorModelPicker.tsx'),view=read('src/components/views/ThreeDCreateView.tsx');
  expect(view).toContain('MobileStudioLayout');expect(view).toContain('PromptComposer');expect(view).toContain('GeneratorFooter');
  expect(view).toContain('GeneratorSettingRow');expect(view).toContain('GeneratorOptionGrid');expect(view).toContain('GeneratorRangeSlider');expect(view).toContain('GeneratorToggle');
  expect(view).not.toContain('<select');expect(view).not.toContain('ia-stable-generator-studio');expect(view).not.toContain('stable-generator-shell.css');
  expect(controls).toContain("md:w-[352px] xl:w-[368px]");expect(mobile).toContain('ia-generator-workspace');expect(picker).toContain('CompactModelPicker');
 });
 it('uses the same universal Minhas criações with a 3D filter and preview',()=>{
  const gallery=read('src/components/workspace/CreationGallery.tsx'),view=read('src/components/views/ThreeDCreateView.tsx'),preview=read('src/components/workspace/StableModel3DPreview.tsx');
  expect(gallery).toContain("'THREE_D'");expect(gallery).toContain('threeDGenerationClient.listAssets');expect(gallery).toContain('StableModel3DPreview');
  expect(view).toContain('defaultFilter="THREE_D"');expect(view).toContain('CreationGallery');expect(preview).toContain('parseGlb');
  expect(view).not.toMatch(/ThreeDGallery|Model3DLibrary|three-d-creations-list/);
 });
});
