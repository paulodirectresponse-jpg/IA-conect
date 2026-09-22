import{aiConversationRepository}from'./conversationRepository.js';
import type{AiConversationContext,AiConversationMessage,AiCreativeState,AiModelTurn}from'./conversationTypes.js';

const emptyCreativeState=():AiCreativeState=>({
 objective:null,product:null,audience:null,visual_style:null,narrative:null,
 characters:[],locations:[],continuity_notes:[],approved_decisions:[],rejected_decisions:[],
});
const uniq=(values:string[],limit=40)=>Array.from(new Set(values.map(value=>String(value||'').trim()).filter(Boolean))).slice(0,limit);
const mergeScalar=(current:string|null,next:unknown)=>typeof next==='string'&&next.trim()?next.trim().slice(0,1200):current;
const mergeCreative=(current:AiCreativeState,delta:Partial<AiCreativeState>):AiCreativeState=>({
 objective:mergeScalar(current.objective,delta.objective),
 product:mergeScalar(current.product,delta.product),
 audience:mergeScalar(current.audience,delta.audience),
 visual_style:mergeScalar(current.visual_style,delta.visual_style),
 narrative:mergeScalar(current.narrative,delta.narrative),
 characters:uniq([...(current.characters||[]),...((delta.characters||[]) as string[])]),
 locations:uniq([...(current.locations||[]),...((delta.locations||[]) as string[])]),
 continuity_notes:uniq([...(current.continuity_notes||[]),...((delta.continuity_notes||[]) as string[])]),
 approved_decisions:uniq([...(current.approved_decisions||[]),...((delta.approved_decisions||[]) as string[])],60),
 rejected_decisions:uniq([...(current.rejected_decisions||[]),...((delta.rejected_decisions||[]) as string[])],60),
});

export const aiConversationContextEngine={
 async get(userId:string,conversationId:string){
  const existing=await aiConversationRepository.getContext(userId,conversationId);
  if(existing)return existing;
  return aiConversationRepository.createContext({
   conversation_id:conversationId,owner_user_id:userId,summary:'',creative_state:emptyCreativeState(),references:[],
   last_intent:'GENERAL_CONVERSATION',readiness:'CONVERSATION',missing_information:[],
  });
 },
 async build(userId:string,conversationId:string,messages:AiConversationMessage[]){
  const context=await this.get(userId,conversationId);
  return{context,recent_messages:messages.slice(-40)};
 },
 async registerAssets(userId:string,conversationId:string,actionId:string,assets:Array<{asset_id:string;name:string}>){
  const context=await this.get(userId,conversationId);
  const kept=(context.references||[]).filter(ref=>!(ref.kind==='ASSET'&&assets.some(asset=>asset.asset_id===ref.asset_id)));
  const added=assets.map((asset,index)=>({label:asset.name||`resultado ${index+1}`,kind:'ASSET' as const,value:`action:${actionId}:result:${index+1}`,message_id:null,asset_id:asset.asset_id}));
  return aiConversationRepository.saveContext(userId,{...context,references:[...kept,...added].slice(-80)});
 },
 async applyTurn(userId:string,context:AiConversationContext,turn:AiModelTurn,userMessage:AiConversationMessage){
  const refs=[...(context.references||[])];
  for(const term of turn.reference_terms||[]){
   const label=String(term||'').trim().slice(0,140);if(!label)continue;
   refs.push({label,kind:'TEXTUAL' as const,value:label,message_id:userMessage.message_id,asset_id:null});
  }
  const next:AiConversationContext={
   ...context,
   summary:String(turn.conversation_summary||context.summary||'').trim().slice(0,9000),
   creative_state:mergeCreative(context.creative_state||emptyCreativeState(),turn.creative_state_delta||{}),
   references:refs.slice(-80),
   last_intent:turn.intent,
   readiness:turn.readiness,
   missing_information:uniq(turn.missing_information||[],16),
  };
  return aiConversationRepository.saveContext(userId,next);
 },
};

export function contextPrompt(context:AiConversationContext){
 const state=context.creative_state||emptyCreativeState();
 return [
  'CONTEXTO PERSISTENTE DA CONVERSA:',
  context.summary?'Resumo: '+context.summary:'Resumo: ainda não há resumo consolidado.',
  'Objetivo: '+(state.objective||'não definido'),
  'Produto/tema: '+(state.product||'não definido'),
  'Público: '+(state.audience||'não definido'),
  'Estilo visual: '+(state.visual_style||'não definido'),
  'Narrativa: '+(state.narrative||'não definida'),
  'Personagens: '+((state.characters||[]).join(', ')||'nenhum definido'),
  'Locações: '+((state.locations||[]).join(', ')||'nenhuma definida'),
  'Continuidade: '+((state.continuity_notes||[]).join(' | ')||'nenhuma'),
  'Decisões aprovadas: '+((state.approved_decisions||[]).join(' | ')||'nenhuma'),
  'Decisões rejeitadas: '+((state.rejected_decisions||[]).join(' | ')||'nenhuma'),
  'Referências textuais recentes: '+((context.references||[]).slice(-12).map(ref=>ref.label).join(' | ')||'nenhuma'),
 ].join('\n');
}
