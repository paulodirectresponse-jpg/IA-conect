import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('verified Stable launch pricing',()=>{
  it('pins only documented WaveSpeed routes for the first Voice Music and 3D launch',()=>{
    const source=read('server/services/verifiedLaunchRouteService.ts');
    expect(source).toContain("provider_model_identifier:'minimax/speech-2.6-turbo'");
    expect(source).toContain("unit:'CHARACTER',unit_price_usd:0.00006");
    expect(source).toContain("provider_model_identifier:'wavespeed-ai/ace-step/prompt-to-audio'");
    expect(source).toContain("unit:'SECOND',unit_price_usd:0.0002");
    expect(source).toContain("provider_model_identifier:'wavespeed-ai/hunyuan3d-v3'");
    expect(source).toContain("source:'PROVIDER_DOCS'");
  });

  it('promotes Hunyuan3D V3 with its verified multi-view capability',()=>{
    const source=read('server/services/verifiedLaunchRouteService.ts');
    expect(source).toContain("'text-to-3d','image-to-3d','multi-image-to-3d'");
    expect(source).toContain("supports_multiple_images:true,max_reference_images:4");
  });

  it('keeps launch writes explicit and one route at a time',()=>{
    const routes=read('server/routes/providerScanRoutes.ts');
    const admin=read('src/components/admin/AdminProviderScan.tsx');
    expect(routes).toContain("'/admin/provider-launch-routes/:routeKey/apply'");
    expect(admin).toContain('Cada ação aplica somente uma rota.');
    expect(admin).toContain('Ativar rota');
  });

  it('does not expose an unsupported music format control for ACE-Step',()=>{
    const registry=read('server/beta/capabilityRegistry.ts');
    const view=read('src/components/views/MusicCreateView.tsx');
    expect(registry).toContain("control==='output_format'&&id==='music'&&model.model_id==='ace-step-music'");
    expect(view).toContain('supportsFormat');
    expect(view).toContain('output_format:supportsFormat?format:undefined');
  });

  it('restores authoritative pricing sync without reintroducing provider fan-out',()=>{
    const scan=read('server/services/providerModelScanService.ts');
    const pricing=read('server/services/providerPricingCatalogService.ts');
    expect(scan).toContain("providerId==='provider-wavespeed'");
    expect(scan).toContain("quote_mode:'LIVE_PROVIDER'");
    expect(scan).toContain('pricing_synced_count');
    expect(scan).toContain("providerId==='provider-runware'");
    expect(scan).toContain('A busca pública da Runware não fornece preço pré-execução');
    expect(pricing).toContain('async saveMany');
    expect(pricing).toContain('const BATCH=100');
    expect(pricing).toContain("rule.quote_mode==='LIVE_PROVIDER'");
  });

  it('normalizes Stable voice locale codes before WaveSpeed submission',()=>{
    const adapter=read('server/adapters/wavespeedProviderAdapter.ts');
    expect(adapter).toContain("pt:'Portuguese'");
    expect(adapter).toContain("en:'English'");
    expect(adapter).toContain("es:'Spanish'");
    expect(adapter).toContain("fr:'French'");
    expect(adapter).toContain("de:'German'");
  });
});
