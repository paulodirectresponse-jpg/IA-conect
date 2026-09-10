import fs from'node:fs';
import{describe,expect,it}from'vitest';
import{STUDIO_SEED_MODELS}from'../../src/config/studioCatalog.js';
import{getModelCapabilities}from'../../src/services/modelCapabilities.js';
import{planImageConfiguration,planVideoConfiguration}from'../../src/services/generationConfigurationPolicy.js';
import{WaveSpeedProviderAdapter}from'../adapters/wavespeedProviderAdapter.js';
import{AtlasProviderAdapter}from'../adapters/atlasProviderAdapter.js';
import{compileProviderReferencePrompt}from'../adapters/providerPromptReferences.js';
import{Asset,WorkspaceReference}from'../../src/types/index.js';

const model=(id:string)=>{const row=STUDIO_SEED_MODELS.find(item=>item.model_id===id);if(!row)throw new Error(id);return row};
const image:Asset={asset_id:'ast_img',owner_user_id:'u',type:'IMAGE',category:'GENERIC',name:'Pessoa',alias:'img1',storage_path:'x',public_url:'https://example.test/person.png',mime_type:'image/png',size_bytes:1,status:'READY',created_at:'2026-09-10T00:00:00Z',updated_at:'2026-09-10T00:00:00Z'};
const audio:Asset={...image,asset_id:'ast_audio',type:'AUDIO',name:'Voz',alias:'audio1',public_url:'https://example.test/voice.wav',mime_type:'audio/wav'};
const ref=(asset:Asset,role='GENERAL'):WorkspaceReference=>({asset_id:asset.asset_id,alias_snapshot:asset.alias,asset,role,priority:'HIGH',preservation_rules:[],flexible_rules:[]});

describe('adaptive video configuration',()=>{
 it('adapts 720p to MiniMax H3 without hiding the model',()=>{
  const plan=planVideoConfiguration(model('minimax-h3'),{resolution:'720p',durationSeconds:5,aspectRatio:'16:9',initialImage:null,endImage:null,references:[],audioEnabled:true,seed:'',motionStrength:5});
  expect(plan.valid).toBe(true);
  expect(plan.resolution).toBe('768p');
  expect(plan.durationSeconds).toBe(5);
  expect(plan.changes.some(change=>change.field==='resolution')).toBe(true);
 });

 it('adapts Kling technical settings instead of marking Kling unavailable',()=>{
  const plan=planVideoConfiguration(model('kling-3-0'),{resolution:'720p',durationSeconds:2,aspectRatio:'16:9',initialImage:null,endImage:null,references:[],audioEnabled:false,seed:123,motionStrength:8});
  expect(plan.valid).toBe(true);
  expect(plan.resolution).toBe('Standard');
  expect(plan.durationSeconds).toBe(3);
  expect(plan.audioEnabled).toBe(false);
  expect(plan.seed).toBe('');
 });

 it('promotes an image reference to initial frame when the selected model has no reference mode',()=>{
  const plan=planVideoConfiguration(model('kling-3-0'),{resolution:'720p',durationSeconds:5,aspectRatio:'16:9',initialImage:null,endImage:null,references:[ref(image)],audioEnabled:true,seed:'',motionStrength:5});
  expect(plan.valid).toBe(true);
  expect(plan.mode).toBe('IMAGE_TO_VIDEO');
  expect(plan.initialImage?.asset_id).toBe(image.asset_id);
  expect(plan.references).toHaveLength(0);
 });

 it('rejects audio-only reference mode before provider submission',()=>{
  const plan=planVideoConfiguration(model('minimax-h3'),{resolution:'768p',durationSeconds:5,aspectRatio:'16:9',initialImage:null,endImage:null,references:[ref(audio)],audioEnabled:true,seed:'',motionStrength:5});
  expect(plan.valid).toBe(false);
  expect(plan.blockedReason).toContain('imagem ou vídeo');
 });
});

