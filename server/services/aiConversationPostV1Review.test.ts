import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('IA conversacional post V1 review',()=>{
 it('does not truncate persisted conversation history or action history at arbitrary repository limits',()=>{
  const repo=read('server/ai/conversation/conversationRepository.ts');
  const messages=repo.slice(repo.indexOf('async listMessages'),repo.indexOf('async addMessage'));
  const actions=repo.slice(repo.indexOf('async listActions'),repo.indexOf('async getAction'));
  expect(messages).not.toContain('limit:500');
  expect(actions).not.toContain('limit:200');
 });

 it('protects concurrent context updates with Firestore compare-and-set writes',()=>{
  const repo=read('server/ai/conversation/conversationRepository.ts');
  const engine=read('server/ai/conversation/contextEngine.ts');
  expect(repo).toContain('getContextVersioned');
  expect(repo).toContain('saveContextConditional');
  expect(repo).toContain('currentDocument:{updateTime}');
  expect(engine).toContain('for(let attempt=0;attempt<3;attempt++)');
 });

 it('sanitizes malformed model arrays instead of spreading strings into creative state',()=>{
  const engine=read('server/ai/conversation/contextEngine.ts');
  expect(engine).toContain('const list=(value:unknown)=>Array.isArray(value)');
  expect(engine).toContain('...list(delta.characters)');
  expect(engine).toContain('...list(delta.approved_decisions)');
 });

 it('stores Asset media type and filters conversational references by compatible tool inputs',()=>{
  const types=read('server/ai/conversation/conversationTypes.ts');
  const engine=read('server/ai/conversation/contextEngine.ts');
  const planner=read('server/ai/conversation/toolPlanner.ts');
  expect(types).toContain("asset_type:'IMAGE'|'VIDEO'|'AUDIO'|'MODEL_3D'|null");
  expect(engine).toContain('asset_type:asset.type||null');
  expect(planner).toContain('allowedTypes.includes(ref.asset_type)');
  expect(planner).toContain("input==='MASK'?'IMAGE':input");
 });

 it('normalizes invalid quantities from the model to one output',()=>{
  const planner=read('server/ai/conversation/toolPlanner.ts');
  expect(planner).toContain('Number.isFinite(Number(request.quantity))');
  expect(planner).toContain(':1');
 });

 it('blocks actions after the parent conversation is deleted or inaccessible',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain('const conversation=await aiConversationRepository.get(userId,conversationId)');
  expect(service).toContain("AI_CONVERSATION_NOT_FOUND");
 });

 it('allows legitimate zero-credit quotes to be confirmed',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain('action.quote_credit_price===null');
  expect(service).not.toContain('||!action.quote_credit_price)');
 });

 it('clears a fixed seed when selectively regenerating one result',()=>{
  const service=read('server/ai/conversation/actionService.ts');
  expect(service).toContain('controls:{...source.controls,seed:null}');
 });
});
