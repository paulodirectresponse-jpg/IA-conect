import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file:string)=>fs.existsSync(path.join(root,file));

describe('Etapa 10 — final product QA guardrails',()=>{
  it('keeps all planned product surfaces mounted in the authenticated app',()=>{
    const app=read('src/App.tsx');
    for(const view of[
      'create-image','create-video','create-voice','create-music','create-3d',
      'edit-image','edit-video','history','library','wallet','admin',
    ])expect(app,view).toContain(`currentSafeView==='${view}'`);
  });

  it('keeps Image, Video, Voice, Music and 3D on the universal lifecycle',()=>{
    const creators=[
      'src/components/views/UnifiedImageCreateView.tsx',
      'src/components/views/CreateView.tsx',
      'src/components/views/VoiceCreateView.tsx',
      'src/components/views/MusicCreateView.tsx',
      'src/components/views/ThreeDCreateView.tsx',
    ];
    for(const file of creators){
      const source=read(file);
      expect(source,file).toContain('universalGenerationClient');
      expect(source,file).toMatch(/universalGenerationClient\.catalog\(/);
      expect(source,file).toMatch(/universalGenerationClient\.quote\(|useBackendAutoQuote\(/);
      expect(source,file).toContain('universalGenerationClient.create');
    }
  });

  it('keeps both editors on catalog → quote → create → status → asset flow',()=>{
    for(const file of['src/components/views/ImageEditorView.tsx','src/components/views/VideoEditorView.tsx']){
      const source=read(file);
      expect(source,file).toContain('loadUniversalEditorCatalog');
      expect(source,file).toContain('universalGenerationClient.quote');
      expect(source,file).toContain('universalGenerationClient.create');
      expect(source,file).toContain('universalGenerationClient.get');
      expect(source,file).toContain('assetService.listAssets');
      expect(source,file).toContain("window.dispatchEvent(new CustomEvent('creations:updated'");
    }
  });

  it('keeps backend generation lifecycle connected to Routing V2, wallet, asset and history',()=>{
    const routes=read('server/routes/generationRoutes.ts');
    const service=read('server/services/generationService.ts');
    const execution=read('server/routing-v2/executionService.ts');
    expect(routes).toContain('routingV2ExecutionService.preview');
    expect(service).toContain('return routingV2ExecutionService.start');
    expect(execution).toContain('creditWalletService');
    expect(execution).toMatch(/asset|generatedAsset/i);
    expect(read('src/components/views/HistoryView.tsx')).toContain('universalGenerationClient.list()');
  });

  it('keeps Library and Assets backed by the persistent asset layer',()=>{
    const library=read('src/components/views/LibraryHubView.tsx');
    const assets=read('src/components/views/AssetsView.tsx');
    expect(library).toContain('assetService.listAssets');
    expect(library).toContain('creativeEntityService.listProjects');
    expect(assets).toContain('assetService');
    expect(exists('server/routes/assetRoutes.ts')).toBe(true);
    expect(exists('server/repositories/assetRepository.ts')).toBe(true);
  });

  it('keeps Wallet on Credits V2 and payment services',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    const auth=read('src/context/AuthContext.tsx');
    expect(wallet).toContain('creditService');
    expect(wallet).toContain('paymentClient');
    expect(wallet).toContain('refreshWallet');
    expect(auth).toContain('wallet');
    expect(exists('server/services/creditWalletService.ts')).toBe(true);
  });

  it('keeps Admin on Routing V2 and no V1 AI screens mounted',()=>{
    const admin=read('src/components/views/AdminView.tsx');
    expect(admin).toContain('AdminRoutingV2');
    expect(admin).not.toContain('AdminAIProvidersHub');
    expect(admin).not.toContain('AdminPricing');
    expect(admin).not.toContain('AdminBetaCatalog');
    expect(read('server/routes/index.ts')).toContain('adminRoutingV2Router');
  });

  it('keeps post-reset empty AI state valid instead of fabricating routes',()=>{
    const health=read('server/services/systemHealthService.ts');
    const catalog=read('server/routing-v2/catalogService.ts');
    expect(health).toContain('NOT_CONFIGURED — nenhuma Route V2 READY');
    expect(catalog).toContain('routingV2RouteService.listReady()');
    expect(catalog).toContain('available_capabilities.length>0');
    expect(catalog).not.toMatch(/fallback.*model|default.*route/i);
  });

  it('keeps History media metadata valid for image and duration-based generations',()=>{
    const history=read('src/components/views/HistoryView.tsx');
    expect(history).toContain('universalGenerationClient.list()');
    expect(history).toContain('g.duration_seconds?');
    expect(history).not.toContain('{g.duration_seconds}s ·');
  });

  it('keeps mobile QA guardrails present for shell, dashboard, library and stage 4 surfaces',()=>{
    for(const file of[
      'server/services/mobileShellArchitecture.test.ts',
      'server/services/mobileDashboardArchitecture.test.ts',
      'server/services/mobileLibraryArchitecture.test.ts',
      'server/services/mobileStage4FinalQa.test.ts',
    ])expect(exists(file),file).toBe(true);
    const mobile=read('server/services/mobileStage4FinalQa.test.ts');
    for(const cls of['.ia-wallet','.ia-history','.ia-admin'])expect(mobile).toContain(cls);
  });
});
