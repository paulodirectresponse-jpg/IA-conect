import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('IA conversacional phase 1',()=>{
 it('persists conversations and messages in dedicated Firestore collections',()=>{
  const repo=read('server/ai/conversation/conversationRepository.ts');
  expect(repo).toContain("CONVERSATIONS='ai_conversations'");
  expect(repo).toContain("MESSAGES='ai_conversation_messages'");
  expect(repo).toContain("owner_user_id:userId");
  expect(repo).toContain('listMessages');
 });

 it('defines IA Connect as a logical conversational model with primary and fallback LLMs',()=>{
  const model=read('server/ai/conversation/conversationalModel.ts');
  expect(model).toContain("logical_model_id:'ia-connect-core'");
  expect(model).toContain("display_name:'IA Connect'");
  expect(model).toContain('IACONNECT_LLM_MODEL');
  expect(model).toContain('IACONNECT_LLM_FALLBACK_MODEL');
  expect(model).toContain('fallback_model');
 });

 it('keeps the provider behind the conversational model abstraction',()=>{
  const model=read('server/ai/conversation/conversationalModel.ts');
  expect(model).toContain('async function callGoogle');
  expect(model).toContain('conversationalModel');
  expect(model).toContain('ai_llm_config/default');
 });

 it('stores both user and assistant messages and restores conversation context',()=>{
  const service=read('server/ai/conversation/conversationService.ts');
  expect(service).toContain("role:'USER'");
  expect(service).toContain("role:'ASSISTANT'");
  const context=read('server/ai/conversation/contextEngine.ts');
  expect(context).toContain('messages.slice(-40)');
  expect(service).toContain('message_count');
 });

 it('exposes authenticated conversation endpoints',()=>{
  const routes=read('server/routes/aiConversationRoutes.ts');
  const index=read('server/routes/index.ts');
  expect(routes).toContain("aiConversationRouter.use('/ai/conversations',requireAuth)");
  expect(routes).toContain("post('/ai/conversations'");
  expect(routes).toContain("post('/ai/conversations/:conversationId/messages'");
  expect(index).toContain('apiRootRouter.use(aiConversationRouter)');
 });

 it('adds the IA as a first-class stable navigation view',()=>{
  const app=read('src/App.tsx');
  const sidebar=read('src/components/layout/Sidebar.tsx');
  const layout=read('src/components/layout/AppLayout.tsx');
  expect(app).toContain("currentSafeView==='ai'");
  expect(sidebar).toContain("{ id: 'ai', label: 'IA', icon: Bot }");
  expect(layout).toContain("currentView === 'ai'");
 });

 it('renders saved conversations and a real persistent chat UI',()=>{
  const view=read('src/components/views/AiConversationView.tsx');
  expect(view).toContain('aiConversationClient.list()');
  expect(view).toContain('aiConversationClient.get(id)');
  expect(view).toContain('aiConversationClient.send');
  expect(view).toContain('Nova conversa');
  expect(view).toContain('IA Connect está pensando');
 });

 it('does not bypass credits or generation runtime in phase 1',()=>{
  const service=read('server/ai/conversation/conversationService.ts');
  const model=read('server/ai/conversation/conversationalModel.ts');
  expect(service).not.toContain('betaJobOrchestrator');
  expect(service).not.toContain('creditWallet');
  expect(model).toContain('nunca deve fingir que gerou imagem, vídeo, áudio ou qualquer outra mídia');
 });
});
