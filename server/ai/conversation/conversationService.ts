import{aiConversationRepository}from'./conversationRepository.js';
import{conversationalModel}from'./conversationalModel.js';

const clean=(v:any,max:number)=>String(v||'').trim().slice(0,max);
function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
const titleFrom=(message:string)=>{const one=message.replace(/\s+/g,' ').trim();return one.length>58?`${one.slice(0,55)}...`:one||'Nova conversa';};

export const aiConversationService={
 async list(userId:string){return aiConversationRepository.list(userId);},
 async get(userId:string,conversationId:string){
  const conversation=await aiConversationRepository.get(userId,conversationId);
  if(!conversation)fail('AI_CONVERSATION_NOT_FOUND','Conversa não encontrada.');
  const messages=(await aiConversationRepository.listMessages(conversationId)).filter(message=>message.owner_user_id===userId);
  return{conversation,messages};
 },
 async create(userId:string){
  const cfg=await conversationalModel.getConfig();
  return aiConversationRepository.create(userId,cfg.logical_model_id);
 },
 async remove(userId:string,conversationId:string){
  const conversation=await aiConversationRepository.get(userId,conversationId);
  if(!conversation)fail('AI_CONVERSATION_NOT_FOUND','Conversa não encontrada.');
  return aiConversationRepository.remove(conversation);
 },
 async send(userId:string,conversationId:string,input:any){
  const content=clean(input?.content,12000);
  if(!content)fail('AI_MESSAGE_REQUIRED','Escreva uma mensagem para continuar.');
  let conversation=await aiConversationRepository.get(userId,conversationId);
  if(!conversation)fail('AI_CONVERSATION_NOT_FOUND','Conversa não encontrada.');
  const userMessage=await aiConversationRepository.addMessage({conversation_id:conversationId,owner_user_id:userId,role:'USER',content,model_id:null});
  if(conversation.message_count===0)conversation={...conversation,title:titleFrom(content)};
  conversation=await aiConversationRepository.saveConversation({...conversation,message_count:conversation.message_count+1});
  const history=(await aiConversationRepository.listMessages(conversationId)).filter(message=>message.owner_user_id===userId).slice(-40);
  const response=await conversationalModel.reply(history);
  const assistantMessage=await aiConversationRepository.addMessage({conversation_id:conversationId,owner_user_id:userId,role:'ASSISTANT',content:response.content,model_id:response.model_id});
  conversation=await aiConversationRepository.saveConversation({...conversation,message_count:conversation.message_count+1,logical_model_id:response.logical_model_id});
  return{conversation,user_message:userMessage,assistant_message:assistantMessage};
 },
 async model(){
  const cfg=await conversationalModel.getConfig();
  return{logical_model_id:cfg.logical_model_id,display_name:cfg.display_name,enabled:cfg.enabled};
 },
};
