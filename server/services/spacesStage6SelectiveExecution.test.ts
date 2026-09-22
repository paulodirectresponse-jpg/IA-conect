import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces stage 6 selective execution',()=>{
 it('supports full, single-node and downstream execution as explicit backend modes',()=>{
  const planner=read('server/beta/flows/flowExecutionPlan.ts');
  const types=read('server/beta/flows/flowRuntimeTypes.ts');
  expect(planner).toContain("FlowExecutionMode='FULL'|'NODE'|'DOWNSTREAM'");
  expect(planner).toContain("if(mode==='FULL')");
  expect(planner).toContain("mode==='NODE'?new Set([target]):flowDescendants");
  expect(types).toContain("execution_mode?:'FULL'|'NODE'|'DOWNSTREAM'");
  expect(types).toContain('target_node_id?:string|null');
 });

 it('reuses only unchanged successful upstream subgraphs',()=>{
  const planner=read('server/beta/flows/flowExecutionPlan.ts');
  expect(planner).toContain('subgraphSignature');
  expect(planner).toContain("row.status!=='SUCCEEDED'");
  expect(planner).toContain('currentSig!==priorSig');
  expect(planner).toContain("node.kind==='INPUT'");
  expect(planner).toContain('assetRepository.getAsset');
 });

 it('falls back to recomputing required ancestors when no valid reusable output exists',()=>{
  const planner=read('server/beta/flows/flowExecutionPlan.ts');
  expect(planner).toContain('requireUpstream');
  expect(planner).toContain('if(reusable){seedRuns.set(prev,reusable);continue;}');
  expect(planner).toContain('await requireUpstream(prev)');
 });

 it('seeds reused nodes into the new run at zero new authorized credits',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(runtime).toContain('for(const [nodeId,source] of plan.seed_runs)');
  expect(runtime).toContain("status:'SUCCEEDED'");
  expect(runtime).toContain('authorized_credit_price:0');
  expect(runtime).toContain('reused_node_ids:Array.from(seeded)');
 });

 it('does not require raw inputs for already-seeded upstream nodes',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(runtime).toContain("item.kind==='INPUT'&&!seeded.has(item.node_id)");
  expect(runtime).toContain('normalizeInputs(userId,flow.graph,active,input?.inputs||{},seeded)');
 });

 it('keeps wallet economics bound to the existing runtime instead of creating a second billing path',()=>{
  const economic=read('server/beta/flows/flowEconomicRuntimeService.ts');
  const planner=read('server/beta/flows/flowExecutionPlan.ts');
  expect(economic).toContain('betaFlowRuntimeService.start');
  expect(economic).toContain('betaFlowEconomicsService.bindRun');
  expect(planner).not.toMatch(/creditWalletService|reserveCredits|captureCredits/);
 });

 it('maps card and toolbar actions to the three execution modes',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const toolbar=read('src/components/spaces/canvas/SpaceToolbar.tsx');
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  expect(workspace).toContain("startRun('NODE',node.node_id)");
  expect(workspace).toContain("startRun('DOWNSTREAM',node.node_id)");
  expect(workspace).toContain("startRun('FULL')");
  expect(toolbar).toContain('Executar tudo');
  expect(shell).toContain('Executar daqui para frente');
 });

 it('sends execution intent through the Stable Spaces API contract',()=>{
  const client=read('src/services/spacesClient.ts');
  expect(client).toContain("SpaceExecutionMode='FULL'|'NODE'|'DOWNSTREAM'");
  expect(client).toContain('execution:SpaceExecutionSelection');
  expect(client).toContain('body:JSON.stringify({inputs,...economics,execution})');
 });
});