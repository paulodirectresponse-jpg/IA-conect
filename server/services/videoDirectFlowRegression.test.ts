import fs from'node:fs';
import{describe,expect,it}from'vitest';
import{canonicalReferenceSlot,pricingReferenceCacheKey,pricingReferenceMode}from'../../src/utils/generationReferenceMode.js';
import{pricingSignatureService}from'./pricingSignatureService.js';

const read=(file:string)=>fs.readFileSync(file,'utf8');

describe('video quote identity regression',()=>{
 it('treats workspace START_FRAME and API INITIAL as the same pricing reference',()=>{
  const workspace=[{asset_id:'ast_1',role:'START_FRAME'}];
  const api=[{asset_id:'ast_1',slot_type:'INITIAL'}];
  expect(canonicalReferenceSlot(workspace[0])).toBe('INITIAL');
  expect(pricingReferenceMode(workspace)).toBe('initial');
  expect(pricingReferenceMode(api)).toBe('initial');
  expect(pricingReferenceCacheKey(workspace)).toBe(pricingReferenceCacheKey(api));

  const base={model_id:'minimax-h3',mode:'IMAGE_TO_VIDEO' as const,resolution:'480p',duration_seconds:5,aspect_ratio:'16:9',number_of_outputs:1,audio_enabled:false,reference_count:1,model_variant:'default'};
  const quote=pricingSignatureService.create({...base,reference_mode:pricingReferenceMode(workspace)});
  const create=pricingSignatureService.create({...base,reference_mode:pricingReferenceMode(api)});
  expect(quote.hash).toBe(create.hash);
  expect(quote.normalized).toBe(create.normalized);
 });

 it('distinguishes start-only and start-end configurations explicitly',()=>{
  expect(pricingReferenceMode([{role:'START_FRAME'}])).toBe('initial');
  expect(pricingReferenceMode([{role:'START_FRAME'},{role:'END_FRAME'}])).toBe('initial_end');
 });
});

describe('direct video generation UX',()=>{
 it('does not use the confirmation modal anymore',()=>{
  const source=read('src/components/views/CreateView.tsx');
  expect(source).not.toContain('GenerationRequestPreviewModal');
  expect(source).not.toContain('isPreviewModalOpen');
  expect(source).toContain('const handleGenerate=async');
  expect(source).toContain('generationClient.quote');
  expect(source).toContain('generationClient.create');
  expect(source).toContain("e?.code!=='PRICE_CHANGED_REQUOTE_REQUIRED'");
  expect(source).toContain('liveGeneration={generation}');
 });

 it('keeps runtime errors retryable instead of turning them into blocking validation',()=>{
  const view=read('src/components/views/CreateView.tsx');
  const panel=read('src/components/workspace/CreatorPanel.tsx');
  expect(view).toContain("setGenerationError('')");
  expect(view).toContain('compatibility.errors.length');
  expect(panel).toContain('generationError?: string');
  expect(panel).toContain('!p.generating');
 });
});

describe('single-layer prompt mentions',()=>{
 it('renders mentions inside one contentEditable editor',()=>{
  const source=read('src/components/workspace/PromptComposer.tsx');
  expect(source).toContain('contentEditable');
  expect(source).toContain("span.dataset.mention='true'");
  expect(source).toContain('text-cyan-200');
  expect(source).not.toContain('highlightRef');
  expect(source).not.toContain('highlightedPrompt');
  expect(source).not.toContain('textareaRef');
 });

 it('does not render redundant mention chips below the prompt',()=>{
  const source=read('src/components/workspace/PromptComposer.tsx');
  expect(source).not.toContain('activeRefs');
  expect(source).not.toContain('em uso');
  expect(source).not.toContain('promptReferences.length>0&&<div');
 });
});
