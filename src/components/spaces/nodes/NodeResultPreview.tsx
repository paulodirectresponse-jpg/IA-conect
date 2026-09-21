import React from'react';
import{ChevronLeft,ChevronRight,Clock3}from'lucide-react';
import type{SpaceAsset}from'../../../services/spacesClient.js';

export interface NodeOutputHistoryItem{
 asset:SpaceAsset;run_id:string;node_run_id:string;authorized_credit_price:number;created_at:string;completed_at?:string|null;
}
interface Props{items:NodeOutputHistoryItem[];index:number;onIndexChange:(index:number)=>void;emptyLabel?:string;}

export const NodeResultPreview:React.FC<Props>=({items,index,onIndexChange,emptyLabel='Seu resultado aparecerá aqui'})=>{
 const safeIndex=Math.max(0,Math.min(index,Math.max(0,items.length-1))),item=items[safeIndex],asset=item?.asset;
 const url=asset?.preview_url||asset?.public_url||null;
 return <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/25">
  {!asset||!url?<div className="grid aspect-[4/3] min-h-[150px] place-items-center px-6 text-center"><div><strong className="block text-[10px] font-semibold text-zinc-500">{emptyLabel}</strong><span className="mt-1 block text-[8px] leading-relaxed text-zinc-700">As gerações anteriores ficam salvas neste card.</span></div></div>:asset.type==='IMAGE'?<img src={url} alt="Resultado gerado" draggable={false} className="block h-auto w-full bg-black/30 object-contain"/>:<video src={asset.public_url||url} aria-label="Resultado em vídeo" muted preload="metadata" playsInline controls className="block h-auto w-full bg-black object-contain"/>}
  {items.length>0&&<div className="flex items-center justify-between border-t border-white/[0.05] px-2.5 py-2">
   <button type="button" aria-label="Ver resultado anterior" onClick={()=>onIndexChange(Math.min(items.length-1,safeIndex+1))} disabled={safeIndex>=items.length-1} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.04] hover:text-white disabled:opacity-25"><ChevronLeft className="h-3.5 w-3.5"/></button>
   <div className="text-center"><strong className="block text-[8px] text-zinc-400">{items.length-safeIndex} / {items.length}</strong><span className="mt-0.5 flex items-center gap-1 text-[7px] text-zinc-700"><Clock3 className="h-2.5 w-2.5"/>{new Date(item.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></div>
   <button type="button" aria-label="Ver resultado mais recente" onClick={()=>onIndexChange(Math.max(0,safeIndex-1))} disabled={safeIndex<=0} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.04] hover:text-white disabled:opacity-25"><ChevronRight className="h-3.5 w-3.5"/></button>
  </div>}
 </div>;
};

export default NodeResultPreview;