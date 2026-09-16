import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-12 Flow Editor V1 architecture',()=>{
 it('persists drafts and immutable revisions in dedicated Beta collections',()=>{
  const repo=read('server/beta/flows/flowRepository.ts');
  expect(repo).toContain("collectionId:'beta_flows'");
  expect(repo).toContain('beta_flow_versions/');
  expect(repo).toContain('currentDocument:{exists:false}');
  expect(repo).toContain('revision=current.revision+1');
 });
 it('enforces ownership for asset nodes and project association',()=>{
  const service=read('server/beta/flows/flowService.ts');
  expect(service).toContain('assetRepository.getAsset(node.asset_id,userId)');
  expect(service).toContain('betaLibraryRepository.getProject(projectId,userId)');
 });
 it('validates typed edges and rejects cycles server-side',()=>{
  const service=read('server/beta/flows/flowService.ts');
  expect(service).toContain('FLOW_EDGE_TYPE_MISMATCH');
  expect(service).toContain('FLOW_CYCLE');
  expect(service).toContain('assertAcyclic(nodes,edges)');
 });
 it('validates tool nodes through the governed capability catalog',()=>{
  const service=read('server/beta/flows/flowService.ts');
  expect(service).toContain('betaCatalogPolicyService.eligibleModels');
  expect(service).toContain('betaCatalogPolicyService.resolveModel');
  expect(service).toContain('validateModelCapability');
 });
 it('does not execute jobs or charge credits in the editor phase',()=>{
  const service=read('server/beta/flows/flowService.ts');
  const routes=read('server/routes/betaFlowRoutes.ts');
  const ui=read('src/beta/views/BetaFlowsView.tsx');
  const combined=service+routes+ui;
  expect(combined).not.toMatch(/createAndStartGeneration|reserveForGeneration|captureForGeneration|betaJobClient\.queue/);
 });
 it('keeps providers out of the Flow React surface',()=>{
  const ui=read('src/beta/views/BetaFlowsView.tsx');
  expect(ui).not.toMatch(/wavespeed|atlas|provider_id|provider_model_identifier/i);
 });
 it('lazy-loads Flows and preserves Stable app isolation',()=>{
  const beta=read('src/beta/BetaApp.tsx');
  const stable=read('src/App.tsx');
  expect(beta).toContain("lazy(()=>import('./views/BetaFlowsView.js')");
  expect(stable).not.toContain('BetaFlowsView');
  expect(stable).not.toContain('flowClient');
 });
 it('ships mobile layout and touch-safe node dragging',()=>{
  const css=read('src/beta/styles/beta.css');
  const ui=read('src/beta/views/BetaFlowsView.tsx');
  expect(css).toContain('.ia-beta-flow-stage');
  expect(css).toContain('touch-action:none');
  expect(css).toContain('@media(max-width:767px)');
  expect(ui).toContain('onPointerMove={pointerMove}');
 });
});
