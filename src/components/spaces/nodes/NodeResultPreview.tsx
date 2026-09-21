import React from'react';
import{ChevronLeft,ChevronRight}from'lucide-react';
import type{SpaceAsset}from'../../../services/spacesClient.js';

export interface NodeOutputHistoryItem{
 asset:SpaceAsset;run_id:string;node_run_id:string;authorized_credit_price:number;created_at:string;completed_at?:string|null;
}
interface Props{items:NodeOutputHistoryItem[];index:number;onIndexChange:(index:number)=>void;emptyLabel?:string;fullBleed?:boolean;}

export const NodeResultPreview:React.FC<Props>=({items,index,onIndexChange,emptyLabel='Seu resultado aparecerá aqui',fullBleed=false})=>{
 const safeIndex=Math.max(0,Math.min(index,Math.max(0,items.length-1))),item=items[safeIndex],asset=item?.asset;
 const url=asset?.preview_url||asset?.public_url||null;
 const mediaClass=fullBleed?'absolute inset-0 h-full w-full object-cover':'block h-auto w-full bg-black/30 object-contain';
 return <div className={fullBleed?'absolute inset-0 overflow-hidden bg-[#071018]':'overflow-hidden rounded-2xl bg-black/25'}>
  {!asset||!url?<div className={fullBleed?'absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,.08),transparent_42%),#071018] px-7 text-center':'grid aspect-[4/3] min-h-[150px] place-items-center px-6 text-center'}><div><strong className="block text-[9px] font-semibold text-zinc-500">{emptyLabel}</strong><span className="mt-1 block text-[7px] leading-relaxed text-zinc-700">As gerações anteriores ficam salvas neste card.</span></div></div>:asset.type==='IMAGE'?<img src={url} alt="Resultado gerado" draggable={false} className={mediaClass}/>:<video src={asset.public_url||url} aria-label="Resultado em vídeo" muted preload="metadata" playsInline controls={!fullBleed} className={fullBleed?'absolute inset-0 h-full w-full bg-black object-cover':'block h-auto w-full bg-black object-contain'}/>}
  {fullBleed&&items.length>1&&<div className="absolute left-1/2 top-12 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/35 px-1 py-0.5 backdrop-blur-md">
   <button type="button" aria-label="Ver resultado anterior" onClick={()=>onIndexChange(Math.min(items.length-1,safeIndex+1))} disabled={safeIndex>=items.length-1} className="grid h-5 w-5 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25"><ChevronLeft className="h-3 w-3"/></button>
   <span className="min-w-7 text-center text-[7px] font-semibold text-white/65">{items.length-safeIndex}/{items.length}</span>
   <button type="button" aria-label="Ver resultado mais recente" onClick={()=>onIndexChange(Math.max(0,safeIndex-1))} disabled={safeIndex<=0} className="grid h-5 w-5 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25"><ChevronRight className="h-3 w-3"/></button>
  </div>}
 </div>;
};

export default NodeResultPreview;