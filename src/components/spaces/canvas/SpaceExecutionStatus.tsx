import React from'react';
import{Check,GitBranch,LoaderCircle,RotateCcw,X}from'lucide-react';
import type{FlowNodeRunView,FlowRunView}from'../../../beta/flowRuntimeClient.js';

interface Props{run:FlowRunView|null;onRetry?:()=>void;onDismiss?:()=>void;}

export const SpaceExecutionStatus:React.FC<Props>=({run,onRetry,onDismiss})=>{
 if(!run)return null;
 const order=run.execution_order?.length?run.execution_order:run.active_node_ids||[];
 const runs=new Map<string,FlowNodeRunView>((run.node_runs||[]).map(item=>[item.node_id,item]));
 const done=order.filter(id=>runs.get(id)?.status==='SUCCEEDED').length;
 const failed=order.filter(id=>runs.get(id)?.status==='FAILED').length;
 const running=order.filter(id=>runs.get(id)?.status==='RUNNING').length;
 const total=Math.max(1,order.length),progress=Math.round(done/total*100);
 const mode=run.execution_mode==='NODE'?'Node':run.execution_mode==='DOWNSTREAM'?'Daqui para frente':'Fluxo completo';
 const layerIndex=(run.execution_layers||[]).findIndex(layer=>layer.some(id=>runs.get(id)?.status==='RUNNING'));
 const detail=run.status==='RUNNING'?(running?(running+' executando'+(layerIndex>=0?' · etapa '+(layerIndex+1)+'/'+(run.execution_layers?.length||1):'')):'Preparando próxima etapa…'):run.status==='SUCCEEDED'?'Execução concluída':run.status==='FAILED'?'Execução interrompida':'Execução cancelada';
 return <div className="pointer-events-auto absolute bottom-4 left-1/2 z-40 w-[min(390px,calc(100%-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08121b]/94 shadow-[0_18px_60px_rgba(0,0,0,.38)] backdrop-blur-xl">
  <div className="flex items-center gap-3 px-3.5 py-3">
   <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${run.status==='SUCCEEDED'?'bg-emerald-400/10 text-emerald-300':run.status==='FAILED'?'bg-rose-400/10 text-rose-300':run.status==='CANCELLED'?'bg-zinc-500/10 text-zinc-400':'bg-cyan-300/10 text-cyan-200'}`}>{run.status==='RUNNING'?<LoaderCircle className="h-4 w-4 animate-spin"/>:run.status==='SUCCEEDED'?<Check className="h-4 w-4"/>:run.status==='FAILED'?<X className="h-4 w-4"/>:<GitBranch className="h-4 w-4"/>}</span>
   <div className="min-w-0 flex-1">
    <div className="flex items-center justify-between gap-3"><strong className="truncate text-[9px] text-white">{mode}</strong><span className="text-[8px] font-semibold text-zinc-500">{done}/{order.length||0}</span></div>
    <p className="mt-0.5 truncate text-[8px] text-zinc-500">{detail}{failed?' · '+failed+' falhou':''}{run.reused_node_ids?.length?' · '+run.reused_node_ids.length+' reutilizado'+(run.reused_node_ids.length>1?'s':''):''}</p>
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.05]"><div className={`h-full rounded-full transition-[width] duration-500 ${run.status==='FAILED'?'bg-rose-300':run.status==='SUCCEEDED'?'bg-emerald-300':'bg-cyan-300'}`} style={{width:(run.status==='SUCCEEDED'?100:progress)+'%'}}/></div>
   </div>
   {run.status==='FAILED'&&onRetry&&<button type="button" onClick={onRetry} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/[0.07] text-zinc-400 hover:border-cyan-300/20 hover:text-cyan-200" title="Tentar novamente" aria-label="Tentar execução novamente"><RotateCcw className="h-3.5 w-3.5"/></button>}
   {run.status!=='RUNNING'&&onDismiss&&<button type="button" onClick={onDismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-zinc-600 hover:bg-white/[0.05] hover:text-white" title="Fechar status" aria-label="Fechar status"><X className="h-3.5 w-3.5"/></button>}
  </div>
 </div>;
};

export default SpaceExecutionStatus;
