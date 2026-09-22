import{aiConversationRepository}from'./conversationRepository.js';
import type{AiConversationContext,AiConversationMessage,AiCreativeState,AiModelTurn}from'./conversationTypes.js';

const emptyCreativeState=():AiCreativeState=>({
 objective:null,product:null,audience:null,visual_style:null,narrative:null,
 characters:[],locations:[],continuity_notes:[],approved_decisions:[],rejected_decisions:[],
});
const list=(value:unknown)=>Array.isArray(value)?value.map(item=>String(item||'').trim()).filter(Boolean):[];
const uniq=(values:string[],limit=40)=>Array.from(new Set(values.map(value=>String(value||'').trim()).filter(Boolean))).slice(0,limit);
const mergeScalar=(current:string|null,next:unknown)=>typeof next==='string'&&next.trim()?next.trim().slice(0,1200):current;
const mergeCreative=(current:AiCreativeState,delta:Partial<AiCreativeState>):AiCreativeState=>({
 objective:mergeScalar(current.objective,delta.objective),
 product:mergeScalar(current.product,delta.product),
 audience:mergeScalar(current.audience,delta.audience),
 visual_style:mergeScalar(current.visual_style,delta.visual_style),
 narrative:mergeScalar(current.narrative,delta.narrative),
 characters:uniq([...(current.characters||[]),...list(delta.characters)]),
 locations:uniq([...(current.locations||[]),...list(delta.locations)]),
 continuity_notes:uniq([...(current.continuity_notes||[]),...list(delta.continuity_notes)]),
 approved_decisions:uniq([...(current.approved_decisions||[]),...list(delta.approved_decisions)],60),
 rejected_decisions:uniq([...(current.rejected_decisions||[]),...list(delta.rejected_decisions)],60),
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
 async registerAssets(userId:string,conversationId:string,actionId:string,assets:Array<{asset_id:string;name:string;type?:'IMAGE'|'VIDEO'|'AUDIO'|'MODEL_3D'}>){
  for(let attempt=0;attempt<3;attempt++){
   const versioned=await aiConversationRepository.getContextVersioned(userId,conversationId);
   const context=versioned?.context||await this.get(userId,conversationId);
   const kept=(context.references||[]).filter(ref=>!(ref.kind==='ASSET'&&assets.some(asset=>asset.asset_id===ref.asset_id)));
   const added=assets.map((asset,index)=>({label:asset.name||`resultado ${index+1}`,kind:'ASSET' as const,value:`action:${actionId}:result:${index+1}`,message_id:null,asset_id:asset.asset_id,asset_type:asset.type||null}));
   const next={...context,references:[...kept,...added].slice(-80)};
   if(!versioned)return aiConversationRepository.saveContext(userId,next);
   try{return await aiConversationRepository.saveContextConditional(userId,next,versioned.updateTime);}catch(error){if(attempt===2)throw error;}
  }
  throw Object.assign(new Error('Não foi possível atualizar o contexto da conversa.'),{code:'AI_CONTEXT_CONFLICT'});
 },
 async applyTurn(userId:string,context:AiConversationContext,turn:AiModelTurn,userMessage:AiConversationMessage){
  for(let attempt=0;attempt<3;attempt++){
   const versioned=await aiConversationRepository.getContextVersioned(userId,context.conversation_id);
   const base=versioned?.context||context;
   const refs=[...(base.references||[])];
   for(const term of turn.reference_terms||[]){
    const label=String(term||'').trim().slice(0,140);if(!label)continue;
    refs.push({label,kind:'TEXTUAL' as const,value:label,message_id:userMessage.message_id,asset_id:null,asset_type:null});
   }
   const next:AiConversationContext={
    ...base,
    summary:String(turn.conversation_summary||base.summary||'').trim().slice(0,9000),
    creative_state:mergeCreative(base.creative_state||emptyCreativeState(),turn.creative_state_delta||{}),
    references:refs.slice(-80),
    last_intent:turn.intent,
    readiness:turn.readiness,
    missing_information:uniq(list(turn.missing_information),16),
   };
   if(!versioned)return aiConversationRepository.saveContext(userId,next);
   try{return await aiConversationRepository.saveContextConditional(userId,next,versioned.updateTime);}catch(error){if(attempt===2)throw error;}
  }
  throw Object.assign(new Error('Não foi possível atualizar o contexto da conversa.'),{code:'AI_CONTEXT_CONFLICT'});
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
