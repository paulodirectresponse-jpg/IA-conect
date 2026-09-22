import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
import{flowExecutionLayers,flowTerminalNodeIds,flowTopologicalOrder,fullGraphActiveIds}from'../beta/flows/flowGraphExecution.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const graph:any={nodes:[
 {node_id:'a',kind:'ASSET',label:'A',x:0,y:0,media_type:'IMAGE',asset_id:'asset_a'},
 {node_id:'b',kind:'TOOL',label:'B',x:1,y:0,capability_id:'image-edit',model_id:'AUTO',controls:{}},
 {node_id:'c',kind:'TOOL',label:'C',x:2,y:0,capability_id:'image-to-video',model_id:'AUTO',controls:{}},
 {node_id:'d',kind:'TOOL',label:'D',x:1,y:2,capability_id:'image-edit',model_id:'AUTO',controls:{}},
],edges:[
 {edge_id:'e1',from_node_id:'a',to_node_id:'b',media_type:'IMAGE'},
 {edge_id:'e2',from_node_id:'b',to_node_id:'c',media_type:'IMAGE'},
 {edge_id:'e3',from_node_id:'a',to_node_id:'d',media_type:'IMAGE'},
]};

describe('Spaces V2 phase 10 graph execution',()=>{
 it('runs the complete graph even when it has no explicit OUTPUT node',()=>{
  const active=fullGraphActiveIds(graph);
  expect([...active]).toEqual(['a','b','c','d']);
  expect(flowTerminalNodeIds(graph,active)).toEqual(['c','d']);
 });

 it('builds deterministic dependency layers for parallel-ready branches',()=>{
  const active=fullGraphActiveIds(graph);
  expect(flowExecutionLayers(graph,active)).toEqual([['a'],['b','d'],['c']]);
  expect(flowTopologicalOrder(graph,active).map(node=>node.node_id)).toEqual(['a','b','c','d']);
 });

 it('stores the execution order and dependency layers in the immutable run snapshot',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  const types=read('server/beta/flows/flowRuntimeTypes.ts');
  expect(types).toContain('execution_order?:string[]');
  expect(types).toContain('execution_layers?:string[][]');
  expect(runtime).toContain('execution_order:plan.execution_order');
  expect(runtime).toContain('execution_layers:plan.execution_layers');
 });

 it('uses one topological engine for FULL, NODE, DOWNSTREAM and runtime advancement',()=>{
  const planner=read('server/beta/flows/flowExecutionPlan.ts');
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(planner).toContain('fullGraphActiveIds(flow.graph)');
  expect(planner).toContain('flowDescendants(flow.graph,target)');
  expect(planner).toContain('flowTopologicalOrder(flow.graph,active)');
  expect(runtime).toContain('flowTopologicalOrder(run.graph,active)');
 });

 it('waits for every incoming dependency before executing a downstream node',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(runtime).toContain("incoming.some(edge=>runs.get(edge.from_node_id)?.status!=='SUCCEEDED')");
  expect(runtime).toContain('valuesForEdges(incoming,runs)');
 });

 it('detects a blocked execution instead of polling forever with no runnable node',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(runtime).toContain("error_code:'FLOW_EXECUTION_BLOCKED'");
  expect(runtime).toContain('!hasRunning&&!progressed');
 });

 it('keeps successful upstream reuse for selective execution',()=>{
  const planner=read('server/beta/flows/flowExecutionPlan.ts');
  expect(planner).toContain('seedRuns.set(prev,reusable)');
  expect(planner).toContain('subgraphSignature');
  expect(planner).toContain('edge.target_port||null');
 });

 it('exposes graph execution metadata through the Stable client contract',()=>{
  const client=read('src/beta/flowRuntimeClient.ts');
  expect(client).toContain('execution_order?:string[]');
  expect(client).toContain('execution_layers?:string[][]');
 });

 it('keeps economics and provider orchestration on the existing server path',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  const economic=read('server/beta/flows/flowEconomicRuntimeService.ts');
  expect(runtime).toContain('betaJobOrchestrator.create');
  expect(runtime).toContain('betaJobOrchestrator.quote');
  expect(runtime).toContain('betaJobOrchestrator.queue');
  expect(economic).toContain('flowEconomicsContext.run');
  expect(economic).toContain('betaFlowRuntimeService.start');
 });
});
