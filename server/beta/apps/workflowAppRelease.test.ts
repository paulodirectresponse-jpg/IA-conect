import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
describe('PR-16 Workflow Apps release',()=>{
 it('keeps beta.flow_apps as the public feature flag',()=>{const flags=read('src/beta/betaFlags.ts');expect(flags).toContain("flag_key: 'beta.flow_apps'");});
 it('uses a one-shot release marker without removing the admin kill switch',()=>{const service=read('server/services/featureFlagService.ts');expect(service).toContain('app_config/beta_workflow_apps_v1_release');expect(service).toContain("flag:'beta.flow_apps'");expect(service).toContain('PR-16_WORKFLOW_APPS_V1');expect(service).toContain('toggleFlag');});
 it('guards every Workflow Apps route behind Beta and flow_apps',()=>{const routes=read('server/routes/betaWorkflowAppRoutes.ts');expect(routes).toContain("flags['beta.enabled']");expect(routes).toContain("flags['beta.flow_apps']");expect(routes).toContain("use('/beta/apps',requireAuth,requireApps)");});
});
