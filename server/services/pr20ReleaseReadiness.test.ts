import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-20 Final QA / Rollout release readiness',()=>{
  it('keeps the complete native CI gate in one pipeline',()=>{
    const ci=read('.github/workflows/ci.yml');
    for(const gate of ['npm run lint','npm run build','npm run perf:bundle','assert-performance-budget.mjs','npm test -- --passWithNoTests','Browser performance QA — Fast 3G + 4G','assert-lighthouse.mjs lighthouse-fast3g.json fast3g','assert-lighthouse.mjs lighthouse-4g.json 4g'])expect(ci).toContain(gate);
  });

  it('preserves Stable routes while Beta remains isolated behind its entry gate',()=>{
    const app=read('src/App.tsx');
    for(const stable of ['DashboardView','WalletView','CreateHubView','HistoryView','SettingsView','LibraryHubView','CommunityView','AdminView'])expect(app).toContain(stable);
    expect(app).toContain("view==='beta'&&!betaEnabled");
    expect(app).toContain("lazy(()=>import('./beta/BetaApp.js')");
  });

  it('keeps Beta rollout and execution kill switches explicit',()=>{
    const flags=read('src/beta/betaFlags.ts');
    for(const flag of ['beta.enabled','beta.execution.enabled','beta.flow_runtime.execution','beta.flow_economics.budget_guard','beta.sharing','beta.analytics'])expect(flags).toContain(flag);
    expect(flags).toContain('is_private: true');
  });

  it('keeps released Beta modules controllable after one-shot release markers',()=>{
    const service=read('server/services/featureFlagService.ts');
    for(const marker of ['PR-15_TEMPLATES_V1','PR-16_WORKFLOW_APPS_V1','PR-17_BATCH_V1','PR-18_CONTEXT_V1','PR-18_COPILOT_V1','PR-19_SHARING_V1','PR-19_ANALYTICS_V1'])expect(service).toContain(marker);
    expect(service).toContain('toggleFlag');
    expect(service).toContain('FEATURE_FLAG_TOGGLED');
  });

  it('keeps public sharing read-only and revocable',()=>{
    const routes=read('server/routes/betaSharingRoutes.ts');
    const sharing=read('server/beta/sharing/sharingService.ts');
    expect(routes).toContain("get('/shared/:token'");
    expect(routes).not.toMatch(/post\('\/shared\/:token|put\('\/shared\/:token|patch\('\/shared\/:token|delete\('\/shared\/:token/i);
    expect(sharing).toContain("status:'REVOKED'");
    expect(sharing).toContain("createHash('sha256')");
  });

  it('retains server-authoritative economics, ownership and idempotency regression suites',()=>{
    const required=[
      'server/services/generationEconomicsPolicy.test.ts',
      'server/services/creditConcurrencyQa.test.ts',
      'server/repositories/assetIdempotency.test.ts',
      'server/beta/flows/flowRuntimeIdempotency.test.ts',
      'server/beta/flows/flowEconomicsArchitecture.test.ts',
      'server/repositories/dataArchitecture.test.ts',
    ];
    for(const file of required)expect(fs.existsSync(path.join(process.cwd(),file)),`${file} must exist`).toBe(true);
  });

  it('retains responsive and reduced-motion safeguards',()=>{
    const enterprise=read('src/styles/enterprise-theme.css');
    const mobile=read('src/styles/mobile-stage4.css');
    expect(enterprise).toContain('@media(prefers-reduced-motion:reduce)');
    expect(enterprise).toContain('@media(max-width:767px)');
    expect(mobile).toContain('@media');
  });
});
