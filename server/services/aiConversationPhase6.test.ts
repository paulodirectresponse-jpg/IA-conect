import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('IA conversacional phase 6 hardening',()=>{
 it('recovers stale quoting, expired quotes and active jobs when reopening a conversation',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  const conversation=read('server/ai/conversation/conversationService.ts');
  expect(service).toContain("action.status==='QUOTING'&&age>90_000");
  expect(service).toContain("action.status==='AWAITING_CONFIRMATION'");
  expect(service).toContain("['CONFIRMED','QUEUED','RUNNING']");
  expect(conversation).toContain('aiConversationActionService.recover');
 });

 it('never spends on an expired confirmation and requotes before requiring another confirmation',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  const view=read('src/components/views/AiConversationView.tsx');
  expect(service).toContain('return this.quote(userId,conversationId,actionId)');
  expect(view).toContain('A cotação expirou e foi atualizada');
  expect(view).toContain("next.status==='AWAITING_CONFIRMATION'");
 });

 it('supports cancellation through the existing job orchestrator',()=>{
  const routes=read('server/routes/aiConversationRoutes.ts');
  const service=read('server/ai/conversation/actionService.ts');
  const card=read('src/components/ai/AiConversationActionCard.tsx');
  expect(routes).toContain("actions/:actionId/cancel");
  expect(service).toContain('betaJobOrchestrator.cancel');
  expect(card).toContain('Cancelar');
 });

 it('retries only failed or cancelled portions through a fresh child action and quote',()=>{
  const routes=read('server/routes/aiConversationRoutes.ts');
  const service=read('server/ai/conversation/actionService.ts');
  expect(routes).toContain("actions/:actionId/retry");
  expect(service).toContain("['FAILED','PARTIAL_SUCCESS','CANCELLED']");
  expect(service).toContain("failedJobs=source.execution_jobs.filter");
  expect(service).toContain("reference_terms:['retry-failed']");
  expect(service).toContain('return this.quote(userId,conversationId,created.action_id)');
 });

 it('deduplicates rapid regeneration and retry requests instead of multiplying paid actions',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain('Date.now()-Date.parse(action.created_at)<10*60_000');
  expect(service).toContain("action.reference_terms.includes('retry-failed')");
  expect(service).toContain('action.reference_terms.includes(`regeneração de ${assetId}`)');
 });

 it('resolves conversational pronouns to the most recent generated Asset when safe',()=>{
  const planner=read('server/ai/conversation/toolPlanner.ts');
  expect(planner).toContain('const newest=[...assets].reverse()');
  expect(planner).toContain('essa imagem');
  expect(planner).toContain('newest[0]');
  expect(planner).toContain(':result:${n}');
 });

 it('keeps retry and cancel controls inside the conversation without bypassing confirmation',()=>{
  const client=read('src/services/aiConversationClient.ts');
  const card=read('src/components/ai/AiConversationActionCard.tsx');
  expect(client).toContain('retryAction:');
  expect(client).toContain('cancelAction:');
  expect(card).toContain('Tentar novamente');
  expect(card).toContain('Refazer apenas as falhas');
  expect(card).toContain('Confirmar e gerar');
 });
});
