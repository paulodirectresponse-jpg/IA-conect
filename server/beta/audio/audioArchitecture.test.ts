import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';
import { STUDIO_SEED_MODELS } from '../../../src/config/studioCatalog.js';
import { publicCapabilityCatalog } from '../capabilityRegistry.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-08 Audio V1 architecture',()=>{
  it('declares all Audio V1 capabilities through logical models',()=>{
    const audio=publicCapabilityCatalog(STUDIO_SEED_MODELS.filter(model=>model.category==='AUDIO'));
    const ids=audio.flatMap(model=>model.capabilities.map(capability=>capability.id));
    expect(ids).toEqual(expect.arrayContaining(['text-to-speech','sound-effects','music','transcription','subtitles','authorized-voice-clone','dubbing']));
    expect(JSON.stringify(audio)).not.toContain('provider-wavespeed');
    expect(JSON.stringify(audio)).not.toContain('minimax/speech');
  });

  it('keeps provider endpoint identifiers in server catalog mappings only',()=>{
    const mappings=read('server/repositories/catalogRepository.ts');
    const ui=read('src/beta/views/BetaAudioView.tsx');
    expect(mappings).toContain("mapping('map-audio-tts-wave','audio-tts-v1','provider-wavespeed','minimax/speech-2.6-turbo')");
    expect(mappings).toContain("mapping('map-audio-dubbing-wave','audio-dubbing-v1','provider-wavespeed','elevenlabs/dubbing')");
    expect(ui).not.toMatch(/wavespeed|minimax\/speech|elevenlabs|sonilo/i);
    expect(ui).not.toContain('provider_id');
  });

  it('routes audio through universal Jobs and the existing generation credit authority',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const generation=read('server/services/generationService.ts');
    expect(jobs).toContain('generationService.createAndStartGeneration');
    expect(jobs).toContain("capabilityId==='text-to-speech'");
    expect(generation).toContain('creditWalletService.reserveForGeneration');
    expect(generation).toContain('creditWalletService.captureForGeneration');
    expect(generation).toContain('capability_id:params.capability_id');
  });

  it('archives generated audio into Universal Assets',()=>{
    const generation=read('server/services/generationService.ts');
    expect(generation).toContain("mediaType==='AUDIO'?'audio/mpeg'");
    expect(generation).toContain("'generated_audio'");
    expect(generation).toContain('generatedAssetStorageService.archive');
  });

  it('requires explicit consent for authorized voice cloning',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain("request.controls.voice_clone_consent!==true");
    expect(jobs).toContain('VOICE_CLONE_CONSENT_REQUIRED');
    const ui=read('src/beta/views/BetaAudioView.tsx');
    expect(ui).toContain('possuo autorização explícita');
  });

  it('never returns private provider voice identifiers from the voice registry',()=>{
    const service=read('server/beta/audio/audioVoiceService.ts');
    expect(service).toContain('provider_voice_id');
    expect(service).toContain('function publicVoice');
    const publicBlock=service.slice(service.indexOf('function publicVoice'),service.indexOf('export const audioVoiceService'));
    expect(publicBlock).not.toContain('provider_voice_id');
    const route=read('server/routes/betaAudioRoutes.ts');
    expect(route).toContain('audioVoiceService.list(req.user!.uid)');
  });

  it('lazy-loads Audio V1 and preserves the Stable app boundary',()=>{
    const beta=read('src/beta/BetaApp.tsx');
    const app=read('src/App.tsx');
    expect(beta).toContain("lazy(()=>import('./views/BetaAudioView.js')");
    expect(app).not.toContain('BetaAudioView');
  });

  it('contains explicit mobile responsiveness for the audio workspace',()=>{
    const css=read('src/beta/styles/beta.css');
    expect(css).toContain('.ia-beta-audio-layout');
    expect(css).toContain('@media(max-width:767px)');
    expect(css).toContain('.ia-beta-audio-runbar');
  });
});
