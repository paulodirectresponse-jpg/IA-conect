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

 return <div className="ia-dashboard pb-12">
  <header className="ia-dashboard-intro">
   <div className="min-w-0">
    <p className="ia-dashboard-eyebrow">Bem-vindo de volta, {profile?.display_name||'criador'}</p>
    <h1 className="ia-dashboard-title">Transforme ideias em criações reais.</h1>
    <p className="ia-dashboard-subtitle">Crie imagens e vídeos, explore modelos e continue trabalhando a partir das suas últimas gerações.</p>
   </div>
  </header>

  <section className="ia-dashboard-launchpad" aria-label="Começar uma criação">
   <button onClick={()=>onNavigate('create-image')} className="ia-dashboard-launch group">
    <div className="ia-dashboard-create-icon"><ImageIcon className="w-5 h-5"/></div>
    <div className="min-w-0">
     <span className="ia-dashboard-launch-label">Studio de imagem</span>
     <h2>Criar imagem</h2>
     <p>Combine prompt e referências com os modelos disponíveis no IA Connect.</p>
    </div>
    <span className="ia-dashboard-arrow"><ArrowRight className="w-4 h-4"/></span>
   </button>
   <button onClick={()=>onNavigate('create-video')} className="ia-dashboard-launch group">
    <div className="ia-dashboard-create-icon"><Video className="w-5 h-5"/></div>
    <div className="min-w-0">
     <span className="ia-dashboard-launch-label">Studio de vídeo</span>
     <h2>Criar vídeo</h2>
     <p>Transforme texto, frames e referências em movimento com controle de geração.</p>
    </div>
    <span className="ia-dashboard-arrow"><ArrowRight className="w-4 h-4"/></span>
   </button>
  </section>

  <ModelShowcase compact onTry={tryModel} title="Modelos em destaque" subtitle="Explore os modelos disponíveis e entre direto no studio quando quiser experimentar algo novo."/>

  <section className="ia-dashboard-recent-section">
   <div className="flex items-end justify-between gap-4">
    <div><h2 className="ia-section-title">Criações recentes</h2><p className="ia-compact mt-1">Retome de onde parou.</p></div>
    <button onClick={()=>onNavigate('history')} className="ia-dashboard-history-link">Ver histórico<ArrowRight className="w-3.5 h-3.5"/></button>
   </div>
   {completed.length>0?
    <div className="ia-dashboard-recent-grid">
     {completed.slice(0,5).map(g=><button key={g.generation_id} onClick={()=>onNavigate('history')} className="ia-dashboard-recent group text-left min-w-0">
      <div className="ia-dashboard-recent-media" style={{aspectRatio:ratio(g.aspect_ratio)}}>{g.mode==='TEXT_TO_IMAGE'||g.mode==='IMAGE_TO_IMAGE'?<img src={g.result_url!} alt="" className="w-full h-full object-contain"/>:<video src={g.result_url!} muted playsInline preload="metadata" className="w-full h-full object-contain"/>}</div>
      <p className="ia-dashboard-recent-title">{g.original_prompt||'Criação'}</p>
      <p className="ia-dashboard-recent-meta">{g.mode==='TEXT_TO_IMAGE'||g.mode==='IMAGE_TO_IMAGE'?'Imagem':'Vídeo'} · {g.aspect_ratio||'formato original'}</p>
     </button>)}
    </div>
    :<div className="ia-dashboard-empty mt-4"><Sparkles className="w-5 h-5 mx-auto text-sky-300/50"/><p className="mt-2 text-[12px] text-[var(--ia-text-3)]">Suas próximas criações vão aparecer aqui.</p></div>}
  </section>
 </div>;
};
