import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Image as ImageIcon, Images, Sparkles, Video, Wallet, WandSparkles, Box, UserRound, Building2, PackageOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { generationClient } from '../../services/generationClient.js';
import { assetService } from '../../services/assetService.js';
import { Asset, Generation } from '../../types/index.js';

interface DashboardViewProps { onNavigate:(view:string)=>void; }

const starterIdeas = [
  { title:'Produto premium', subtitle:'Transforme um produto em campanha visual', icon:PackageOpen, mode:'create-image', bg:'radial-gradient(circle at 72% 26%,rgba(217,70,239,.34),transparent 30%),radial-gradient(circle at 25% 80%,rgba(59,130,246,.2),transparent 30%),#12131a' },
  { title:'Personagem consistente', subtitle:'Crie uma identidade para usar em várias cenas', icon:UserRound, mode:'create-image', bg:'radial-gradient(circle at 30% 20%,rgba(16,185,129,.25),transparent 30%),radial-gradient(circle at 72% 72%,rgba(6,182,212,.2),transparent 34%),#10161a' },
  { title:'Vídeo cinematográfico', subtitle:'Anime uma referência com movimento de câmera', icon:Video, mode:'create-video', bg:'radial-gradient(circle at 70% 28%,rgba(239,68,68,.3),transparent 28%),radial-gradient(circle at 18% 75%,rgba(249,115,22,.16),transparent 28%),#171111' },
  { title:'Arquitetura & imóveis', subtitle:'Eleve percepção de ambientes e fachadas', icon:Building2, mode:'create-video', bg:'radial-gradient(circle at 65% 35%,rgba(56,189,248,.25),transparent 32%),radial-gradient(circle at 24% 72%,rgba(99,102,241,.22),transparent 34%),#10131b' },
  { title:'CGI & conceito', subtitle:'Visualize uma ideia impossível antes da produção', icon:Box, mode:'create-image', bg:'radial-gradient(circle at 68% 30%,rgba(250,204,21,.2),transparent 28%),radial-gradient(circle at 28% 74%,rgba(244,63,94,.2),transparent 32%),#171410' },
  { title:'Imagem para vídeo', subtitle:'Comece por uma imagem e transforme em movimento', icon:WandSparkles, mode:'create-video', bg:'radial-gradient(circle at 28% 28%,rgba(139,92,246,.3),transparent 30%),radial-gradient(circle at 72% 72%,rgba(20,184,166,.17),transparent 28%),#131119' },
];

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { profile,wallet }=useAuth();
  const [recent,setRecent]=useState<Generation[]>([]);
  const [assets,setAssets]=useState<Asset[]>([]);
  useEffect(()=>{generationClient.list(8).then(setRecent).catch(()=>setRecent([]));assetService.listAssets().then(rows=>setAssets(rows.slice(0,8))).catch(()=>setAssets([]));},[]);
  const completed=useMemo(()=>recent.filter(g=>g.status==='SUCCEEDED'),[recent]);

  return <div className="space-y-7 pb-10">
    <section className="pt-2 sm:pt-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div><p className="text-[10px] font-semibold text-zinc-500">Olá, {profile?.display_name||'criador'}</p><h1 className="mt-1 text-2xl sm:text-[32px] leading-tight font-black tracking-[-0.04em] text-white">O que você quer criar hoje?</h1><p className="mt-2 text-xs sm:text-sm text-zinc-500">Comece por uma ideia, uma referência ou um asset da sua Biblioteca.</p></div>
        <button onClick={()=>onNavigate('wallet')} className="self-start sm:self-auto inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-white/[0.07] bg-white/[0.025] text-[10px] text-zinc-500 hover:text-white hover:bg-white/[0.045]"><Wallet className="w-3.5 h-3.5"/><span>{formatCentsToBRL(wallet?.available_balance_cents||0)}</span></button>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <button onClick={()=>onNavigate('create-image')} className="group relative min-h-[190px] overflow-hidden rounded-[22px] border border-white/[0.08] bg-[radial-gradient(circle_at_76%_28%,rgba(168,85,247,.26),transparent_30%),radial-gradient(circle_at_82%_80%,rgba(20,184,166,.16),transparent_26%),#11141a] p-5 sm:p-6 text-left hover:border-violet-400/20 transition-all">
          <div className="absolute right-5 top-5 w-24 h-24 rounded-[28px] border border-white/[0.07] bg-white/[0.03] rotate-6 grid place-items-center shadow-2xl"><ImageIcon className="w-9 h-9 text-violet-300/70"/></div>
          <div className="relative z-10 max-w-[68%]"><div className="w-9 h-9 rounded-xl bg-violet-400/10 border border-violet-400/15 grid place-items-center"><Sparkles className="w-4 h-4 text-violet-300"/></div><h2 className="mt-4 text-lg font-bold text-white">Gerar imagem</h2><p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">Crie do zero ou use referências, personagens e produtos da Biblioteca.</p><span className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-bold text-violet-200 group-hover:text-white">Abrir Image Studio <ArrowRight className="w-3 h-3"/></span></div>
        </button>
        <button onClick={()=>onNavigate('create-video')} className="group relative min-h-[190px] overflow-hidden rounded-[22px] border border-white/[0.08] bg-[radial-gradient(circle_at_75%_28%,rgba(16,185,129,.25),transparent_30%),radial-gradient(circle_at_88%_82%,rgba(6,182,212,.14),transparent_26%),#101519] p-5 sm:p-6 text-left hover:border-emerald-400/20 transition-all">
          <div className="absolute right-5 top-5 w-24 h-24 rounded-[28px] border border-white/[0.07] bg-white/[0.03] -rotate-6 grid place-items-center shadow-2xl"><Video className="w-9 h-9 text-emerald-300/70"/></div>
          <div className="relative z-10 max-w-[68%]"><div className="w-9 h-9 rounded-xl bg-emerald-400/10 border border-emerald-400/15 grid place-items-center"><WandSparkles className="w-4 h-4 text-emerald-300"/></div><h2 className="mt-4 text-lg font-bold text-white">Gerar vídeo</h2><p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">Anime imagens, combine referências e escolha entre os melhores modelos.</p><span className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-200 group-hover:text-white">Abrir Video Studio <ArrowRight className="w-3 h-3"/></span></div>
        </button>
      </div>
    </section>

    <section>
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-white">Comece por uma ideia</h2><p className="mt-0.5 text-[10px] text-zinc-600">Atalhos visuais para entrar no fluxo certo sem precisar decidir tudo antes.</p></div><button onClick={()=>onNavigate('library')} className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 hover:text-white"><Images className="w-3.5 h-3.5"/> Biblioteca</button></div>
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 gap-3">{starterIdeas.map(({title,subtitle,icon:Icon,mode,bg})=><button key={title} onClick={()=>onNavigate(mode)} className="group relative min-h-[132px] overflow-hidden rounded-2xl border border-white/[0.07] p-4 text-left hover:border-white/[0.14] transition-all" style={{background:bg}}><div className="absolute -right-5 -bottom-7 w-24 h-24 rounded-full border border-white/[0.05] bg-white/[0.02]"/><Icon className="w-4 h-4 text-zinc-300"/><h3 className="mt-6 text-xs font-bold text-white">{title}</h3><p className="mt-1 max-w-[90%] text-[9px] leading-relaxed text-zinc-500">{subtitle}</p><ArrowRight className="absolute right-3 bottom-3 w-3.5 h-3.5 text-zinc-700 group-hover:text-white transition-colors"/></button>)}</div>
    </section>

    {completed.length>0 && <section><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-white">Suas criações recentes</h2><p className="mt-0.5 text-[10px] text-zinc-600">Continue de onde parou ou reutilize uma criação como referência.</p></div><button onClick={()=>onNavigate('history')} className="text-[10px] font-semibold text-zinc-500 hover:text-white">Ver todas</button></div><div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{completed.slice(0,4).map(g=><button key={g.generation_id} onClick={()=>onNavigate('history')} className="text-left group"><div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/[0.07] bg-[#0d1015] relative">{g.result_url?(g.mode==='TEXT_TO_IMAGE'||g.mode==='IMAGE_TO_IMAGE'?<img src={g.result_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"/>:<video src={g.result_url} muted preload="metadata" className="w-full h-full object-cover"/>):<div className="w-full h-full grid place-items-center"><Sparkles className="w-5 h-5 text-zinc-700"/></div>}</div><p className="mt-2 text-[10px] font-medium text-zinc-300 truncate">{g.original_prompt||'Criação'}</p><p className="mt-0.5 text-[9px] text-zinc-700 truncate">{g.model_id}</p></button>)}</div></section>}

    {completed.length===0 && <section className="rounded-[22px] border border-white/[0.07] bg-[#101319] p-5 sm:p-6"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300"><Sparkles className="w-3 h-3"/> Primeiro projeto</span><h2 className="mt-2 text-base font-bold text-white">Sua vitrine vai nascer das suas próprias criações.</h2><p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-zinc-500">Assim que você gerar suas primeiras imagens e vídeos, esta área passa a mostrar seus trabalhos recentes em vez de conteúdo genérico ou demonstrativo.</p></div><button onClick={()=>onNavigate('create-image')} className="h-10 px-4 rounded-xl bg-white text-black text-[10px] font-bold whitespace-nowrap hover:bg-zinc-200">Criar primeira imagem</button></div></section>}

    {assets.length>0 && <section className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4"><div className="flex items-center justify-between"><div><h2 className="text-xs font-bold text-white">Da sua Biblioteca</h2><p className="mt-0.5 text-[9px] text-zinc-600">Assets prontos para reutilizar.</p></div><button onClick={()=>onNavigate('library')} className="text-[9px] text-zinc-500 hover:text-white">Abrir Biblioteca</button></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{assets.slice(0,8).map(asset=><button key={asset.asset_id} onClick={()=>onNavigate('library')} className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-white/[0.06] bg-[#0b0e13]">{asset.type==='IMAGE'&&asset.public_url?<img src={asset.thumbnail_url||asset.public_url} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full grid place-items-center"><Video className="w-4 h-4 text-zinc-700"/></div>}</button>)}</div></section>}
  </div>;
};
