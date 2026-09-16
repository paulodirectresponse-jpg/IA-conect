import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-08 Audio V1 economics',()=>{
  it('prices non-duration audio capabilities per request and music/SFX by duration',()=>{
    const pricing=read('server/services/creditPricingService.ts');
    expect(pricing).toContain("'TEXT_TO_SPEECH','AUDIO_TO_TEXT','MEDIA_TO_TEXT','AUDIO_TO_AUDIO','MEDIA_DUBBING'");
    expect(pricing).toContain("perRequest?'PER_REQUEST':'PER_SECOND'");
    expect(pricing).toContain('billingUnits=image?');
  });

  it('uses owned media in live provider quotes without trusting frontend provider data',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const guard=read('server/services/pricingGuardService.ts');
    const router=read('server/services/smartRouterService.ts');
    expect(jobs).toContain('assetRepository.getAsset(ref.asset_id,userId)');
    expect(jobs).toContain('assetReferenceResolver.resolveReferenceAssetUrls');
    expect(guard).toContain('provider_references');
    expect(router).toContain('provider_references:params.provider_references');
  });

  it('scopes cached quotes by capability, provider mapping and owned reference IDs',()=>{
    const cache=read('server/services/quoteCacheService.ts');
    expect(cache).toContain("input.capability_id||''");
    expect(cache).toContain("input.provider_model_identifier||''");
    expect(cache).toContain('input.provider_references||[]');
  });

  it('keeps final retail price authority in the existing pricing service',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const audioUi=read('src/beta/views/BetaAudioView.tsx');
    expect(jobs).toContain('betaEconomicsService.resolveQuote');
    expect(audioUi).not.toMatch(/credit_price\s*[:=]\s*\d+/);
    expect(audioUi).not.toMatch(/provider_cost|safe_cogs/i);
  });
});
