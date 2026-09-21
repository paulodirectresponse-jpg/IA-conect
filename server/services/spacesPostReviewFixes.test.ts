import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
import{activeExecutionSucceeded,activeTerminalNodeIds}from'../beta/flows/flowExecutionCompletion.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const run=(node_id:string,status:'WAITING'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED')=>({node_id,status} as any);

describe('Spaces post-review fixes',()=>{
 it('finishes NODE execution without waiting for unrelated workflow outputs',()=>{
  const graph:any={nodes:[
   {node_id:'toolA',kind:'TOOL'},{node_id:'outA',kind:'OUTPUT'},
   {node_id:'toolB',kind:'TOOL'},{node_id:'outB',kind:'OUTPUT'},
  ],edges:[
   {from_node_id:'toolA',to_node_id:'outA'},
   {from_node_id:'toolB',to_node_id:'outB'},
  ]};
  const active=new Set(['toolA']),runs=new Map([['toolA',run('toolA','SUCCEEDED')]]);
  expect(activeTerminalNodeIds(graph,active)).toEqual(['toolA']);
  expect(activeExecutionSucceeded(active,runs)).toBe(true);
 });

 it('finishes DOWNSTREAM execution at the active frontier only',()=>{
  const graph:any={nodes:[
   {node_id:'toolA',kind:'TOOL'},{node_id:'midA',kind:'TOOL'},{node_id:'outA',kind:'OUTPUT'},
   {node_id:'other',kind:'OUTPUT'},
  ],edges:[
   {from_node_id:'toolA',to_node_id:'midA'},
   {from_node_id:'midA',to_node_id:'outA'},
  ]};
  const active=new Set(['toolA','midA','outA']);
  const runs=new Map([
   ['toolA',run('toolA','SUCCEEDED')],
   ['midA',run('midA','SUCCEEDED')],
   ['outA',run('outA','SUCCEEDED')],
  ]);
  expect(activeTerminalNodeIds(graph,active)).toEqual(['outA']);
  expect(activeExecutionSucceeded(active,runs)).toBe(true);
 });

 it('does not finish while any active node is still running',()=>{
  const active=new Set(['a','b']),runs=new Map([
   ['a',run('a','SUCCEEDED')],
   ['b',run('b','RUNNING')],
  ]);
  expect(activeExecutionSucceeded(active,runs)).toBe(false);
 });

 it('rejects a second run while the same Space is already running',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(runtime).toContain("item.flow_id===flowId&&item.status==='RUNNING'");
  expect(runtime).toContain("FLOW_RUN_ALREADY_RUNNING");
  expect(runtime).toContain('Este Space já possui uma execução em andamento.');
 });

 it('marks reused node outputs without presenting them as new creations',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  const planner=read('server/beta/flows/flowExecutionPlan.ts');
  const routes=read('server/routes/spacesRoutes.ts');
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(runtime).toContain('reused_from_run_id:source.run_id');
  expect(runtime).toContain('created_at:source.created_at');
  expect(planner).toContain('row.reused_from_run_id');
  expect(routes).toContain('nodeRun.reused_from_run_id');
  expect(workspace).toContain('if(nodeRun.reused_from_run_id)continue');
 });

 it('keeps execution controls disabled for the whole RUNNING lifecycle, not only the start request',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("if(busy==='run'||run?.status==='RUNNING')return");
  expect(workspace).toContain("busy={busy==='run'||run?.status==='RUNNING'}");
  expect(workspace).toContain("running={busy==='run'||run?.status==='RUNNING'}");
  expect(workspace).toContain("run?.status==='RUNNING'||!cap");
 });

 it('uses the active execution set as the runtime completion authority',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(runtime).toContain('activeExecutionSucceeded(active,runs)');
  expect(runtime).toContain('activeTerminalNodeIds(run.graph,active)');
  expect(runtime).not.toContain("const outputNodes=order.filter(node=>node.kind==='OUTPUT')");
 });
});
