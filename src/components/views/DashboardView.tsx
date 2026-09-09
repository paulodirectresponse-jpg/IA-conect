import React, { useEffect, useState } from 'react';
import { ArrowRight, Image as ImageIcon, Images, Sparkles, Video, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { generationClient } from '../../services/generationClient.js';
import { assetService } from '../../services/assetService.js';
import { Asset, Generation } from '../../types/index.js';

interface DashboardViewProps { onNavigate: (view: string) => void; }

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { profile, wallet } = useAuth();
  const [recent, setRecent] = useState<Generation[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    generationClient.list(8).then(setRecent).catch(() => setRecent([]));
    assetService.listAssets().then((rows) => setAssets(rows.slice(0, 8))).catch(() => setAssets([]));
  }, []);

  const panel = 'rounded-2xl border border-white/[0.07] bg-[#11151c] shadow-[0_18px_55px_rgba(0,0,0,.12)]';
  const completed = recent.filter((g) => g.status === 'SUCCEEDED').length;

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[radial-gradient(circle_at_78%_30%,rgba(124,58,237,.19),transparent_30%),radial-gradient(circle_at_92%_72%,rgba(34,211,238,.09),transparent_24%),#11151c] px-5 py-6 sm:px-7 sm:py-8">
        <div className="relative z-10 max-w-2xl">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-400">Creative Studio</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-[-0.035em] text-white">Crie sem trocar de ferramenta.</h1>
          <p className="mt-2 max-w-xl text-xs sm:text-sm leading-relaxed text-zinc-500">Olá, {profile?.display_name || 'criador'}. Gere imagens, transforme referências em vídeo e reutilize seus Assets em um único workflow.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => onNavigate('create')} className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-[11px] font-bold text-white flex items-center gap-2 shadow-[0_12px_35px_rgba(124,58,237,.2)] hover:brightness-110"><Sparkles className="w-4 h-4"/> Criar agora</button>
            <button onClick={() => onNavigate('assets')} className="h-10 px-4 rounded-xl border border-white/[0.08] bg-white/[0.035] text-[11px] font-semibold text-zinc-300 flex items-center gap-2 hover:bg-white/[0.06]"><Images className="w-4 h-4"/> Abrir Assets</button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button onClick={() => onNavigate('create')} className={`${panel} group p-4 text-left hover:border-violet-400/20 transition-colors`}><div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-400/10 flex items-center justify-center"><ImageIcon className="w-4 h-4 text-violet-300"/></div><h2 className="mt-3 text-sm font-bold text-white">Gerar imagem</h2><p className="mt-1 text-[10px] leading-relaxed text-zinc-600">Modelos premium, referências e Auto Router.</p><span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 group-hover:text-white">Abrir studio <ArrowRight className="w-3 h-3"/></span></button>
        <button onClick={() => onNavigate('create')} className={`${panel} group p-4 text-left hover:border-cyan-400/20 transition-colors`}><div className="w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/10 flex items-center justify-center"><Video className="w-4 h-4 text-cyan-300"/></div><h2 className="mt-3 text-sm font-bold text-white">Gerar vídeo</h2><p className="mt-1 text-[10px] leading-relaxed text-zinc-600">Frames, referências multimodais e modelos cinematográficos.</p><span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 group-hover:text-white">Criar vídeo <ArrowRight className="w-3 h-3"/></span></button>
        <button onClick={() => onNavigate('wallet')} className={`${panel} group p-4 text-left hover:border-emerald-400/20 transition-colors`}><div className="flex items-start justify-between"><div className="w-9 h-9 rounded-xl bg-emerald-400/10 border border-emerald-400/10 flex items-center justify-center"><Wallet className="w-4 h-4 text-emerald-300"/></div><span className="text-[9px] text-zinc-600">Saldo</span></div><h2 className="mt-3 text-lg font-black text-white tabular-nums">{formatCentsToBRL(wallet?.available_balance_cents || 0)}</h2><p className="mt-1 text-[10px] text-zinc-600">Créditos disponíveis para novas gerações.</p></button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_.75fr] gap-4">
        <section className={`${panel} overflow-hidden`}>
          <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between"><div><h2 className="text-xs font-bold text-white">Criações recentes</h2><p className="mt-0.5 text-[9px] text-zinc-600">{recent.length ? `${completed} concluída(s) entre as últimas ${recent.length}` : 'Seu histórico criativo aparecerá aqui.'}</p></div><button onClick={() => onNavigate('history')} className="text-[10px] font-semibold text-zinc-500 hover:text-white">Ver histórico</button></div>
          {recent.length ? <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{recent.slice(0,6).map((g) => <div key={g.generation_id} className="min-w-0"><div className="aspect-video rounded-xl overflow-hidden bg-[#0b0e13] border border-white/[0.06]">{g.result_url ? <video src={g.result_url} muted preload="metadata" className="w-full h-full object-cover"/> : <div className="w-full h-full grid place-items-center"><Video className="w-5 h-5 text-zinc-700"/></div>}</div><p className="mt-1.5 text-[10px] font-medium text-zinc-300 truncate">{g.original_prompt || 'Geração'}</p><p className="text-[8px] text-zinc-700 truncate">{g.model_id} · {g.status}</p></div>)}</div> : <div className="h-44 flex flex-col items-center justify-center text-center"><Sparkles className="w-5 h-5 text-zinc-700"/><p className="mt-2 text-[10px] text-zinc-600">Nenhuma geração ainda.</p><button onClick={() => onNavigate('create')} className="mt-2 text-[10px] font-semibold text-violet-300">Criar a primeira</button></div>}
        </section>

        <section className={`${panel} overflow-hidden`}>
          <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between"><div><h2 className="text-xs font-bold text-white">Assets recentes</h2><p className="mt-0.5 text-[9px] text-zinc-600">Uploadados e gerados.</p></div><button onClick={() => onNavigate('assets')} className="text-[10px] font-semibold text-zinc-500 hover:text-white">Biblioteca</button></div>
          {assets.length ? <div className="p-3 grid grid-cols-4 gap-2">{assets.slice(0,8).map((asset) => <button key={asset.asset_id} onClick={() => onNavigate('assets')} className="aspect-square rounded-xl overflow-hidden border border-white/[0.06] bg-[#0b0e13] relative group">{asset.type === 'IMAGE' && asset.public_url ? <img src={asset.thumbnail_url || asset.public_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform"/> : <div className="w-full h-full grid place-items-center"><Video className="w-4 h-4 text-zinc-700"/></div>}</button>)}</div> : <div className="h-36 grid place-items-center text-[10px] text-zinc-600">Sua biblioteca está vazia.</div>}
        </section>
      </div>
    </div>
  );
};
