import React,{useEffect,useMemo,useRef,useState}from'react';
import{Download,Expand,LoaderCircle,Pause,Play,Video as VideoIcon,Volume2,VolumeX}from'lucide-react';
import{Asset}from'../../../types/index.js';

export type VideoPreviewMode='source'|'result';

interface Props{
 source:Asset|null;
 result:Asset|null;
 mode:VideoPreviewMode;
 processing:boolean;
 statusLabel?:string;
 onOpenPicker:()=>void;
 onModeChange:(mode:VideoPreviewMode)=>void;
 onTimeUpdate?:(current:number,duration:number)=>void;
 seekTo?:number;
}

const format=(seconds:number)=>{if(!Number.isFinite(seconds)||seconds<0)return'00:00';const s=Math.floor(seconds%60).toString().padStart(2,'0'),m=Math.floor(seconds/60).toString().padStart(2,'0');return`${m}:${s}`;};

export const VideoEditorPreview:React.FC<Props>=({source,result,mode,processing,statusLabel,onOpenPicker,onModeChange,onTimeUpdate,seekTo})=>{
 const ref=useRef<HTMLVideoElement|null>(null);
 const[playing,setPlaying]=useState(false),[muted,setMuted]=useState(false),[current,setCurrent]=useState(0),[duration,setDuration]=useState(0);
 const asset=mode==='result'&&result?result:source;
 const src=asset?.public_url||'';
 useEffect(()=>{const video=ref.current;if(!video)return;video.pause();setPlaying(false);setCurrent(0);},[src]);
 useEffect(()=>{const video=ref.current;if(!video||seekTo==null||!Number.isFinite(seekTo))return;video.currentTime=Math.max(0,Math.min(video.duration||seekTo,seekTo));},[seekTo]);
 const meta=useMemo(()=>asset?.name||'Vídeo sem nome',[asset]);
 const toggle=async()=>{const video=ref.current;if(!video)return;if(video.paused){await video.play().catch(()=>null);}else video.pause();};
 const fullscreen=()=>{const video=ref.current as any;if(video?.requestFullscreen)void video.requestFullscreen();};
 const sync=()=>{const video=ref.current;if(!video)return;const next=video.currentTime||0,total=Number.isFinite(video.duration)?video.duration:0;setCurrent(next);setDuration(total);onTimeUpdate?.(next,total);};
 return <div className="relative flex h-full min-h-[430px] flex-col">
  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-2.5 sm:px-5">
   <div className="min-w-0"><p className="truncate text-[10px] font-medium text-zinc-300">{asset?meta:'Nenhum vídeo aberto'}</p><p className="mt-0.5 text-[8px] uppercase tracking-[.14em] text-zinc-600">{result?'Original preservado · resultado derivado':'Workspace não destrutivo'}</p></div>
   {result&&<div className="flex rounded-xl border border-white/[0.07] bg-black/20 p-1"><button onClick={()=>onModeChange('source')} className={`rounded-lg px-2.5 py-1.5 text-[9px] ${mode==='source'?'bg-white/[0.09] text-white':'text-zinc-500'}`}>Original</button><button onClick={()=>onModeChange('result')} className={`rounded-lg px-2.5 py-1.5 text-[9px] ${mode==='result'?'bg-cyan-400/[0.12] text-cyan-200':'text-zinc-500'}`}>Resultado</button></div>}
  </div>
  <div className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden p-4 sm:p-6">
   {!src?<button onClick={onOpenPicker} className="group grid h-full min-h-[330px] w-full max-w-5xl place-items-center rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.012] text-center hover:border-cyan-400/20 hover:bg-cyan-400/[0.025]"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.025]"><VideoIcon className="h-6 w-6 text-zinc-600 group-hover:text-cyan-300"/></span><strong className="mt-4 block text-sm text-zinc-300">Abra um vídeo para começar</strong><span className="mt-1 block text-[10px] text-zinc-600">Biblioteca Global ou upload</span></div></button>:<div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-[0_24px_80px_rgba(0,0,0,.35)]">
    <video ref={ref} src={src} muted={muted} playsInline preload="metadata" onLoadedMetadata={sync} onTimeUpdate={sync} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} className="aspect-video max-h-[calc(100vh-330px)] w-full bg-black object-contain"/>
    {processing&&<div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]"><div className="rounded-2xl border border-white/[0.08] bg-[#081019]/90 px-5 py-4 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-cyan-300"/><p className="mt-2 text-[10px] font-medium text-zinc-200">{statusLabel||'Processando vídeo…'}</p></div></div>}
   </div>}
  </div>
  {src&&<div className="shrink-0 border-t border-white/[0.05] px-4 py-2.5 sm:px-6"><div className="mx-auto flex max-w-6xl items-center gap-3"><button onClick={toggle} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-zinc-300">{playing?<Pause className="h-3.5 w-3.5"/>:<Play className="h-3.5 w-3.5 fill-current"/>}</button><span className="w-[86px] text-[9px] font-mono text-zinc-500">{format(current)} / {format(duration)}</span><input aria-label="Posição do vídeo" type="range" min={0} max={Math.max(duration,.001)} step={.01} value={Math.min(current,duration||0)} onChange={e=>{const value=Number(e.target.value);if(ref.current)ref.current.currentTime=value;setCurrent(value);onTimeUpdate?.(value,duration);}} className="min-w-0 flex-1 accent-cyan-400"/><button onClick={()=>setMuted(v=>!v)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-zinc-400">{muted?<VolumeX className="h-3.5 w-3.5"/>:<Volume2 className="h-3.5 w-3.5"/>}</button><button onClick={fullscreen} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-zinc-400"><Expand className="h-3.5 w-3.5"/></button>{result?.public_url&&mode==='result'&&<a href={result.public_url} target="_blank" rel="noreferrer" download className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-200"><Download className="h-3.5 w-3.5"/></a>}</div></div>}
 </div>;
};
export default VideoEditorPreview;
