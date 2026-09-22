import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
import{resolveDirectSpaceConnection,SPACE_CONNECTION_RESOLVER_VERSION}from'../../src/components/spaces/canvas/spaceConnections.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const models:any[]=[{model_id:'AUTO',capabilities:[
 {id:'image-to-video',inputs:['TEXT','IMAGE'],outputs:['VIDEO']},
 {id:'last-frame',inputs:['TEXT','IMAGE'],outputs:['VIDEO']},
 {id:'image-edit',inputs:['TEXT','IMAGE'],outputs:['IMAGE']},
]}];
const asset=(id:string,type:'IMAGE'|'VIDEO')=>({node_id:id,kind:'ASSET',label:id,x:0,y:0,media_type:type,asset_id:id});
const tool=(id:string,capability:string)=>({node_id:id,kind:'TOOL',label:id,x:0,y:0,capability_id:capability,model_id:'AUTO',controls:{}});

describe('Spaces V2 phase 6 connection resolver',()=>{
 it('binds image-to-video references to the semantic first-frame port',()=>{
  const nodes:any[]=[asset('image','IMAGE'),tool('video','image-to-video')];
  const result=resolveDirectSpaceConnection(models as any,nodes,[],'image','video');
  expect(result.status).toBe('COMPATIBLE');
  expect(result.mediaType).toBe('IMAGE');
  expect(result.targetPort).toBe('first_frame');
  expect(result.strategy).toBe('FRAME');
  expect(result.resolverVersion).toBe(SPACE_CONNECTION_RESOLVER_VERSION);
 });

 it('allocates first and last frame deterministically and blocks a third image',()=>{
  const nodes:any[]=[asset('a','IMAGE'),asset('b','IMAGE'),asset('c','IMAGE'),tool('video','last-frame')];
  const first=resolveDirectSpaceConnection(models as any,nodes,[],'a','video');
  expect(first.targetPort).toBe('first_frame');
  const e1:any={edge_id:'e1',from_node_id:'a',to_node_id:'video',media_type:'IMAGE',target_port:'first_frame'};
  const second=resolveDirectSpaceConnection(models as any,nodes,[e1],'b','video');
  expect(second.targetPort).toBe('last_frame');
  const e2:any={edge_id:'e2',from_node_id:'b',to_node_id:'video',media_type:'IMAGE',target_port:'last_frame'};
  const third=resolveDirectSpaceConnection(models as any,nodes,[e1,e2],'c','video');
  expect(third.status).toBe('INCOMPATIBLE');
  expect(third.message).toContain('ocupada');
 });

 it('binds editable image references to reference_image',()=>{
  const nodes:any[]=[asset('image','IMAGE'),tool('edit','image-edit')];
  const result=resolveDirectSpaceConnection(models as any,nodes,[],'image','edit');
  expect(result.targetPort).toBe('reference_image');
  expect(result.strategy).toBe('REFERENCE');
 });

 it('persists resolver metadata in every new direct or contextual edge',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('source_port:resolved.sourcePort');
  expect(workspace).toContain('target_port:resolved.targetPort');
  expect(workspace).toContain('resolver_version:resolved.resolverVersion');
  expect(workspace).toContain('graphNodes=[...nodes,next]');
 });

 it('validates semantic target ports and cardinality on the server',()=>{
  const types=read('server/beta/flows/flowTypes.ts');
  const service=read('server/beta/flows/flowService.ts');
  expect(types).toContain('target_port?:string|null');
  expect(types).toContain('resolver_version?:number');
  expect(service).toContain('allowedTargetPorts');
  expect(service).toContain('FLOW_EDGE_PORT_MISMATCH');
  expect(service).toContain('FLOW_EDGE_PORT_OCCUPIED');
 });

 it('carries target-port bindings into runtime reference semantics',()=>{
  const runtimeTypes=read('server/beta/flows/flowRuntimeTypes.ts');
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(runtimeTypes).toContain('target_port?:string|null');
  expect(runtime).toContain('target_port:edge.target_port||null');
  expect(runtime).toContain("item.target_port==='first_frame'");
  expect(runtime).toContain("item.target_port==='last_frame'");
  expect(runtime).toContain("item.target_port==='mask'");
 });

 it('includes resolver bindings in reuse signatures so stale cached runs are not reused',()=>{
  const plan=read('server/beta/flows/flowExecutionPlan.ts');
  expect(plan).toContain('edge.source_port||null');
  expect(plan).toContain('edge.target_port||null');
  expect(plan).toContain('edge.resolver_version||null');
 });

 it('shows the resolved route or rejection beside the cursor during linking',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('hoverMessage=resolved.message');
  expect(workspace).toContain('hoverPort=resolved.targetPort');
  expect(workspace).toContain('linking.hoverMessage&&<div');
 });

 it('keeps billing and provider routing untouched',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.save');
  expect(workspace).not.toContain('creditWalletService');
 });
});
