import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Stable music generator promotion',()=>{
 it('exposes music as a first-class Stable create destination',()=>{
  const app=read('src/App.tsx');
  const sidebar=read('src/components/layout/Sidebar.tsx');
  const navbar=read('src/components/layout/Navbar.tsx');
  expect(app).toContain("currentSafeView==='create-music'");
  expect(app).toContain('MusicCreateView');
  expect(sidebar).toContain("id: 'create-music'");
  expect(navbar).toContain("navigate('create-music')");
  expect(navbar).toContain("'create-music': { title: 'Gerar música'");
 });

 it('uses Universal Jobs and server-authoritative pricing',()=>{
  const routes=read('server/routes/musicGenerationRoutes.ts');
  const view=read('src/components/views/MusicCreateView.tsx');
  expect(routes).toContain("const CAPABILITY='music'");
  expect(routes).toContain('betaJobOrchestrator.create');
  expect(routes).toContain('betaJobOrchestrator.quote');
  expect(routes).toContain('betaJobOrchestrator.queue');
  expect(view).toContain('job?.quote?.credit_price');
 });

 it('keeps provider eligibility governed internally without frontend secrets or hardcoded providers',()=>{
  const routes=read('server/routes/musicGenerationRoutes.ts');
  const view=read('src/components/views/MusicCreateView.tsx');
  const client=read('src/services/musicGenerationClient.ts');
  expect(view).toContain('StableGeneratorModelPicker');
  expect(view).not.toContain('preferred_provider_id');
  expect(view).not.toContain('AUTO · Mais econômico/saudável');
  expect(routes).toContain('routingV2CatalogService.listCapabilityModels');
  const catalog=read('server/routing-v2/catalogService.ts');
  expect(catalog).toContain('routingV2RouteService.listReady');
  expect(read('server/routing-v2/routeService.ts')).toContain("route.status!=='READY'");
  expect(view).not.toMatch(/wavespeed|runware|deepinfra|replicate|aiml|piapi|kie\.ai/i);
  expect(client).not.toMatch(/api[_-]?key|authorization|bearer/i);
 });

 it('keeps the existing audio and music kill switches authoritative',()=>{
  const routes=read('server/routes/musicGenerationRoutes.ts');
  expect(routes).toContain("getFeatureFlag('beta.audio')");
  expect(routes).toContain("getFeatureFlag('beta.audio.music')");
  expect(routes).toContain("code:'AUDIO_CAPABILITY_DISABLED'");
 });

 it('keeps the initial music scope text-to-music only',()=>{
  const routes=read('server/routes/musicGenerationRoutes.ts');
  const view=read('src/components/views/MusicCreateView.tsx');
  expect(routes).toContain('references:[]');
  expect(view).toContain('Descrição da música');
  expect(view).toContain('Instrumental');
  expect(view).toContain('Duração');
  expect(view).toContain('Formato');
  expect(view).not.toContain('Upload de áudio');
  expect(view).not.toContain('Remix');
 });

 it('uses the exact canonical create shell and controls',()=>{
  const controls=read('src/components/workspace/GeneratorControls.tsx');
  const view=read('src/components/views/MusicCreateView.tsx');
  const mobile=read('src/components/workspace/MobileStudioLayout.tsx');
  const picker=read('src/components/workspace/StableGeneratorModelPicker.tsx');
  expect(view).toContain('MobileStudioLayout');
  expect(view).toContain('PromptComposer');
  expect(view).toContain('GeneratorFooter');
  expect(view).toContain('GeneratorSettingRow');
  expect(view).toContain('GeneratorDiscreteSlider');
  expect(view).toContain('GeneratorOptionGrid');
  expect(view).toContain('GeneratorToggle');
  expect(view).not.toContain('<select');
  expect(view).not.toContain('ia-stable-generator-studio');
  expect(view).not.toContain('stable-generator-shell.css');
  expect(controls).toContain("md:w-[352px] xl:w-[368px]");
  expect(mobile).toContain('ia-generator-workspace');
  expect(picker).toContain('CompactModelPicker');
 });

 it('reuses the one universal Minhas criações gallery and adds Música as a filter',()=>{
  const view=read('src/components/views/MusicCreateView.tsx');
  const gallery=read('src/components/workspace/CreationGallery.tsx');
  expect(view).toContain('CreationGallery defaultFilter="MUSIC"');
  expect(view).not.toContain('ia-music-grid');
  expect(gallery).toContain("export type CreationGalleryFilter='VIDEO'|'IMAGE'|'VOICE'|'MUSIC'|'THREE_D'|'ALL'");
  expect(gallery).toContain("value==='MUSIC'?'Música'");
  expect(gallery).toContain("capability==='music'?'MUSIC':'VOICE'");
 });

 it('tags generated music assets without creating a second asset system',()=>{
  const routes=read('server/routes/musicGenerationRoutes.ts');
  expect(routes).toContain('assetRepository.getAsset');
  expect(routes).toContain('assetRepository.updateAsset');
  expect(routes).toContain('media_metadata');
  expect(routes).toContain('capability_id:CAPABILITY');
  expect(routes).not.toMatch(/music_assets|music_library|music_creations/);
 });
});
