import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('IA conversacional phase 5 results batch selective regeneration',()=>{
 it('supports batches up to 16 outputs by splitting execution into safe job chunks',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain('Math.min(16');
  expect(service).toContain('while(left>0)');
  expect(service).toContain('Math.min(4,left)');
  expect(service).toContain('executionJobs.push');
 });

 it('quotes the complete batch and verifies aggregate wallet balance before confirmation',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain('executionJobs.reduce((sum,item)=>sum+item.credit_price,0)');
  expect(service).toContain('creditWalletService.simulateReserve(userId,total)');
  expect(service).toContain('CREDIT_INSUFFICIENT_FUNDS');
 });

 it('preserves partial execution state instead of losing successful jobs',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  const types=read('server/ai/conversation/conversationTypes.ts');
  expect(service).toContain('Promise.allSettled');
  expect(service).toContain("'PARTIAL_SUCCESS'");
  expect(types).toContain("'PARTIAL_SUCCESS'");
 });

 it('hydrates generated universal Assets and renders media directly inside the conversation',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  const card=read('src/components/ai/AiConversationActionCard.tsx');
  expect(service).toContain('assetRepository.getAsset');
  expect(service).toContain('result_assets:resultAssets');
  expect(card).toContain("asset.type==='IMAGE'");
  expect(card).toContain("asset.type==='VIDEO'");
  expect(card).toContain("asset.type==='AUDIO'");
 });

 it('registers generated Assets back into persistent conversation context',()=>{
  const engine=read('server/ai/conversation/contextEngine.ts');
  const service=read('server/ai/conversation/actionService.ts');
  expect(engine).toContain("kind:'ASSET'");
  expect(engine).toContain('registerAssets');
  expect(service).toContain('aiConversationContextEngine.registerAssets');
 });

 it('resolves references such as resultado 2 to real Asset ids for later tools',()=>{
  const planner=read('server/ai/conversation/toolPlanner.ts');
  const service=read('server/ai/conversation/actionService.ts');
  expect(planner).toContain('resolveAssetReferences');
  expect(planner).toContain(':result:${n}');
  expect(planner).toContain('resolved_references:resolvedInfo.resolved');
  expect(service).toContain('references:action.resolved_references');
 });

 it('allows selective regeneration of one generated result with a fresh quote',()=>{
  const routes=read('server/routes/aiConversationRoutes.ts');
  const service=read('server/ai/conversation/actionService.ts');
  const client=read('src/services/aiConversationClient.ts');
  expect(routes).toContain("actions/:actionId/regenerate");
  expect(service).toContain('source.result_asset_ids.includes(assetId)');
  expect(service).toContain('parent_action_id:source.action_id');
  expect(service).toContain('return this.quote(userId,conversationId,created.action_id)');
  expect(client).toContain('regenerateResult:');
 });

 it('supports more than one action card attached to the same assistant message',()=>{
  const view=read('src/components/views/AiConversationView.tsx');
  expect(view).toContain('actions.filter(item=>item.message_id===message.message_id)');
  expect(view).toContain('messageActions.map');
  expect(view).toContain('AiConversationActionCard');
 });

 it('keeps paid execution behind explicit confirmation even for regenerated outputs',()=>{
  const card=read('src/components/ai/AiConversationActionCard.tsx');
  const service=read('server/ai/conversation/actionService.ts');
  expect(card).toContain('Confirmar e gerar');
  expect(card).toContain('Nenhum crédito é gasto antes desta confirmação.');
  expect(service).toContain("status!=='AWAITING_CONFIRMATION'");
 });
});
