import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Stable voice generator promotion',()=>{
 it('exposes voice as a first-class Stable create destination',()=>{
  const app=read('src/App.tsx');
  const sidebar=read('src/components/layout/Sidebar.tsx');
  const navbar=read('src/components/layout/Navbar.tsx');
  expect(app).toContain("currentSafeView==='create-voice'");
  expect(app).toContain('VoiceCreateView');
  expect(sidebar).toContain("id: 'create-voice'");
  expect(navbar).toContain("navigate('create-voice')");
  expect(navbar).toContain("'create-voice': { title: 'Gerar voz'");
 });

 it('uses the same full-height create shell as image and video',()=>{
  const layout=read('src/components/layout/AppLayout.tsx');
  expect(layout).toContain("currentView === 'create-voice'");
  expect(layout).toContain('ia-shell-main-create');
 });

 it('keeps the first Stable audio scope restricted to text to speech',()=>{
  const routes=read('server/routes/voiceGenerationRoutes.ts');
  expect(routes).toContain("const CAPABILITY='text-to-speech'");
  expect(routes).toContain('capability_id:CAPABILITY');
  expect(routes).toContain('references:[]');
  expect(routes).not.toMatch(/sound-effects|transcription|subtitles|authorized-voice-clone|dubbing/);
 });

 it('exposes governed provider choice without leaking secrets or hardcoded provider routing',()=>{
  const view=read('src/components/views/VoiceCreateView.tsx');
  const client=read('src/services/voiceGenerationClient.ts');
  const routes=read('server/routes/voiceGenerationRoutes.ts');
  expect(view).toContain('Provider');
  expect(view).toContain('AUTO · Mais econômico/saudável');
  expect(view).toContain('Calcular créditos');
  expect(view).toContain('job?.quote?.credit_price');
  expect(client).toContain('/api/voice/catalog');
  expect(routes).toContain('providerChoices');
  expect(routes).toContain("provider.status!=='ACTIVE'");
  expect(routes).toContain('configured.get');
  expect(routes).toContain('verifiedPriceKeys');
  expect(view).not.toMatch(/wavespeed|runware|deepinfra|replicate|aiml|piapi|kie\.ai/i);
  expect(client).not.toMatch(/api[_-]?key|authorization|bearer/i);
 });

 it('reuses central jobs assets wallet and the universal Minhas criações',()=>{
  const routes=read('server/routes/voiceGenerationRoutes.ts');
  const view=read('src/components/views/VoiceCreateView.tsx');
  const gallery=read('src/components/workspace/CreationGallery.tsx');
  expect(routes).toContain('betaJobOrchestrator.create');
  expect(routes).toContain('betaJobOrchestrator.quote');
  expect(routes).toContain('betaJobOrchestrator.queue');
  expect(view).toContain("import{CreationGallery}from'../workspace/CreationGallery.js'");
  expect(view).toContain('<CreationGallery defaultFilter="VOICE"');
  expect(view).not.toContain('ia-voice-gallery-head');
  expect(view).not.toContain('setCreations');
  expect(view).toContain('refreshWallet');
  expect(gallery).toContain("export type CreationGalleryFilter='VIDEO'|'IMAGE'|'VOICE'|'MUSIC'|'ALL'");
  expect(gallery).toContain("value==='VOICE'?'Voz'");
  expect(gallery).toContain("asset.type==='AUDIO'");
 });

 it('refreshes the shared creation history when a voice asset completes',()=>{
  const view=read('src/components/views/VoiceCreateView.tsx');
  const gallery=read('src/components/workspace/CreationGallery.tsx');
  expect(view).toContain("new CustomEvent('creations:updated'");
  expect(gallery).toContain("window.addEventListener('creations:updated'");
  expect(gallery).toContain('assetService.listAssets()');
 });

 it('contains only the requested voice controls plus governed model and provider routing',()=>{
  const view=read('src/components/views/VoiceCreateView.tsx');
  for(const label of ['Texto','Voz','Idioma','Formato','IA / modelo','Provider'])expect(view).toContain(label);
  expect(view).not.toContain('Clonar voz');
  expect(view).not.toContain('Transcrever');
  expect(view).not.toContain('Dublar');
  expect(view).not.toContain('Efeitos');
 });

 it('keeps the voice workspace responsive',()=>{
  const css=read('src/styles/voice-create.css');
  expect(css).toContain('@media(max-width:1023px)');
  expect(css).toContain('@media(max-width:640px)');
 });
});
