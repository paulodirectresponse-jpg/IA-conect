import React from'react';
import{Image as ImageIcon,LoaderCircle,Maximize2}from'lucide-react';
import{Asset}from'../../../types/index.js';

export type ImageEditorViewMode='source'|'compare'|'result';

interface ImageEditorCanvasProps{
 source:Asset|null;
 result:Asset|null;
 tool:string;
 zoom:number;
 viewMode:ImageEditorViewMode;
 comparePosition:number;
 processing:boolean;
 statusLabel?:string;
 maskRef:React.RefObject<HTMLCanvasElement|null>;
 onOpenPicker:()=>void;
 onViewMode:(mode:ImageEditorViewMode)=>void;
 onComparePosition:(value:number)=>void;
 onPointerDown:(event:React.PointerEvent<HTMLCanvasElement>)=>void;
 onPointerMove:(event:React.PointerEvent<HTMLCanvasElement>)=>void;
 onPointerEnd:()=>void;
}

export const ImageEditorCanvas:React.FC<ImageEditorCanvasProps>=({
 source,result,tool,zoom,viewMode,comparePosition,processing,statusLabel,maskRef,onOpenPicker,onViewMode,onComparePosition,onPointerDown,onPointerMove,onPointerEnd,
})=>{
 const sourceUrl=source?.public_url||'';
 const resultUrl=result?.public_url||'';
 const activeUrl=viewMode==='result'&&resultUrl?resultUrl:sourceUrl;
 return <div className="relative flex h-full min-h-[440px] flex-col">
  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-2.5 sm:px-5">
   <div className="min-w-0">
    <p className="truncate text-[10px] font-medium text-zinc-300">{source?.name||'Nenhuma imagem aberta'}</p>
    <p className="mt-0.5 text-[8px] uppercase tracking-[.14em] text-zinc-600">{result?'Original preservado · resultado derivado':'Workspace não destrutivo'}</p>
   </div>
   {result&&<div className="flex rounded-xl border border-white/[0.07] bg-black/20 p-1">
    <button onClick={()=>onViewMode('source')} className={`rounded-lg px-2.5 py-1.5 text-[9px] transition ${viewMode==='source'?'bg-white/[0.09] text-white':'text-zinc-500 hover:text-zinc-300'}`}>Antes</button>
    <button onClick={()=>onViewMode('compare')} className={`rounded-lg px-2.5 py-1.5 text-[9px] transition ${viewMode==='compare'?'bg-cyan-400/[0.12] text-cyan-200':'text-zinc-500 hover:text-zinc-300'}`}>Comparar</button>
    <button onClick={()=>onViewMode('result')} className={`rounded-lg px-2.5 py-1.5 text-[9px] transition ${viewMode==='result'?'bg-white/[0.09] text-white':'text-zinc-500 hover:text-zinc-300'}`}>Depois</button>
   </div>}
  </div>

  <div className="relative flex flex-1 min-h-0 items-center justify-center overflow-auto p-4 sm:p-6 lg:p-8">
   {!sourceUrl?<button onClick={onOpenPicker} className="group grid min-h-[300px] w-full max-w-3xl place-items-center rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.015] text-center hover:border-cyan-400/20 hover:bg-cyan-400/[0.025]">
    <div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.025]"><ImageIcon className="h-6 w-6 text-zinc-600 group-hover:text-cyan-300"/></span><strong className="mt-4 block text-sm text-zinc-300">Abra uma imagem para começar</strong><span className="mt-1 block text-[10px] text-zinc-600">Biblioteca ou upload</span></div>
   </button>:<div className="relative flex max-h-full max-w-full items-center justify-center" style={{transform:`scale(${zoom})`,transformOrigin:'center center'}}>
    <div className="relative inline-block max-h-full max-w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-[0_24px_80px_rgba(0,0,0,.35)]">
     <img src={activeUrl} alt={source?.name||'Imagem'} className="block max-h-[calc(100vh-230px)] max-w-[min(100%,1200px)] object-contain"/>
     {viewMode==='compare'&&resultUrl&&sourceUrl&&<>
      <img src={resultUrl} alt="Resultado" className="absolute inset-0 h-full w-full object-contain" style={{clipPath:`inset(0 ${100-comparePosition}% 0 0)`}}/>
      <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white/90 shadow-[0_0_16px_rgba(255,255,255,.45)]" style={{left:`${comparePosition}%`}}>
       <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-[#0a111a]/95 text-[10px] font-bold text-white">↔</span>
      </div>
      <span className="absolute left-3 top-3 z-20 rounded-lg bg-black/55 px-2 py-1 text-[9px] text-white backdrop-blur">Antes</span>
      <span className="absolute right-3 top-3 z-20 rounded-lg bg-black/55 px-2 py-1 text-[9px] text-white backdrop-blur">Depois</span>
     </>}
     {tool==='inpaint-mask'&&viewMode!=='result'&&<canvas ref={maskRef} width={1024} height={1024} className="absolute inset-0 z-30 h-full w-full touch-none cursor-crosshair opacity-45 mix-blend-screen" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onPointerLeave={onPointerEnd}/>}
     {processing&&<div className="absolute inset-0 z-40 grid place-items-center bg-black/55 backdrop-blur-[2px]"><div className="rounded-2xl border border-white/[0.08] bg-[#081019]/90 px-5 py-4 text-center shadow-xl"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-cyan-300"/><p className="mt-2 text-[10px] font-medium text-zinc-200">{statusLabel||'Processando edição…'}</p></div></div>}
    </div>
   </div>}
  </div>

  {result&&viewMode==='compare'&&<div className="shrink-0 border-t border-white/[0.05] px-4 py-3 sm:px-6">
   <div className="mx-auto flex max-w-2xl items-center gap-3"><span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-600">Antes</span><input aria-label="Comparação antes e depois" className="h-1 flex-1 accent-cyan-400" type="range" min={5} max={95} value={comparePosition} onChange={e=>onComparePosition(Number(e.target.value))}/><span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-600">Depois</span></div>
  </div>}
  {!sourceUrl&&<span className="pointer-events-none absolute bottom-4 right-4 text-zinc-800"><Maximize2 className="h-4 w-4"/></span>}
 </div>;
};

export default ImageEditorCanvas;
