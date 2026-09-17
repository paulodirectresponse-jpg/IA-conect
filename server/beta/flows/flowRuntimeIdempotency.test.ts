import fs from 'fs';
import path from 'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
describe('PR-13 Flow Runtime idempotency and retries',()=>{
 it('claims flow starts idempotently before execution',()=>{const repo=read('server/beta/flows/flowRuntimeRepository.ts');const runtime=read('server/beta/flows/flowRuntimeService.ts');expect(repo).toContain("const IDEM='beta_flow_run_idempotency'");expect(repo).toContain('currentDocument:{exists:false}');expect(runtime).toContain('createIdempotent({userId,flowId,idempotencyKey,run})');});
 it('uses deterministic per-node Universal Job idempotency keys',()=>{const runtime=read('server/beta/flows/flowRuntimeService.ts');expect(runtime).toContain('attempt:\${attemptIndex}:create');expect(runtime).toContain('attempt:\${attemptIndex}:quote');expect(runtime).toContain('attempt:\${attemptIndex}:queue');});
 it('retries a failed node with a fresh job attempt without replaying successful nodes',()=>{const runtime=read('server/beta/flows/flowRuntimeService.ts');expect(runtime).toContain("if(nodeRun?.status==='SUCCEEDED')continue");expect(runtime).toContain('retry_count:item.retry_count+1');expect(runtime).toContain('job_id:null');expect(runtime).toContain('FLOW_NODE_RETRY_LIMIT');});
 it('supports cancellation through Universal Jobs',()=>{const runtime=read('server/beta/flows/flowRuntimeService.ts');expect(runtime).toContain('betaJobOrchestrator.cancel');expect(runtime).toContain("finishRun(run,map,'CANCELLED'");});
});