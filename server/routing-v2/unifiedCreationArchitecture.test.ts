import fs from'node:fs';
import path from'node:path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('unified creation architecture',()=>{
  const mediaViews=['UnifiedImageCreateView','CreateView','VoiceCreateView','MusicCreateView','ThreeDCreateView'];
  it.each(mediaViews)('%s loads only the READY V2 public catalog and uses universal generation infrastructure',(name)=>{
    const view=read(`src/components/views/${name}.tsx`);
    expect(view).toMatch(/workspaceService\.listModels\(|universalGenerationClient\.catalog\(/);
    expect(view).toMatch(/generationClient\.quote\(|universalGenerationClient\.quote\(/);
    expect(view).toMatch(/generationClient\.create\(|universalGenerationClient\.create\(/);
    expect(view).not.toMatch(/(?:voice|music|threeD)GenerationClient/);
  });
  it('removes parallel media job routes from the active API',()=>{
    const routes=read('server/routes/index.ts');
    expect(routes).not.toMatch(/(?:voice|music|threeD)GenerationRouter/);
    const backend=read('server/routes/generationRoutes.ts');
    expect(backend).toContain('routingV2AutoModelSelectionService.select');
    expect(backend).toContain('routingV2ExecutionService.preview');
    const auto=read('server/routing-v2/autoModelSelectionService.ts');
    expect(auto).toContain('routingV2RouteService.listReady');
    expect(auto).toContain('routes.some((route) => route.model_id === model.model_id)');
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
  });
});
