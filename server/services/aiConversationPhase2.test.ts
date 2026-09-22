import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('IA conversacional phase 2 context and intent',()=>{
 it('persists one structured context document per conversation',()=>{
  const repo=read('server/ai/conversation/conversationRepository.ts');
  const types=read('server/ai/conversation/conversationTypes.ts');
  expect(repo).toContain("CONTEXTS='ai_conversation_context'");
  expect(repo).toContain('getContext');
  expect(repo).toContain('saveContext');
  expect(types).toContain('interface AiConversationContext');
 });

 it('maintains a compact creative state and recent-message context window',()=>{
  const engine=read('server/ai/conversation/contextEngine.ts');
  expect(engine).toContain('messages.slice(-40)');
  expect(engine).toContain('approved_decisions');
  expect(engine).toContain('rejected_decisions');
  expect(engine).toContain('continuity_notes');
  expect(engine).toContain('conversation_summary');
 });

 it('classifies conversational and generation intents without executing tools',()=>{
  const types=read('server/ai/conversation/conversationTypes.ts');
  const model=read('server/ai/conversation/conversationalModel.ts');
  expect(types).toContain("'IMAGE_GENERATION'");
  expect(types).toContain("'VIDEO_GENERATION'");
  expect(types).toContain("'BATCH_GENERATION'");
  expect(model).toContain('READY_FOR_ACTION');
  expect(model).toContain('NEEDS_CLARIFICATION');
  expect(model).toContain('A plataforma calcula o custo automaticamente e exige confirmação do usuário antes de qualquer execução paga.');
 });

 it('uses a single structured model turn for answer, intent, summary and state deltas',()=>{
  const model=read('server/ai/conversation/conversationalModel.ts');
  expect(model).toContain("responseMimeType:'application/json'");
  expect(model).toContain('assistant_response');
  expect(model).toContain('creative_state_delta');
  expect(model).toContain('reference_terms');
 });

 it('feeds persisted context back into every LLM turn',()=>{
  const model=read('server/ai/conversation/conversationalModel.ts');
  const engine=read('server/ai/conversation/contextEngine.ts');
  expect(model).toContain('contextPrompt(context)');
  expect(engine).toContain('CONTEXTO PERSISTENTE DA CONVERSA');
  expect(engine).toContain('Decisões aprovadas');
 });

 it('stores reference terms so later phases can resolve expressions such as frame 3 or this image',()=>{
  const engine=read('server/ai/conversation/contextEngine.ts');
  expect(engine).toContain("kind:'TEXTUAL'");
  expect(engine).toContain('reference_terms');
  expect(engine).toContain('references:refs.slice(-80)');
 });

 it('returns context and readiness to the stable client and UI',()=>{
  const client=read('src/services/aiConversationClient.ts');
  const view=read('src/components/views/AiConversationView.tsx');
  expect(client).toContain('AiConversationContext');
  expect(client).toContain('AiIntentReadiness');
  expect(view).toContain('Pedido entendido');
  expect(view).toContain('Faltam detalhes');
  expect(view).toContain('setContext(result.context)');
 });

 it('preserves credits, jobs and generation runtime for later phases',()=>{
  const service=read('server/ai/conversation/conversationService.ts');
  expect(service).not.toContain('betaJobOrchestrator');
  expect(service).not.toContain('creditWallet');
  expect(service).not.toContain('generationService');
 });
});
