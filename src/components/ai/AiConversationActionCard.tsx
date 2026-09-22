import React from'react';
import{CheckCircle2,LoaderCircle,RefreshCw,RotateCcw,Square,Sparkles,TriangleAlert}from'lucide-react';
import type{AiConversationAction}from'../../services/aiConversationClient.js';

export const AiConversationActionCard:React.FC<{
 action:AiConversationAction;
 busy:boolean;
 onConfirm:(action:AiConversationAction)=>void;
 onRegenerate:(action:AiConversationAction,assetId:string)=>void;
 onRetry:(action:AiConversationAction)=>void;
 onCancel:(action:AiConversationAction)=>void;
}>=({action,busy,onConfirm,onRegenerate,onRetry,onCancel})=>{
 const renderAsset=(asset:AiConversationAction['result_assets'][number],index:number)=>{
  const src=asset.preview_url||asset.thumbnail_url||asset.public_url;
  return <div key={asset.asset_id} className="overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
   <div className="relative aspect-video bg-black/30">
    {asset.type==='IMAGE'&&src?<img src={src} alt={asset.name||`Resultado ${index+1}`} className="h-full w-full object-cover"/>:null}
    {asset.type==='VIDEO'&&asset.public_url?<video src={asset.public_url} controls className="h-full w-full object-cover"/>:null}
    {asset.type==='AUDIO'&&<div className="grid h-full place-items-center px-3"><audio src={asset.public_url} controls className="w-full"/></div>}
    {asset.type==='MODEL_3D'&&<div className="grid h-full place-items-center text-[9px] text-zinc-500">Arquivo 3D gerado</div>}
    <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[7px] font-bold text-white">#{index+1}</span>
   </div>
   <div className="flex items-center justify-between gap-2 p-2">
    <span className="truncate text-[8px] text-zinc-500">{asset.name||`Resultado ${index+1}`}</span>
    <button type="button" onClick={()=>onRegenerate(action,asset.asset_id)} disabled={busy} className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.07] px-2 py-1 text-[7px] font-semibold text-zinc-300 hover:bg-white/[0.04] disabled:opacity-40"><RefreshCw className="h-2.5 w-2.5"/>Refazer</button>
   </div>
  </div>;
 };

 return <div className="mt-2 w-full max-w-[88%] rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-3 sm:max-w-[78%]">
  <div className="flex items-start gap-2">
   <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-300/10 bg-cyan-300/[0.06] text-cyan-200"><Sparkles className="h-3.5 w-3.5"/></span>
   <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-2"><strong className="text-[10px] text-white">{action.tool_label}</strong><span className="rounded-full border border-white/[0.06] px-1.5 py-0.5 text-[7px] uppercase tracking-[.08em] text-zinc-500">{action.selected_model_id|| (action.model_id==='AUTO'?'Modelo automático':action.model_id)}</span>{action.quantity>1&&<span className="rounded-full border border-white/[0.06] px-1.5 py-0.5 text-[7px] text-zinc-500">{action.quantity} itens</span>}</div>
    <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[9px] leading-4 text-zinc-400">{action.generation_prompt}</p>
    {action.unresolved_references.length>0&&<div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-300/10 bg-amber-300/[0.04] px-2 py-1.5 text-[8px] leading-4 text-amber-200/80"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0"/>Referência necessária: {action.unresolved_references.join(', ')}</div>}
    {action.status==='UNAVAILABLE'?<div className="mt-2 flex items-start gap-1.5 text-[8px] text-rose-300"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0"/>{action.unavailable_reason||'Ferramenta indisponível agora.'}</div>
    :action.status==='DRAFT'?<div className="mt-2">{action.unresolved_references.length>0?<div className="flex items-center gap-1.5 text-[8px] text-amber-200/80"><TriangleAlert className="h-3 w-3"/>Aguardando as referências necessárias.</div>:action.error_message?<div className="flex items-start gap-1.5 text-[8px] text-rose-300"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0"/>{action.error_message}</div>:<div className="flex items-center gap-1.5 text-[8px] text-cyan-200"><LoaderCircle className="h-3 w-3 animate-spin"/>Preparando custo e configuração…</div>}</div>
    :action.status==='QUOTING'?<div className="mt-2 flex items-center gap-1.5 text-[8px] text-cyan-200"><LoaderCircle className="h-3 w-3 animate-spin"/>Calculando custo real…</div>
    :action.status==='AWAITING_CONFIRMATION'?<div className="mt-2 rounded-xl border border-cyan-300/10 bg-black/20 p-2.5"><div className="flex items-center justify-between gap-3"><div><div className="text-[8px] uppercase tracking-[.08em] text-zinc-600">Custo confirmado</div><strong className="mt-0.5 block text-[13px] text-white">{action.quote_credit_price?.toLocaleString('pt-BR')} créditos</strong>{action.execution_jobs.length>1&&<span className="block text-[7px] text-zinc-600">{action.execution_jobs.length} jobs preparados</span>}</div><button type="button" onClick={()=>onConfirm(action)} disabled={busy} className="rounded-lg bg-cyan-300 px-3 py-2 text-[8px] font-black text-[#041019] disabled:opacity-40">{busy?'Confirmando…':'Confirmar e gerar'}</button></div><p className="mt-2 text-[7px] leading-4 text-zinc-600">Nenhum crédito é gasto antes desta confirmação.</p></div>
    :['CONFIRMED','QUEUED','RUNNING'].includes(action.status)?<div className="mt-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[8px] text-cyan-200"><LoaderCircle className="h-3 w-3 animate-spin"/>{action.status==='RUNNING'?'Gerando resultados…':'Preparando geração…'}</div><button type="button" onClick={()=>onCancel(action)} disabled={busy} className="flex items-center gap-1 rounded-lg border border-white/[0.07] px-2 py-1 text-[7px] text-zinc-400 hover:bg-white/[0.04] hover:text-white disabled:opacity-40"><Square className="h-2.5 w-2.5"/>Cancelar</button></div>
    :action.status==='FAILED'?<div className="mt-2"><div className="flex items-start gap-1.5 text-[8px] text-rose-300"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0"/>{action.error_message||'A geração falhou.'}</div><button type="button" onClick={()=>onRetry(action)} disabled={busy} className="mt-2 flex items-center gap-1 rounded-lg border border-white/[0.07] px-2 py-1 text-[7px] font-semibold text-zinc-300 hover:bg-white/[0.04] disabled:opacity-40"><RotateCcw className="h-2.5 w-2.5"/>Tentar novamente</button></div>
    :action.status==='CANCELLED'?<div className="mt-2 text-[8px] text-zinc-500">Geração cancelada.</div>
    :null}
    {['SUCCEEDED','PARTIAL_SUCCESS'].includes(action.status)&&<div className="mt-3">
      <div className={`mb-2 flex items-center gap-1.5 text-[8px] ${action.status==='PARTIAL_SUCCESS'?'text-amber-200':'text-emerald-300'}`}>{action.status==='PARTIAL_SUCCESS'?<TriangleAlert className="h-3 w-3"/>:<CheckCircle2 className="h-3 w-3"/>}{action.status==='PARTIAL_SUCCESS'?'Parte da geração foi concluída.':'Geração concluída.'}</div>{action.status==='PARTIAL_SUCCESS'&&<button type="button" onClick={()=>onRetry(action)} disabled={busy} className="mb-2 flex items-center gap-1 rounded-lg border border-white/[0.07] px-2 py-1 text-[7px] font-semibold text-zinc-300 hover:bg-white/[0.04] disabled:opacity-40"><RotateCcw className="h-2.5 w-2.5"/>Refazer apenas as falhas</button>}
      {action.result_assets.length>0?<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{action.result_assets.map(renderAsset)}</div>:<div className="text-[8px] text-zinc-600">Os arquivos foram gerados e estão sendo vinculados à conversa.</div>}
    </div>}
   </div>
  </div>
 </div>;
};
