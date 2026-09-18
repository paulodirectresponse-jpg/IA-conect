import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('Stable model publication and provider pricing recovery',()=>{
  it('lets Admin see experimental beta-only runtime models',()=>{
    const routes=read('server/routes/adminRoutes.ts');
    const admin=read('src/services/adminService.ts');
    expect(routes).toContain("adminRouter.get('/admin/models'");
    expect(routes).toContain('catalogRepository.listModels()');
    expect(admin).toContain("cachedGet<ModelRegistryItem[]>('/api/admin/models')");
  });

  it('publishes only models whose declared capabilities have safe priced routes',()=>{
    const service=read('server/services/stableModelPublicationService.ts');
    expect(service).toContain('missing_capability_ids');
    expect(service).toContain("provider.status!=='ACTIVE'");
    expect(service).toContain('priceMatches');
    expect(service).toContain("status:'ACTIVE',beta_only:false");
    expect(service).toContain('auto_routing_enabled:true');
  });

  it('limits bulk Stable publication to five models per request',()=>{
    const routes=read('server/routes/adminRoutes.ts');
    const ui=read('src/components/admin/AdminAIProvidersHub.tsx');
    expect(routes).toContain("'/admin/models/publish-stable-bulk'");
    expect(routes).toContain('if(ids.length>5)');
    expect(ui).toContain('for(let i=0;i<ids.length;i+=5)');
    expect(ui).toContain('Publicar prontos');
  });

  it('loads Runware public catalog pricing metadata without treating it as a verified charge rule',()=>{
    const scan=read('server/services/providerModelScanService.ts');
    expect(scan).toContain('https://content.runware.ai/models/');
    expect(scan).toContain('/pricing');
    expect(scan).toContain('provider_pricing_metadata');
    expect(scan).toContain('metadata(s) de pricing');
    const admin=read('src/components/admin/AdminProviderScan.tsx');
    expect(admin).toContain('Catálogo encontrado');
  });

  it('uses Atlas calculate pricing as the authoritative pre-execution probe',()=>{
    const scan=read('server/services/providerModelScanService.ts');
    const adapter=read('server/adapters/atlasProviderAdapter.ts');
    expect(adapter).toContain('/api/v1/model/calculate');
    expect(scan).toContain("providerId==='provider-atlas'");
    expect(scan).toContain("capability_id:'text-to-video'");
    expect(scan).not.toContain("unit_price_usd:0,\n        minimum_usd:null,\n        verified:true");
  });
});
