import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file:string)=>fs.existsSync(path.join(root,file));

const creators=[
  'src/components/views/UnifiedImageCreateView.tsx',
  'src/components/views/CreateView.tsx',
  'src/components/views/VoiceCreateView.tsx',
  'src/components/views/MusicCreateView.tsx',
  'src/components/views/ThreeDCreateView.tsx',
];

const editors=[
  'src/components/views/ImageEditorView.tsx',
  'src/components/views/VideoEditorView.tsx',
];

describe('Etapa 8 — structural regression guardrails',()=>{
  it('forbids legacy generation clients in every primary creator',()=>{
    for(const file of creators){
      const source=read(file);
      expect(source,file).toContain('universalGenerationClient');
      expect(source,file).not.toMatch(/from ['"][^'"]*generationClient(?:\.js)?['"]/);
      expect(source,file).not.toContain('editorClient');
      expect(source,file).not.toContain('betaJobOrchestrator');
    }
  });

  it('keeps both editors on universal quote/create lifecycle and off beta jobs',()=>{
    for(const file of editors){
      const source=read(file);
      expect(source,file).toContain('universalGenerationClient');
      expect(source,file).toContain('universalGenerationClient.quote');
      expect(source,file).toContain('universalGenerationClient.create');
      expect(source,file).not.toContain('editorClient');
      expect(source,file).not.toContain('betaJobOrchestrator');
      expect(source,file).not.toContain('/editors/jobs');
      expect(source,file).not.toContain('/beta/jobs');
    }
  });

  it('keeps one canonical request type shared by quote and create',()=>{
    const universal=read('src/services/universalGenerationClient.ts');
    const types=read('src/types/universalGeneration.ts');
    expect(types).toContain('export interface UniversalGenerationRequest');
    expect(types).toContain('export interface UniversalGenerationStartRequest');
    expect(types).toContain('extends UniversalGenerationRequest');
    expect(universal).toContain('quote(request: UniversalGenerationRequest)');
    expect(universal).toContain('request: UniversalGenerationRequest');
    expect(universal).toContain('UniversalGenerationStartRequest');
  });

  it('never reintroduces synthetic duration for image generation',()=>{
    const image=read('src/components/views/UnifiedImageCreateView.tsx');
    const imagePanel=read('src/components/workspace/UnifiedImageCreatorPanel.tsx');
    const contract=read('server/routing-v2/generationContract.ts');
    const routes=read('server/routes/generationRoutes.ts');
    expect(image).not.toContain('duration_seconds: 1');
    expect(imagePanel).not.toContain('duration_seconds: 1');
    expect(contract).toContain('DURATION_CAPABILITIES');
    expect(contract).not.toMatch(/DURATION_CAPABILITIES[\s\S]*["']text-to-image["']/);
    expect(routes).toContain('capabilityUsesDuration');
  });

  it('forces AUTO selection to be resolved by backend Routing V2',()=>{
    const hook=read('src/components/workspace/useBackendAutoQuote.ts');
    const routes=read('server/routes/generationRoutes.ts');
    const auto=read('server/routing-v2/autoModelSelectionService.ts');
    expect(hook).toContain('universalGenerationClient.quote');
    expect(hook).toContain('quote?.resolved_model_id');
    expect(routes).toContain('routingV2AutoModelSelectionService.select');
    expect(auto).toContain('routingV2RouteService.listReady');
    expect(auto).toContain('routingV2GenerationPricingService.preview');
    for(const file of creators){
      const source=read(file);
      expect(source,file).not.toMatch(/\.sort\([^\n]*(score|priority|cost|price)/i);
    }
  });

  it('publishes only ACTIVE models backed by READY routes',()=>{
    const catalog=read('server/routing-v2/catalogService.ts');
    expect(catalog).toContain('routingV2RouteService.listReady()');
    expect(catalog).toContain("model.status==='ACTIVE'");
    expect(catalog).toContain('available_capabilities.length>0');
    expect(catalog).toContain("readiness:'READY'");
    const universal=read('src/services/universalGenerationClient.ts');
    expect(universal).toContain('model.readiness === "READY"');
    expect(universal).toContain('model.capabilities_ready?.includes(capabilityId)');
  });

  it('keeps capability truth and operational compatibility in backend code',()=>{
    const generationRoutes=read('server/routes/generationRoutes.ts');
    const generationService=read('server/services/generationService.ts');
    const compatibility=read('server/routing-v2/modelCompatibilityService.ts');
    expect(generationRoutes).toContain('resolveGenerationCapability');
    expect(generationRoutes).toContain('validateModelCompatibility');
    expect(generationService).toContain('validateModelCompatibility');
    expect(compatibility).toContain('validateModelCompatibility');
    expect(generationRoutes).not.toContain('../../src/services/modelCapabilities');
    expect(generationService).not.toContain('../../src/services/modelCapabilities');
  });

  it('prevents Admin V1 inventory writers from returning to the active API',()=>{
    const index=read('server/routes/index.ts');
    const adminView=read('src/components/views/AdminView.tsx');
    expect(index).toContain('adminRoutingV2Router');
    expect(index).not.toContain('adminPricingRouter');
    expect(index).not.toContain('adminBetaCatalogRouter');
    expect(index).not.toContain('providerScanRouter');
    expect(adminView).toContain('AdminRoutingV2');
    expect(adminView).not.toContain('AdminAIProvidersHub');
    expect(adminView).not.toContain('AdminPricing');
    expect(adminView).not.toContain('AdminBetaCatalog');
    for(const file of[
      'server/routes/adminPricingRoutes.ts',
      'server/routes/adminBetaCatalogRoutes.ts',
      'src/components/admin/AdminAIProvidersHub.tsx',
      'src/components/admin/AdminPricing.tsx',
      'src/components/admin/AdminBetaCatalog.tsx',
    ])expect(exists(file),file).toBe(false);
  });

  it('keeps Routing V2 as the operational provider/model/route source for Admin health',()=>{
    const admin=read('server/services/adminService.ts');
    const health=read('server/services/systemHealthService.ts');
    const finance=read('server/services/providerFinanceService.ts');
    expect(admin).toContain('routingV2Repository.listModels()');
    expect(admin).toContain('routingV2Repository.listProviders()');
    expect(health).toContain('routingV2Repository.listModels()');
    expect(health).toContain('routingV2Repository.listProviders()');
    expect(health).toContain('routingV2Repository.listRoutes()');
    expect(finance).toContain('routingV2Repository.listProviders()');
    expect(finance).not.toContain('passiveProviders');
    expect(finance).not.toContain('PROVIDER_DEFINITIONS');
  });

  it('keeps empty V2 inventory distinct from infrastructure failure',()=>{
    const health=read('server/services/systemHealthService.ts');
    expect(health).toContain('NOT_CONFIGURED — nenhuma Route V2 READY');
    expect(health).toContain("status:'OK'");
    expect(health).toContain('Falha ao consultar o catálogo persistente.');
  });
});
