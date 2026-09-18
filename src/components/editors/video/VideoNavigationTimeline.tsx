import React,{useMemo}from'react';
import{Video as VideoIcon}from'lucide-react';

interface Props{
 currentTime:number;
 duration:number;
 sourceName?:string;
 modeLabel:string;
 resultAvailable:boolean;
 onSeek:(time:number)=>void;
}

const fmt=(s:number)=>{const total=Math.max(0,Number.isFinite(s)?s:0),sec=Math.floor(total%60).toString().padStart(2,'0'),min=Math.floor(total/60).toString().padStart(2,'0');return`${min}:${sec}`;};

export const VideoNavigationTimeline:React.FC<Props>=({currentTime,duration,sourceName,modeLabel,resultAvailable,onSeek})=>{
 const marks=useMemo(()=>Array.from({length:5},(_,i)=>duration?duration*i/4:0),[duration]);
 const pct=duration>0?Math.max(0,Math.min(100,currentTime/duration*100)):0;
 return <div className="border-t border-white/[0.06] bg-[#071018] px-4 py-3 sm:px-5">
  <div className="mb-2 flex items-center justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[.15em] text-zinc-600">Timeline de navegação</span><p className="mt-0.5 text-[8px] text-zinc-700">Scrubbing e posicionamento do vídeo; nenhuma edição destrutiva é aplicada localmente.</p></div><span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[8px] text-zinc-500">{modeLabel}{resultAvailable?' · resultado disponível':''}</span></div>
  <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-black/25">
   <div className="flex h-7 items-end justify-between border-b border-white/[0.05] px-12 pb-1">{marks.map((m,i)=><span key={i} className="text-[7px] font-mono text-zinc-700">{fmt(m)}</span>)}</div>
   <button type="button" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();const ratio=(e.clientX-rect.left)/rect.width;onSeek(Math.max(0,Math.min(duration,duration*ratio)));}} className="relative flex h-16 w-full items-center text-left">
    <div className="flex h-10 w-full items-center gap-2 mx-3 overflow-hidden rounded-lg border border-cyan-400/10 bg-gradient-to-r from-cyan-400/[0.05] via-blue-400/[0.025] to-violet-400/[0.04] px-3"><VideoIcon className="h-3.5 w-3.5 shrink-0 text-cyan-300"/><span className="truncate text-[8px] font-medium text-zinc-400">{sourceName||'Vídeo fonte'}</span></div>
    <div className="pointer-events-none absolute inset-y-0 w-px bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.6)]" style={{left:`${pct}%`}}><span className="absolute -top-0.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-cyan-300"/></div>
   </button>
  </div>
 </div>;
};
export default VideoNavigationTimeline;
