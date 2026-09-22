import React,{useEffect,useRef,useState}from'react';
import{Bot,LoaderCircle,MessageSquarePlus,PanelLeftClose,PanelLeftOpen,Send,Trash2}from'lucide-react';
import{ApiError}from'../../services/apiClient.js';
import{aiConversationClient,type AiConversation,type AiConversationContext,type AiConversationMessage}from'../../services/aiConversationClient.js';

const errText=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir a operação.';
const time=(iso:string)=>{const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});};

export const AiConversationView:React.FC=()=>{
 const[conversations,setConversations]=useState<AiConversation[]>([]);
 const[current,setCurrent]=useState<AiConversation|null>(null);
 const[messages,setMessages]=useState<AiConversationMessage[]>([]);
 const[context,setContext]=useState<AiConversationContext|null>(null);
 const[input,setInput]=useState('');
 const[loading,setLoading]=useState(true);
 const[opening,setOpening]=useState(false);
 const[sending,setSending]=useState(false);
 const[creating,setCreating]=useState(false);
 const[error,setError]=useState('');
 const[sidebarOpen,setSidebarOpen]=useState(true);
 const endRef=useRef<HTMLDivElement|null>(null);

 const refresh=async()=>{const rows=await aiConversationClient.list();setConversations(rows);return rows;};
 const open=async(id:string)=>{setOpening(true);setError('');try{const detail=await aiConversationClient.get(id);setCurrent(detail.conversation);setMessages(detail.messages);setContext(detail.context);}catch(e){setError(errText(e));}finally{setOpening(false);}};
 useEffect(()=>{let active=true;(async()=>{try{const rows=await aiConversationClient.list();if(!active)return;setConversations(rows);if(rows[0])await open(rows[0].conversation_id);}catch(e){if(active)setError(errText(e));}finally{if(active)setLoading(false);}})();return()=>{active=false};},[]);
 useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages,sending]);

 const create=async()=>{if(creating)return;setCreating(true);setError('');try{const conversation=await aiConversationClient.create();setConversations(rows=>[conversation,...rows]);setCurrent(conversation);setMessages([]);setContext(null);setInput('');if(window.innerWidth<900)setSidebarOpen(false);}catch(e){setError(errText(e));}finally{setCreating(false);}};
 const remove=async(conversation:AiConversation)=>{if(!window.confirm(`Excluir "${conversation.title}"?`))return;setError('');try{await aiConversationClient.remove(conversation.conversation_id);const rows=await refresh();if(current?.conversation_id===conversation.conversation_id){setCurrent(null);setMessages([]);setContext(null);if(rows[0])await open(rows[0].conversation_id);}}catch(e){setError(errText(e));}};
 const send=async()=>{const content=input.trim();if(!content||sending)return;let conversation=current;setError('');setInput('');setSending(true);try{
   if(!conversation){conversation=await aiConversationClient.create();setCurrent(conversation);setConversations(rows=>[conversation!,...rows]);}
   const optimistic:AiConversationMessage={message_id:`temp_${Date.now()}`,conversation_id:conversation.conversation_id,owner_user_id:'',role:'USER',content,model_id:null,created_at:new Date().toISOString()};
   setMessages(rows=>[...rows,optimistic]);
   const result=await aiConversationClient.send(conversation.conversation_id,content);
   setCurrent(result.conversation);setContext(result.context);
   setMessages(rows=>[...rows.filter(row=>row.message_id!==optimistic.message_id),result.user_message,result.assistant_message]);
   setConversations(rows=>[result.conversation,...rows.filter(row=>row.conversation_id!==result.conversation.conversation_id)]);
  }catch(e){setMessages(rows=>rows.filter(row=>!row.message_id.startsWith('temp_')));setInput(content);setError(errText(e));}finally{setSending(false);}
 };

 return <div className="flex h-full min-h-0 overflow-hidden bg-[#050a10] text-zinc-100">
  <aside className={`${sidebarOpen?'flex':'hidden'} w-[280px] shrink-0 flex-col border-r border-white/[0.06] bg-[#071019] lg:flex`}>
   <div className="border-b border-white/[0.06] p-3"><button type="button" onClick={()=>void create()} disabled={creating} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-[11px] font-black text-black transition hover:bg-zinc-100 disabled:opacity-50">{creating?<LoaderCircle className="h-4 w-4 animate-spin"/>:<MessageSquarePlus className="h-4 w-4"/>}Nova conversa</button></div>
   <div className="flex-1 overflow-y-auto p-2">
    {loading?<div className="grid h-32 place-items-center"><LoaderCircle className="h-4 w-4 animate-spin text-zinc-600"/></div>:conversations.length?conversations.map(conversation=><div key={conversation.conversation_id} className={`group mb-1 flex items-center rounded-xl border ${current?.conversation_id===conversation.conversation_id?'border-cyan-300/15 bg-cyan-300/[0.06]':'border-transparent hover:bg-white/[0.035]'}`}><button type="button" onClick={()=>void open(conversation.conversation_id)} className="min-w-0 flex-1 px-3 py-2.5 text-left"><strong className="block truncate text-[10px] font-semibold text-zinc-200">{conversation.title}</strong><span className="mt-0.5 block text-[8px] text-zinc-600">{conversation.message_count} mensagens</span></button><button type="button" onClick={()=>void remove(conversation)} title="Excluir conversa" aria-label="Excluir conversa" className="mr-1 grid h-7 w-7 place-items-center rounded-lg text-zinc-700 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100"><Trash2 className="h-3 w-3"/></button></div>):<div className="px-4 py-10 text-center text-[9px] leading-relaxed text-zinc-600">Suas conversas aparecerão aqui.</div>}
   </div>
  </aside>

  <section className="relative flex min-w-0 flex-1 flex-col">
   <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#071019]/92 px-3 backdrop-blur-xl">
    <button type="button" onClick={()=>setSidebarOpen(open=>!open)} className="grid h-8 w-8 place-items-center rounded-xl border border-white/[0.07] text-zinc-500 hover:text-white lg:hidden" aria-label="Alternar conversas">{sidebarOpen?<PanelLeftClose className="h-4 w-4"/>:<PanelLeftOpen className="h-4 w-4"/>}</button>
    <div className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-white">{current?.title||'IA Connect'}</strong><span className="block text-[8px] font-semibold uppercase tracking-[.12em] text-cyan-300/70">IA Connect · modelo conversacional</span></div>
    {context&&<span title={context.missing_information?.join(' · ')||''} className={`hidden rounded-full border px-2 py-1 text-[7px] font-bold uppercase tracking-[.08em] sm:inline-flex ${context.readiness==='READY_FOR_ACTION'?'border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-300':context.readiness==='NEEDS_CLARIFICATION'?'border-amber-300/15 bg-amber-300/[0.06] text-amber-300':'border-white/[0.07] bg-white/[0.03] text-zinc-500'}`}>{context.readiness==='READY_FOR_ACTION'?'Pedido entendido':context.readiness==='NEEDS_CLARIFICATION'?'Faltam detalhes':'Conversando'}</span>}
   </header>

   {error&&<div role="alert" className="mx-3 mt-3 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] px-3 py-2 text-[9px] text-rose-300">{error}</div>}

   <div className="flex-1 overflow-y-auto px-3 py-6 sm:px-6">
    <div className="mx-auto w-full max-w-3xl">
     {!current&&!loading?<div className="grid min-h-[52vh] place-items-center text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.06] text-cyan-200"><Bot className="h-6 w-6"/></span><h1 className="mt-4 text-xl font-black text-white">Converse com a IA Connect</h1><p className="mx-auto mt-2 max-w-lg text-[10px] leading-relaxed text-zinc-500">Desenvolva uma ideia, planeje uma criação ou simplesmente explique o que você quer fazer. A conversa fica salva para você continuar depois.</p><button type="button" onClick={()=>void create()} className="mt-5 rounded-xl bg-white px-4 py-2.5 text-[10px] font-black text-black">Começar conversa</button></div></div>:opening?<div className="grid min-h-[50vh] place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-cyan-300"/></div>:messages.length?messages.map(message=><div key={message.message_id} className={`mb-5 flex ${message.role==='USER'?'justify-end':'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-3 sm:max-w-[78%] ${message.role==='USER'?'bg-cyan-300 text-[#041019]':'border border-white/[0.07] bg-white/[0.035] text-zinc-200'}`}><div className="whitespace-pre-wrap text-[11px] leading-6">{message.content}</div><div className={`mt-1.5 text-right text-[7px] ${message.role==='USER'?'text-black/45':'text-zinc-700'}`}>{time(message.created_at)}</div></div></div>):current?<div className="grid min-h-[52vh] place-items-center text-center"><div><Bot className="mx-auto h-7 w-7 text-cyan-300/70"/><h2 className="mt-3 text-[14px] font-bold text-white">O que você quer criar?</h2><p className="mt-1 text-[9px] text-zinc-600">Pode começar com uma ideia incompleta. A IA vai ajudar a desenvolver.</p></div></div>:null}
     {sending&&<div className="mb-5 flex justify-start"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3"><div className="flex items-center gap-2 text-[9px] text-zinc-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-300"/>IA Connect está pensando…</div></div></div>}
     <div ref={endRef}/>
    </div>
   </div>

   <div className="shrink-0 border-t border-white/[0.055] bg-[#050a10]/95 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
    <div className="mx-auto max-w-3xl">
     <div className="flex items-end gap-2 rounded-2xl border border-white/[0.09] bg-[#0a141e] p-2 shadow-2xl focus-within:border-cyan-300/20">
      <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} rows={1} placeholder="Converse com a IA Connect…" className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[11px] leading-5 text-white outline-none placeholder:text-zinc-700"/>
      <button type="button" onClick={()=>void send()} disabled={!input.trim()||sending} aria-label="Enviar mensagem" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-[#041019] disabled:opacity-30">{sending?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}</button>
     </div>
     <p className="mt-2 text-center text-[7px] text-zinc-700">A IA preserva o contexto desta conversa e identifica quando seu pedido já está pronto para uma futura ação.</p>
    </div>
   </div>
  </section>
 </div>;
};

export default AiConversationView;
