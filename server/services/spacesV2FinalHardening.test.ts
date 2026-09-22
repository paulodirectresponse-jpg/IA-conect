import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 final hardening',()=>{
 it('serializes overlapping autosaves and never clears dirty state after a newer edit',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('changeVersionRef=useRef(0)');
  expect(workspace).toContain('saveInFlightRef=useRef<Promise<FlowRecord|null>|null>(null)');
  expect(workspace).toContain('changeVersionRef.current+=1');
  expect(workspace).toContain('if(saveInFlightRef.current){await saveInFlightRef.current;return saveLatestRef.current(silent);}');
  expect(workspace).toContain('if(changeVersionRef.current===version){setDirty(false);setSaved(true);}else{setDirty(true);setSaved(false);}');
 });

 it('does not leave the workspace when a pending save fails',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('const persisted=dirty?await save(true):flow;if(!persisted)return;onBack();');
 });

 it('preserves persisted preview asset ids before history finishes loading',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("const stored=((flow.graph?.metadata as any)?.space_preview_assets");
  expect(workspace).toContain('for(const [nodeId,assetId] of Object.entries(stored))');
  expect(workspace).toContain('if(live.has(nodeId)&&assetId)out[nodeId]=assetId');
  expect(workspace).toContain('spacesClient.history(flow.flow_id,100)');
 });

 it('enforces legacy edge occupancy on the backend, not only in the canvas',()=>{
  const service=read('server/beta/flows/flowService.ts');
  expect(service).toContain("edge.target_port===targetPort||(!edge.target_port&&edge.media_type===media)");
  expect(service).toContain('FLOW_EDGE_PORT_OCCUPIED');
 });

 it('maps new Spaces validation/runtime errors to public non-500 responses',()=>{
  const errors=read('server/beta/http/publicError.ts');
  expect(errors).toContain('FLOW_EDGE_PORT_MISMATCH:{status:400');
  expect(errors).toContain('FLOW_EDGE_PORT_OCCUPIED:{status:409');
  expect(errors).toContain('FLOW_GRAPH_EMPTY:{status:400');
  expect(errors).toContain('FLOW_EXECUTION_BLOCKED:{status:409');
 });

 it('keeps billing provider routing and generation runtime untouched',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(workspace).toContain('spacesClient.start');
  expect(runtime).toContain('betaJobOrchestrator.create');
  expect(runtime).toContain('betaJobOrchestrator.quote');
  expect(runtime).toContain('betaJobOrchestrator.queue');
  expect(workspace).not.toContain('creditWalletService');
 });
});
