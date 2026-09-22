import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('IA conversacional phase 3 tool calling',()=>{
 it('uses the canonical capability registry instead of inventing a parallel tool catalog',()=>{
  const registry=read('server/ai/conversation/toolRegistry.ts');
  expect(registry).toContain("from'../../beta/capabilityRegistry.js'");
  expect(registry).toContain('CAPABILITY_IDS');
  expect(registry).toContain('getCapabilityDefinition');
  expect(registry).toContain('routingV2CatalogService.listCapabilityModels');
 });

 it('gives the LLM the real tool manifest and requires exact capability ids',()=>{
  const model=read('server/ai/conversation/conversationalModel.ts');
  expect(model).toContain('aiConversationToolRegistry.manifest()');
  expect(model).toContain('Nunca invente capability');
  expect(model).toContain('tool_request');
  expect(model).toContain('generation_prompt');
 });

 it('creates persisted action drafts only for ready actionable turns',()=>{
  const planner=read('server/ai/conversation/toolPlanner.ts');
  const repo=read('server/ai/conversation/conversationRepository.ts');
  expect(planner).toContain("turn.readiness!=='READY_FOR_ACTION'");
  expect(planner).toContain('aiConversationRepository.createAction');
  expect(repo).toContain("ACTIONS='ai_conversation_actions'");
  expect(repo).toContain('createAction');
  expect(repo).toContain('listActions');
 });

 it('checks actual READY model availability before declaring a tool usable',()=>{
  const registry=read('server/ai/conversation/toolRegistry.ts');
  const planner=read('server/ai/conversation/toolPlanner.ts');
  expect(registry).toContain("reason:models.length?'':'Nenhum modelo com Route READY está disponível para esta capability.'");
  expect(planner).toContain("status:availability.available?'DRAFT':'UNAVAILABLE'");
  expect(planner).toContain('compatible_model_ids:compatibleModelIds');
 });

 it('uses AUTO model strategy unless the user explicitly names an available model',()=>{
  const planner=read('server/ai/conversation/toolPlanner.ts');
  expect(planner).toContain("const modelId=explicit?.model_id||'AUTO'");
  expect(planner).toContain('model.name.toLowerCase()===preference');
 });

 it('does not pretend unresolved media references are available',()=>{
  const planner=read('server/ai/conversation/toolPlanner.ts');
  const model=read('server/ai/conversation/conversationalModel.ts');
  expect(planner).toContain('unresolved_references:unresolved');
  expect(model).toContain('Se faltar uma referência necessária, use NEEDS_CLARIFICATION');
 });

 it('returns action drafts with conversation history and renders them in chat',()=>{
  const service=read('server/ai/conversation/conversationService.ts');
  const client=read('src/services/aiConversationClient.ts');
  const view=read('src/components/views/AiConversationView.tsx');
  expect(service).toContain('listActions(userId,conversationId)');
  expect(service).toContain('aiConversationToolPlanner.plan');
  expect(client).toContain('AiConversationAction');
  expect(view).toContain('Ferramenta reconhecida e preparada');
  expect(view).toContain('action.generation_prompt');
 });

 it('keeps quote, credits and execution out of phase 3',()=>{
  const planner=read('server/ai/conversation/toolPlanner.ts');
  const service=read('server/ai/conversation/conversationService.ts');
  expect(planner).not.toContain('creditWallet');
  expect(planner).not.toContain('betaJobOrchestrator');
  expect(service).not.toContain('generationService');
  expect(service).not.toContain('creditWallet');
 });
});
