import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-11 Video economics',()=>{
  it('keeps prices server-authoritative and duration-based',()=>{
    const ui=read('src/beta/views/BetaVideoView.tsx');
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const pricing=read('server/services/creditPricingService.ts');
    expect(ui).not.toMatch(/credit_price\s*[:=]\s*\d+/);
    expect(ui).not.toMatch(/provider_cost|safe_cogs|customer_price/i);
    expect(jobs).toContain('betaEconomicsService.resolveQuote');
    expect(pricing).toContain("perRequest?'PER_REQUEST':'PER_SECOND'");
  });

  it('uses AUTO without exposing provider selection to the frontend',()=>{
    const ui=read('src/beta/views/BetaVideoView.tsx');
    const client=read('src/beta/videoClient.ts');
    expect(client).toContain("model.model_id==='AUTO'");
    expect(ui).toContain("useState('AUTO')");
    expect(ui).not.toContain('selected_provider_id');
  });

  it('quotes source video transforms using owned provider-accessible references',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const adapter=read('server/adapters/wavespeedProviderAdapter.ts');
    expect(jobs).toContain('assetReferenceResolver.resolveReferenceAssetUrls');
    expect(adapter).toContain("videos.find(r=>r.role==='SOURCE')||videos[0]");
    expect(adapter).toContain("['video-extend','video-edit'].includes(capability)");
  });

  it('does not create a new wallet or billing path',()=>{
    const videoFiles=[
      read('src/beta/views/BetaVideoView.tsx'),
      read('src/beta/videoClient.ts'),
      read('server/beta/video/videoArchitecture.test.ts'),
    ].join('\n');
    expect(videoFiles).not.toMatch(/reserveForGeneration|captureForGeneration|credit_accounts|credit_lots/);
  });
});
