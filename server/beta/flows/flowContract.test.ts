import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-12 Flow Editor contracts',()=>{
 it('defines input, asset, tool and output nodes plus typed edges',()=>{
  const types=read('server/beta/flows/flowTypes.ts');
  expect(types).toContain("'INPUT'|'ASSET'|'TOOL'|'OUTPUT'");
  expect(types).toContain('media_type:CapabilityMediaType');
  expect(types).toContain('capability_id?:CapabilityId|null');
 });
 it('supports optimistic revision locking',()=>{
  const service=read('server/beta/flows/flowService.ts');
  expect(service).toContain('expected_revision');
  expect(service).toContain('FLOW_REVISION_CONFLICT');
 });
 it('exposes authenticated CRUD only while beta.flows is enabled',()=>{
  const routes=read('server/routes/betaFlowRoutes.ts');
  expect(routes).toContain("getFeatureFlag('beta.flows')");
  expect(routes).toContain("betaFlowRouter.use('/beta/flows',requireAuth,requireFlows)");
  expect(routes).toContain("post('/beta/flows'");
  expect(routes).toContain("put('/beta/flows/:flowId'");
  expect(routes).toContain("delete('/beta/flows/:flowId'");
 });
 it('caps graph size before persistence',()=>{
  const service=read('server/beta/flows/flowService.ts');
  expect(service).toContain('rawNodes.length>100||rawEdges.length>200');
 });
});
