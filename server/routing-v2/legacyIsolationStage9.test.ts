import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('Etapa 9 alternativa — isolamento não destrutivo do legado',()=>{
  it('mantém endpoints legados de scan/pricing/mapping fora do runtime montado',()=>{
    const index=read('server/routes/index.ts');
    expect(index).not.toContain('providerScanRouter');
    expect(index).not.toContain("./providerScanRoutes");
  });

  it('mantém telas antigas de providers/models/scan fora do Admin atual',()=>{
    const admin=read('src/components/views/AdminView.tsx');
    for(const legacy of['AdminProviders','AdminModels','AdminProviderScan']){
      expect(admin).not.toContain(legacy);
    }
    expect(admin).toContain('AdminRoutingV2');
  });

  it('usa Routing V2 como única fonte do catálogo público de IA',()=>{
    const catalog=read('server/routes/catalogRoutes.ts');
    expect(catalog).toContain('routingV2CatalogService.listGeneratorModels()');
    expect(catalog).toContain('routingV2CatalogService.listGeneratorRoutes');
    expect(catalog).not.toContain('catalogRepository.listModels()');
    expect(catalog).not.toContain('catalogRepository.listMappings()');
    expect(catalog).not.toContain('providerCatalogService');
  });

  it('resolve Auto exclusivamente por inventário e Routes READY V2',()=>{
    const auto=read('server/routing-v2/autoModelSelectionService.ts');
    expect(auto).toContain('routingV2Repository.listModels()');
    expect(auto).toContain('routingV2RouteService.listReady');
    expect(auto).toContain('routingV2GenerationPricingService.preview');
    expect(auto).not.toContain('catalogRepository');
    expect(auto).not.toContain('providerCatalogService');
    expect(auto).not.toContain('providerPricingCatalogService');
  });

  it('calcula preço de geração exclusivamente pela cadeia econômica V2',()=>{
    const pricing=read('server/routing-v2/generationPricingService.ts');
    expect(pricing).toContain('routingV2RouterService.select');
    expect(pricing).toContain('routingV2PricingSettingsService.get()');
    expect(pricing).toContain('calculateRoutingV2Economics');
    expect(pricing).not.toContain('providerPricingCatalogService');
    expect(pricing).not.toContain('retailPricingService');
    expect(pricing).not.toContain('creditPricingService');
  });

  it('inicia novas gerações pelo executor V2 antes de qualquer rollback legado',()=>{
    const service=read('server/services/generationService.ts');
    const start=service.indexOf('return routingV2ExecutionService.start');
    const legacy=service.indexOf('Legacy execution path retained only as an unreachable rollback reference');
    expect(start).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(start);
  });

  it('mantém métricas de IA do Admin em Routing V2',()=>{
    const adminService=read('server/services/adminService.ts');
    expect(adminService).toContain('routingV2Repository.listModels()');
    expect(adminService).toContain('routingV2Repository.listProviders()');
  });

  it('mantém o reset destrutivo apenas como contingência explícita, não como requisito de fechamento',()=>{
    const reset=read('server/services/factoryResetService.ts');
    expect(reset).toContain('FACTORY_RESET_PRODUCTION_ENABLED');
    expect(reset).toContain('FACTORY_RESET_APPROVAL_SHA256');
    expect(reset).toContain('RESET_AI_CONFIGURATION_ONLY_PRESERVE_ALL_REAL_USER_DATA');
    expect(reset).toContain('PROTECTED_COLLECTIONS');
  });

  it('impede que dados legados armazenados voltem a ser autoridade operacional sem quebrar o guardrail',()=>{
    const index=read('server/routes/index.ts');
    const admin=read('src/components/views/AdminView.tsx');
    const catalog=read('server/routes/catalogRoutes.ts');
    const auto=read('server/routing-v2/autoModelSelectionService.ts');
    const pricing=read('server/routing-v2/generationPricingService.ts');

    expect(index).not.toContain('providerScanRouter');
    expect(admin).toContain('AdminRoutingV2');
    expect(catalog).toContain('routingV2CatalogService');
    expect(auto).toContain('routingV2RouteService.listReady');
    expect(pricing).toContain('routingV2RouterService.select');
  });
});