describe('multimodal capability truth',()=>{
 it('models always-on and optional native audio separately',()=>{
  expect(getModelCapabilities(model('minimax-h3')).audio_generation_mode).toBe('ALWAYS');
  expect(getModelCapabilities(model('google-omni-flash')).audio_generation_mode).toBe('ALWAYS');
  expect(getModelCapabilities(model('kling-3-0')).audio_generation_mode).toBe('OPTIONAL');
  expect(getModelCapabilities(model('wan-3-0')).audio_generation_mode).toBe('OPTIONAL');
 });

 it('exposes the provider-union MiniMax H3 envelope',()=>{
  const caps=getModelCapabilities(model('minimax-h3'));
  expect(caps.supported_resolutions).toEqual(expect.arrayContaining(['480p','540p','768p','1080p','2K']));
  expect(caps.supported_durations).toContain(3);
  expect(caps.supported_durations).toContain(15);
  expect(caps.supports_start_end_image).toBe(true);
  expect(caps.supports_video_reference).toBe(true);
  expect(caps.supports_audio_reference).toBe(true);
 });

 it('keeps provider-specific routing capability distinct from model capability',()=>{
  const wave=new WaveSpeedProviderAdapter(),atlas=new AtlasProviderAdapter();
  expect(wave.supports('minimax-h3','REFERENCE_TO_VIDEO')).toBe(true);
  expect(atlas.supports('minimax-h3','REFERENCE_TO_VIDEO')).toBe(true);
  expect(wave.supports('seedance-2-5','REFERENCE_TO_VIDEO')).toBe(false);
  expect(atlas.supports('seedance-2-5','REFERENCE_TO_VIDEO')).toBe(true);
  expect(wave.supports('kling-3-0','REFERENCE_TO_VIDEO')).toBe(false);
 });
});

describe('adaptive image configuration',()=>{
 it('moves Seedream from unsupported 4K to its closest supported resolution',()=>{
  const plan=planImageConfiguration(model('seedream-5-pro-image'),{resolution:'4K',aspectRatio:'1:1',references:[],seed:''});
  expect(plan.valid).toBe(true);
  expect(plan.resolution).toBe('2K');
 });
});

describe('semantic reference intent',()=>{
 it('turns a character slot into provider guidance even without an @ mention',()=>{
  const prompt=compileProviderReferencePrompt({
   generation_id:'g',user_id:'u',model_id:'gpt-image-2',mode:'IMAGE_TO_IMAGE',prompt:'Create a studio portrait.',duration_seconds:1,resolution:'1K',aspect_ratio:'1:1',number_of_outputs:1,references:[{asset_id:'a',alias:'img1',name:'Pessoa',type:'IMAGE',category:'CHARACTER',provider_accessible_url:'https://example.test/a.png',storage_path:'x',mime_type:'image/png',slot_type:'GENERAL',prompt_alias:'img1',semantic_role:'CHARACTER'}],
  } as any,'wavespeed');
  expect(prompt).toContain('Keep the person/character identity');
  expect(prompt).toContain('Create a studio portrait.');
 });
});

describe('studio architecture guardrails',()=>{
 it('keeps one output until adapters explicitly support more',()=>{
  const video=fs.readFileSync('src/components/workspace/CreatorPanel.tsx','utf8');
  const imagePanel=fs.readFileSync('src/components/workspace/UnifiedImageCreatorPanel.tsx','utf8');
  const route=fs.readFileSync('server/routes/generationRoutes.ts','utf8');
  const service=fs.readFileSync('server/services/generationService.ts','utf8');
  expect(video).not.toContain('Quantidade');
  expect(video).not.toContain('Variações');
  expect(imagePanel).not.toContain('Quantidade');
  expect(route).toContain("outputs !== 1");
  expect(service).toContain("params.number_of_outputs!==1");
 });

 it('keeps semantic quick slots and direct slot drops in image studio',()=>{
  const source=fs.readFileSync('src/components/workspace/UnifiedImageCreatorPanel.tsx','utf8');
  expect(source).toContain("label:'Pessoa'");
  expect(source).toContain("label:'Produto'");
  expect(source).toContain("label:'Estilo'");
  expect(source).toContain("label:'Referência'");
  expect(source).toContain('p.onQuickUpload(files,item.role)');
 });

 it('removes superseded generation UI layers',()=>{
  for(const file of['AdvancedSettings.tsx','CompactReferencesSection.tsx','ModelSelector.tsx','ModelShowcase.tsx','ReferenceAutocomplete.tsx','ReferenceSlots.tsx','ResultsCanvas.tsx','WorkspaceReferencesList.tsx','GenerationRequestPreviewModal.tsx']){
   expect(fs.existsSync('src/components/workspace/'+file),file).toBe(false);
  }
 });

 it('validates capabilities before reserving credits',()=>{
  const source=fs.readFileSync('server/services/generationService.ts','utf8');
  expect(source.indexOf('assertGenerationCapability')).toBeLessThan(source.indexOf('reserveForGeneration'));
 });

 it('has no manual native-audio model allowlist in pricing',()=>{
  const source=fs.readFileSync('server/services/creditPricingService.ts','utf8');
  expect(source).not.toContain('DEFAULT_AUDIO_MODELS');
  expect(source).toContain('audio_generation_mode');
 });
});
