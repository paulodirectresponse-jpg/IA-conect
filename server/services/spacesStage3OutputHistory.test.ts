import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces stage 3 persistent node output history',()=>{
 it('reuses persisted flow runs instead of creating a parallel history store',()=>{
  const repository=read('server/beta/flows/flowRuntimeRepository.ts');
  const routes=read('server/routes/spacesRoutes.ts');
  expect(repository).toContain("const RUNS='beta_flow_runs'");
  expect(repository).toContain("const NODES='beta_flow_node_runs'");
  expect(routes).toContain("'/spaces/flows/:flowId/runs'");
  expect(routes).toContain('listFlowPublic');
  expect(routes).not.toMatch(/spaces_history|node_output_history/);
 });

 it('filters a Space history before expanding node runs',()=>{
  const runtime=read('server/beta/flows/flowRuntimeService.ts');
  expect(runtime).toContain('listFlowPublic');
  const repository=read('server/beta/flows/flowRuntimeRepository.ts');
  expect(runtime).toContain('betaFlowRuntimeRepository.listFlowRuns(flowId,userId,limit)');
  expect(repository).toContain("fieldPath:'flow_id'");
  expect(repository).toContain("value:{stringValue:flowId}");
  expect(runtime).toContain('.map(publicRun)');
 });

 it('loads persisted history when the workspace opens and refreshes it after success',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const client=read('src/services/spacesClient.ts');
  expect(client).toContain('history:(flowId:string,limit=50)');
  expect(workspace).toContain('spacesClient.history(flow.flow_id,50)');
  expect(workspace).toContain('historyRuns');
  expect(workspace).toContain('loadHistory()');
  expect(workspace).toContain('Promise.all([loadAssets(),loadHistory()])');
 });

 it('rebuilds history per node from output_asset_ids and deduplicates live/current runs',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('nodeHistoryMap');
  expect(workspace).toContain('nodeRun.output_asset_ids');
  expect(workspace).toContain('historyRuns.filter(item=>item.run_id!==run?.run_id)');
  expect(workspace).toContain('seen.has(key)');
 });

 it('renders previous image/video outputs inside the node with navigation',()=>{
  const preview=read('src/components/spaces/nodes/NodeResultPreview.tsx');
  expect(preview).toContain('ChevronLeft');
  expect(preview).toContain('ChevronRight');
  expect(preview).toContain('items.length-safeIndex');
  expect(preview).toContain("asset.type==='IMAGE'");
  expect(preview).toContain('<video');
  expect(preview).toContain('As gerações anteriores ficam salvas neste card.');
 });

 it('keeps selected history output as UI state instead of graph persistence',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const flowTypes=read('server/beta/flows/flowTypes.ts');
  expect(workspace).toContain('historyIndexByNode');
  expect(workspace).toContain('setHistoryIndexByNode');
  expect(flowTypes).not.toContain('selected_output');
  expect(flowTypes).not.toContain('preview_url');
 });

 it('shows historical cost from the same node run without inventing pricing',()=>{
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  const preview=read('src/components/spaces/nodes/NodeResultPreview.tsx');
  expect(generator).toContain('selectedHistory?.authorized_credit_price');
  expect(preview).toContain('authorized_credit_price:number');
  expect(generator).toContain('Calculado ao executar');
 });
});