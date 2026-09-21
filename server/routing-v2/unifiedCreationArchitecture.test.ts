import fs from'node:fs';
import path from'node:path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('unified creation architecture',()=>{
  const mediaViews=['UnifiedImageCreateView','CreateView','VoiceCreateView','MusicCreateView','ThreeDCreateView'];
  it.each(mediaViews)('%s loads only the READY V2 public catalog and uses universal generation infrastructure',(name)=>{
    const view=read(`src/components/views/${name}.tsx`);
    expect(view).toMatch(/workspaceService\.listModels\(|universalGenerationClient\.catalog\(/);
    expect(view).toMatch(/generationClient\.quote\(|universalGenerationClient\.quote\(|useBackendAutoQuote\(/);
    expect(view).toMatch(/generationClient\.create\(|universalGenerationClient\.create\(/);
    expect(view).not.toMatch(/(?:voice|music|threeD)GenerationClient/);
  });
  it('takes the Auto model and price from the backend quote, never from client-side ranking',()=>{
    const hook=read('src/components/workspace/useBackendAutoQuote.ts');
    expect(hook).toContain('generationClient.quote');
    expect(hook).toContain('quote?.resolved_model_id');
    for(const name of ['UnifiedImageCreateView','CreateView']){
      const view=read(`src/components/views/${name}.tsx`);
      expect(view).toContain('useBackendAutoQuote(');
      expect(view).not.toMatch(/\[\.\.\.(?:compatibleModels|autoCompatibleModels)\]\.sort\(/);
      expect(view).toContain('autoQuote.quote?.credit_price');
    }
  });
  it('uses a canonical generation contract without synthetic image duration',()=>{
    const client=read('src/services/generationClient.ts');
    const universal=read('src/services/universalGenerationClient.ts');
    const routes=read('server/routes/generationRoutes.ts');
    const image=read('src/components/views/UnifiedImageCreateView.tsx');
    expect(client).toContain('UniversalGenerationRequest');
    expect(universal).toContain('UniversalGenerationRequest');
    expect(client).not.toContain('duration_seconds: s.duration_seconds || 1');
    expect(image).not.toContain('duration_seconds: 1');
    expect(routes).toContain('resolveGenerationCapability');
    expect(routes).toContain('generationModeForCapability');
    expect(routes).not.toContain('capabilityId.toUpperCase().replace');
  });
  it('removes parallel media job routes from the active API',()=>{
    const routes=read('server/routes/index.ts');
    expect(routes).not.toMatch(/(?:voice|music|threeD)GenerationRouter/);
    const backend=read('server/routes/generationRoutes.ts');
    expect(backend).toContain('routingV2AutoModelSelectionService.select');
    expect(backend).toContain('routingV2ExecutionService.preview');
    expect(backend).toContain('character_count: prompt.length');
    expect(read('server/services/generationService.ts')).toContain('character_count:params.prompt?.length||0');
    const auto=read('server/routing-v2/autoModelSelectionService.ts');
    expect(auto).toContain('routingV2RouteService.listReady');
    expect(auto).toContain('routes.some((route) => route.model_id === model.model_id)');
    expect(auto).toContain('routingV2GenerationPricingService.preview');
  });
  it('uses one picker base and no operational model defaults',()=>{
    const picker=read('src/components/workspace/UniversalModelPicker.tsx');
    const image=read('src/components/workspace/UnifiedImageCreatorPanel.tsx');
    const video=read('src/components/workspace/CreatorPanel.tsx');
    const capabilities=read('src/services/modelCapabilities.ts');
    expect(picker).toContain('CompactModelPicker');
    expect(image).toContain('CompactModelPicker');
    expect(video).toContain('CompactModelPicker');
    expect(capabilities).not.toContain('KNOWN_MODEL_DEFAULTS');
    expect(video).not.toContain('[5, 10, 15, 30]');
    expect(video).not.toContain("['720p','1080p']");
    expect(image).not.toContain("['1:1','16:9','9:16','4:3','3:4']");
  });
});
