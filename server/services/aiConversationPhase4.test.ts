import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('IA conversacional phase 4 quote confirmation credits',()=>{
 it('uses the existing beta job orchestrator instead of creating a parallel credits runtime',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain("from'../../beta/jobs/jobOrchestrator.js'");
  expect(service).toContain('betaJobOrchestrator.create');
  expect(service).toContain('betaJobOrchestrator.quote');
  expect(service).toContain('betaJobOrchestrator.queue');
  expect(service).toContain('creditWalletService.simulateReserve');
 });

 it('resolves AUTO to a real compatible model before creating the job',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain('routingV2AutoModelSelectionService.select');
  expect(service).toContain("if(action.model_id!=='AUTO')return action.model_id");
  expect(service).toContain('selected_model_id:modelId');
 });

 it('never quotes media actions while references are unresolved',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain("AI_ACTION_REFERENCE_REQUIRED");
  expect(service).toContain('action.unresolved_references.length');
 });

 it('persists a server-authoritative immutable quote snapshot before confirmation',()=>{
  const types=read('server/ai/conversation/conversationTypes.ts');
  const service=read('server/ai/conversation/actionService.ts');
  expect(types).toContain("'AWAITING_CONFIRMATION'");
  expect(types).toContain('quote_credit_price:number|null');
  expect(types).toContain('quote_expires_at:string|null');
  expect(service).toContain("status:'AWAITING_CONFIRMATION'");
  expect(service).toContain('Number(quoted.quote.credit_price)');
 });

 it('does not queue or spend until an explicit confirm endpoint is called',()=>{
  const routes=read('server/routes/aiConversationRoutes.ts');
  const service=read('server/ai/conversation/actionService.ts');
  expect(routes).toContain("actions/:actionId/confirm");
  expect(service).toContain("status!=='AWAITING_CONFIRMATION'");
  expect(service).toContain("status:'CONFIRMED'");
  expect(service).toContain('betaJobOrchestrator.queue');
 });

 it('rejects expired quotes and keeps confirmation tied to the quoted job',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain('AI_ACTION_QUOTE_EXPIRED');
  expect(service).toContain('action.job_id');
  expect(service).toContain('ai-action-queue:${action.action_id}:${index}:${item.job_id}');
 });

 it('exposes quote confirmation and refresh endpoints to the stable client',()=>{
  const client=read('src/services/aiConversationClient.ts');
  expect(client).toContain('quoteAction:');
  expect(client).toContain('confirmAction:');
  expect(client).toContain('refreshAction:');
 });

 it('quotes automatically and only requires the final Confirmar e gerar click',()=>{
  const conversation=read('server/ai/conversation/conversationService.ts');
  const view=read('src/components/views/AiConversationView.tsx');
  const card=read('src/components/ai/AiConversationActionCard.tsx');
  expect(conversation).toContain("action.status==='DRAFT'&&!action.unresolved_references.length");
  expect(conversation).toContain('aiConversationActionService.quote');
  expect(view).not.toContain('Calcular créditos');
  expect(card).toContain('Custo confirmado');
  expect(card).toContain('Confirmar e gerar');
  expect(card).toContain('Nenhum crédito é gasto antes desta confirmação.');
 });

 it('polls queued and running actions and exposes terminal results',()=>{
  const view=read('src/components/views/AiConversationView.tsx');
  const service=read('server/ai/conversation/actionService.ts');
  expect(view).toContain("['QUEUED','RUNNING','CONFIRMED']");
  expect(view).toContain('refreshAction');
  expect(service).toContain("statuses.every(status=>status==='SUCCEEDED')");
  expect(service).toContain('result_asset_ids:job.result_asset_ids||[]');
 });
});
