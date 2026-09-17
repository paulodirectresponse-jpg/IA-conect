import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
describe('PR-13 Flow Runtime release',()=>{
 it('ships runtime and execution kill switches with one-shot release',()=>{const flags=read('src/beta/betaFlags.ts');const catalog=read('server/repositories/catalogRepository.ts');expect(flags).toContain("flag_key: 'beta.flow_runtime'");expect(flags).toContain("flag_key: 'beta.flow_runtime.execution'");expect(catalog).toContain('PR-13_FLOW_RUNTIME_V1');expect(catalog).toContain('beta_flow_runtime_v1_release');});
 it('registers authenticated runtime routes',()=>{const routes=read('server/routes/betaFlowRuntimeRoutes.ts');const index=read('server/routes/index.ts');expect(routes).toContain("use('/beta/flow-runs',requireAuth)");expect(routes).toContain("post('/beta/flows/:flowId/runs'");expect(routes).toContain("post('/beta/flow-runs/:runId/retry'");expect(routes).toContain("post('/beta/flow-runs/:runId/cancel'");expect(index).toContain('apiRootRouter.use(betaFlowRuntimeRouter)');});
 it('integrates typed inputs progress retry cancel and outputs into Flow Editor',()=>{const ui=read('src/beta/views/BetaFlowsView.tsx');expect(ui).toContain('betaFlowRuntimeClient.start');expect(ui).toContain('betaFlowRuntimeClient.advance');expect(ui).toContain('betaFlowRuntimeClient.retry');expect(ui).toContain('betaFlowRuntimeClient.cancel');expect(ui).toContain('ia-beta-flow-runtime-inputs');expect(ui).toContain('ia-beta-flow-runtime-outputs');});
 it('keeps the runtime responsive on mobile',()=>{const css=read('src/beta/styles/beta.css');expect(css).toContain('.ia-beta-flow-runtime');expect(css).toContain('@media(max-width:767px)');});
});