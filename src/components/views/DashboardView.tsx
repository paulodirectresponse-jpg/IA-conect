import React,{useEffect,useMemo,useState}from'react';
import{ArrowRight,Image as ImageIcon,Sparkles,Video}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{generationClient}from'../../services/generationClient.js';
import{Generation}from'../../types/index.js';
import{ModelShowcase,ShowcaseItem}from'../workspace/ModelShowcase.js';

interface DashboardViewProps{onNavigate:(view:string)=>void;}
function ratio(value?:string){const m=String(value||'').match(/(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)/);return m?`${m[1]} / ${m[2]}`:'4 / 3'}

export const DashboardView:React.FC<DashboardViewProps>=({onNavigate})=>{
 const{profile}=useAuth();
 const[recent,setRecent]=useState<Generation[]>([]);
 useEffect(()=>{generationClient.list(10).then(setRecent).catch(()=>setRecent([]))},[]);
 const completed=useMemo(()=>recent.filter(g=>g.status==='SUCCEEDED'&&g.result_url),[recent]);
 const tryModel=(item:ShowcaseItem)=>{sessionStorage.setItem('ia-connect:last-showcase-model',item.modelId);onNavigate(item.mode==='IMAGE'?'create-image':'create-video')};

 return <div className="ia-dashboard space-y-8 pb-10">
  <section className="ia-dashboard-intro">
   <div>
    <p className="ia-label text-sky-300">Seu studio</p>
    <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-[-.04em] text-[var(--ia-text-1)]">Olá, {profile?.display_name||'criador'}.</h1>
    <p className="mt-2 max-w-xl text-[12px] sm:text-sm leading-relaxed text-[var(--ia-text-3)]">Continue uma criação ou comece uma nova ideia.</p>
   </div>
  </section>

  <section className="grid md:grid-cols-2 gap-3">
   <button onClick={()=>onNavigate('create-image')} className="ia-dashboard-create-card group">
    <div className="ia-dashboard-create-icon"><ImageIcon className="w-5 h-5"/></div>
    <div className="mt-5">
     <h2 className="text-lg font-black text-[var(--ia-text-1)]">Criar imagem</h2>
     <p className="mt-1 text-[11px] leading-relaxed text-[var(--ia-text-3)]">Referências, personagens, produtos, estilos e edição.</p>
    </div>
    <span className="ia-dashboard-arrow"><ArrowRight className="w-4 h-4"/></span>
   </button>
   <button onClick={()=>onNavigate('create-video')} className="ia-dashboard-create-card group">
    <div className="ia-dashboard-create-icon"><Video className="w-5 h-5"/></div>
    <div className="mt-5">
     <h2 className="text-lg font-black text-[var(--ia-text-1)]">Criar vídeo</h2>
     <p className="mt-1 text-[11px] leading-relaxed text-[var(--ia-text-3)]">Texto, frames e referências multimodais em movimento.</p>
    </div>
    <span className="ia-dashboard-arrow"><ArrowRight className="w-4 h-4"/></span>
   </button>
  </section>

  <ModelShowcase compact onTry={tryModel} title="Descobrir modelos" subtitle="Explore resultados e entre direto no modelo certo quando quiser experimentar algo novo."/>

  <section>
   <div className="flex items-end justify-between gap-4">
    <div><h2 className="ia-section-title">Criações recentes</h2><p className="ia-compact mt-1">Retome de onde parou.</p></div>
    <button onClick={()=>onNavigate('history')} className="text-[10px] font-bold text-sky-300 inline-flex items-center gap-1">Ver histórico<ArrowRight className="w-3 h-3"/></button>
   </div>
   {completed.length>0?
    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
     {completed.slice(0,5).map(g=><button key={g.generation_id} onClick={()=>onNavigate('history')} className="ia-dashboard-recent group text-left min-w-0">
      <div className="ia-dashboard-recent-media" style={{aspectRatio:ratio(g.aspect_ratio)}}>{g.mode==='TEXT_TO_IMAGE'||g.mode==='IMAGE_TO_IMAGE'?<img src={g.result_url!} alt="" className="w-full h-full object-contain"/>:<video src={g.result_url!} muted playsInline preload="metadata" className="w-full h-full object-contain"/>}</div>
      <p className="mt-2 text-[10px] font-semibold text-[var(--ia-text-2)] truncate">{g.original_prompt||'Criação'}</p>
      <p className="mt-0.5 text-[9px] text-[var(--ia-text-4)]">{g.mode==='TEXT_TO_IMAGE'||g.mode==='IMAGE_TO_IMAGE'?'Imagem':'Vídeo'} · {g.aspect_ratio||'formato original'}</p>
     </button>)}
    </div>
    :<div className="ia-dashboard-empty mt-4"><Sparkles className="w-5 h-5 mx-auto text-sky-300/50"/><p className="mt-2 text-[11px] text-[var(--ia-text-3)]">Suas próximas criações vão aparecer aqui.</p></div>}
  </section>

 </div>;
};
