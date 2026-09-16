import { describe,expect,it } from 'vitest';
import { getCapabilityDefinition } from '../capabilityRegistry.js';

describe('PR-08 Audio V1 contracts',()=>{
  it('defines TTS output as audio and transcription as text plus structured data',()=>{
    expect(getCapabilityDefinition('text-to-speech')?.outputs).toEqual(['AUDIO']);
    expect(getCapabilityDefinition('transcription')?.outputs).toEqual(['TEXT','STRUCTURED_DATA']);
  });

  it('defines authorized voice clone as structured identity rather than exposing provider audio internals',()=>{
    expect(getCapabilityDefinition('authorized-voice-clone')?.outputs).toEqual(['STRUCTURED_DATA']);
    expect(getCapabilityDefinition('authorized-voice-clone')?.controls).toEqual(expect.arrayContaining(['voice_clone_consent','voice_label']));
  });

  it('keeps dubbing capable of audio or video output',()=>{
    expect(getCapabilityDefinition('dubbing')?.outputs).toEqual(['VIDEO','AUDIO']);
    expect(getCapabilityDefinition('dubbing')?.controls).toEqual(expect.arrayContaining(['source_language','target_language']));
  });
});
