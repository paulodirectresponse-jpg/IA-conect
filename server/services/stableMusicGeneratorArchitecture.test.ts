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

 it('exposes governed provider choice without frontend secrets or hardcoded providers',()=>{
  const routes=read('server/routes/musicGenerationRoutes.ts');
  const view=read('src/components/views/MusicCreateView.tsx');
  const client=read('src/services/musicGenerationClient.ts');
  expect(view).toContain('IA / modelo');
  expect(view).toContain('Provider');
  expect(view).toContain('AUTO · Mais econômico/saudável');
  expect(routes).toContain('providerChoices');
  expect(routes).toContain("provider.status!=='ACTIVE'");
  expect(routes).toContain('configured.get');
  expect(routes).toContain('verifiedPriceKeys');
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

 it('reuses the one universal Minhas criações gallery and adds Música as a filter',()=>{
  const view=read('src/components/views/MusicCreateView.tsx');
  const gallery=read('src/components/workspace/CreationGallery.tsx');
  expect(view).toContain('CreationGallery defaultFilter="MUSIC"');
  expect(view).not.toContain('ia-music-grid');
  expect(gallery).toContain("'VOICE'|'MUSIC'|'ALL'");
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

 it('keeps the music workspace responsive and in the shared create shell',()=>{
  const css=read('src/styles/music-create.css');
  const layout=read('src/components/layout/AppLayout.tsx');
  expect(css).toContain('@media(max-width:1023px)');
  expect(css).toContain('@media(max-width:640px)');
  expect(layout).toContain("currentView === 'create-music'");
  expect(layout).toContain('ia-shell-main-create');
 });
});
