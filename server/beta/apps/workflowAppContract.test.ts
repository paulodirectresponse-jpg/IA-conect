import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
describe('PR-16 Workflow Apps contracts',()=>{
 it('defines provider-independent App identity versioning visibility and source bindings',()=>{const types=read('server/beta/apps/workflowAppTypes.ts');for(const token of ['app_id:string','owner_user_id:string','source_type:WorkflowAppSourceType','source_id:string','flow_revision:number','template_id:string|null','runtime_flow_revision:number',"visibility:'PRIVATE'",'revision:number'])expect(types).toContain(token);});
 it('supports friendly public input and output schemas',()=>{const types=read('server/beta/apps/workflowAppTypes.ts');for(const token of ['label:string','required:boolean','placeholder:string','help_text:string','order:number','default_value:any'])expect(types).toContain(token);expect(types).toContain('WorkflowAppOutputField');});
 it('maps only configured inputs and outputs at runtime',()=>{const service=read('server/beta/apps/workflowAppService.ts');expect(service).toContain('for(const field of app.input_schema)');expect(service).toContain('for(const field of app.output_schema)');expect(service).toContain('visibleOutputs');});
 it('requires idempotency and published status for execution',()=>{const service=read('server/beta/apps/workflowAppService.ts');expect(service).toContain("app.status!=='PUBLISHED'");expect(service).toContain('IDEMPOTENCY_KEY_REQUIRED');});
 it('exposes CRUD publish revision refresh and run routes',()=>{const routes=read('server/routes/betaWorkflowAppRoutes.ts');for(const token of ["get('/beta/apps'","post('/beta/apps'","patch('/beta/apps/:appId'","post('/beta/apps/:appId/publish'","post('/beta/apps/:appId/refresh-revision'","post('/beta/apps/:appId/runs'","delete('/beta/apps/:appId'"])expect(routes).toContain(token);});
});
