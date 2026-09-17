import fs from'fs';import path from'path';import{describe,expect,it}from'vitest';const read=(f:string)=>fs.readFileSync(path.join(process.cwd(),f),'utf8');
describe('PR-18 Context / Copilot release',()=>{
 it('registers public flags and one-shot release markers',()=>{const flags=read('src/beta/betaFlags.ts'),service=read('server/services/featureFlagService.ts');expect(flags).toContain("beta.context");expect(flags).toContain("beta.copilot");expect(service).toContain('beta_context_v1_release');expect(service).toContain('beta_copilot_v1_release');expect(service).toContain('PR-18_CONTEXT_V1');expect(service).toContain('PR-18_COPILOT_V1');});
 it('keeps admin kill switches after release',()=>{const service=read('server/services/featureFlagService.ts');expect(service).toContain('toggleFlag');expect(service).toContain('saveFeatureFlag(updated)');});
 it('gates both APIs by beta enabled plus their feature flag',()=>{const context=read('server/routes/betaContextRoutes.ts'),copilot=read('server/routes/betaCopilotRoutes.ts');expect(context).toContain("!flags['beta.enabled']||!flags['beta.context']");expect(copilot).toContain("!flags['beta.enabled']||!flags['beta.copilot']");});
});
