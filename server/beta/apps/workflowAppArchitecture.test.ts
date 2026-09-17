import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
describe('PR-16 Workflow Apps architecture',()=>{
 it('executes exclusively through Flow Runtime and inherits its credits/idempotency',()=>{const service=read('server/beta/apps/workflowAppService.ts');expect(service).toContain('betaFlowRuntimeService.start');expect(service).not.toMatch(/creditWalletService|reserveCredits|captureCredits|betaJobOrchestrator|createAndStartGeneration/);expect(service).toContain("wapp:${app.app_id}:r${app.revision}");});
 it('pins published Apps to hidden runtime Flow snapshots',()=>{const service=read('server/beta/apps/workflowAppService.ts');const flowRepo=read('server/beta/flows/flowRepository.ts');expect(service).toContain("system_kind:'WORKFLOW_APP'");expect(service).toContain('runtime_flow_revision');expect(service).toContain('refreshRevision');expect(flowRepo).toContain("row.system_kind!=='WORKFLOW_APP'");});
 it('keeps providers and final economics out of React',()=>{const ui=read('src/beta/views/BetaWorkflowAppsView.tsx');const client=read('src/beta/workflowAppClient.ts');expect(ui+client).not.toMatch(/wavespeed|atlas|provider_model_identifier|provider_id|credit_price|provider_cost/i);});
 it('validates ownership through owned Flow Template and App lookups',()=>{const service=read('server/beta/apps/workflowAppService.ts');const repo=read('server/beta/apps/workflowAppRepository.ts');expect(service).toContain('betaFlowService.get(userId');expect(service).toContain('betaTemplateService.get(userId');expect(repo).toContain("fieldPath:'owner_user_id'");expect(repo).toContain("row.owner_user_id===userId");});
 it('lazy-loads Apps and keeps Stable isolated',()=>{const beta=read('src/beta/BetaApp.tsx');const stable=read('src/App.tsx');expect(beta).toContain("lazy(()=>import('./views/BetaWorkflowAppsView.js')");expect(stable).not.toContain('BetaWorkflowAppsView');expect(stable).not.toContain('workflowAppClient');});
 it('contains a responsive mobile contract',()=>{const css=read('src/beta/styles/workflow-apps.css');expect(css).toContain('@media(max-width:820px)');expect(css).toContain('@media(max-width:520px)');});
});
