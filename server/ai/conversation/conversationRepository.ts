import crypto from'crypto';
import{firestoreAdminRest}from'../../repositories/firestoreAdminRest.js';
import type{AiConversationActionDraft,AiConversationContext,AiConversationMessage,AiConversationRecord}from'./conversationTypes.js';

const CONVERSATIONS='ai_conversations',MESSAGES='ai_conversation_messages',CONTEXTS='ai_conversation_context',ACTIONS='ai_conversation_actions';
const safe=(v:string)=>encodeURIComponent(v),now=()=>new Date().toISOString();
const conversationId=()=>`conv_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
const messageId=()=>`msg_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
const actionId=()=>`act_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;

export const aiConversationRepository={
 async list(userId:string){
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId:CONVERSATIONS}],where:{fieldFilter:{field:{fieldPath:'owner_user_id'},op:'EQUAL',value:{stringValue:userId}}},limit:200});
  return rows.map((row:any)=>row.data as AiConversationRecord).filter(row=>!row.deleted_at).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
 },
 async get(userId:string,id:string){
  const doc=await firestoreAdminRest.get(`${CONVERSATIONS}/${safe(id)}`);
  if(!doc.exists)return null;
  const row=doc.data as AiConversationRecord;
  return row.owner_user_id===userId&&!row.deleted_at?row:null;
 },
 async create(userId:string,logicalModelId:string,title='Nova conversa'){
  const timestamp=now(),row:AiConversationRecord={conversation_id:conversationId(),owner_user_id:userId,title,logical_model_id:logicalModelId,message_count:0,created_at:timestamp,updated_at:timestamp,deleted_at:null};
  await firestoreAdminRest.set(`${CONVERSATIONS}/${safe(row.conversation_id)}`,row);
  return row;
 },
 async saveConversation(row:AiConversationRecord){
  const next={...row,updated_at:now()};
  await firestoreAdminRest.set(`${CONVERSATIONS}/${safe(row.conversation_id)}`,next);
  return next;
 },
 async remove(row:AiConversationRecord){
  const next={...row,deleted_at:now(),updated_at:now()};
  await firestoreAdminRest.set(`${CONVERSATIONS}/${safe(row.conversation_id)}`,next);
  return next;
 },
 async listMessages(conversationIdValue:string){
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId:MESSAGES}],where:{fieldFilter:{field:{fieldPath:'conversation_id'},op:'EQUAL',value:{stringValue:conversationIdValue}}},limit:500});
  return rows.map((row:any)=>row.data as AiConversationMessage).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
 },
 async addMessage(input:Omit<AiConversationMessage,'message_id'|'created_at'>){
  const row:AiConversationMessage={...input,message_id:messageId(),created_at:now()};
  await firestoreAdminRest.set(`${MESSAGES}/${safe(row.message_id)}`,row);
  return row;
 },
 async getContext(userId:string,conversationIdValue:string){
  const doc=await firestoreAdminRest.get(`${CONTEXTS}/${safe(conversationIdValue)}`);
  if(!doc.exists)return null;
  const row=doc.data as AiConversationContext;
  return row.owner_user_id===userId?row:null;
 },
 async createContext(input:Omit<AiConversationContext,'revision'|'created_at'|'updated_at'>){
  const timestamp=now();const row:AiConversationContext={...input,revision:1,created_at:timestamp,updated_at:timestamp};
  await firestoreAdminRest.set(`${CONTEXTS}/${safe(row.conversation_id)}`,row);return row;
 },
 async saveContext(userId:string,row:AiConversationContext){
  if(row.owner_user_id!==userId)throw Object.assign(new Error('Contexto da conversa inválido.'),{code:'AI_CONVERSATION_CONTEXT_FORBIDDEN'});
  const next={...row,revision:row.revision+1,updated_at:now()};
  await firestoreAdminRest.set(`${CONTEXTS}/${safe(row.conversation_id)}`,next);return next;
 },
 async createAction(input:Omit<AiConversationActionDraft,'action_id'|'created_at'|'updated_at'>){
  const timestamp=now();const row:AiConversationActionDraft={...input,action_id:actionId(),created_at:timestamp,updated_at:timestamp};
  await firestoreAdminRest.set(`${ACTIONS}/${safe(row.action_id)}`,row);return row;
 },
 async listActions(userId:string,conversationIdValue:string){
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId:ACTIONS}],where:{fieldFilter:{field:{fieldPath:'conversation_id'},op:'EQUAL',value:{stringValue:conversationIdValue}}},limit:200});
  return rows.map((row:any)=>row.data as AiConversationActionDraft).filter(row=>row.owner_user_id===userId).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
 },
};
