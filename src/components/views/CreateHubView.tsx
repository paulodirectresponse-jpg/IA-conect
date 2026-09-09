import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, Video } from 'lucide-react';
import { Asset } from '../../types/index.js';
import { CreateView } from './CreateView.js';
import { ImageCreateView } from './ImageCreateView.js';

export const CreateHubView: React.FC = () => {
  const [mediaMode, setMediaMode] = useState<'VIDEO' | 'IMAGE'>('VIDEO');
  const [handoffNotice, setHandoffNotice] = useState('');

  const useImageForVideo = (asset: Asset) => {
    setHandoffNotice(`${asset.name} foi preparada como imagem inicial do vídeo.`);
    setMediaMode('VIDEO');
    window.setTimeout(() => setHandoffNotice(''), 4500);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0b0e13]">
      <div className="shrink-0 h-[52px] px-3 md:px-4 border-b border-white/[0.055] bg-[#090c11]/96 backdrop-blur-xl flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.025] border border-white/[0.06]">
          <button type="button" onClick={() => setMediaMode('VIDEO')} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-bold transition-all ${mediaMode === 'VIDEO' ? 'bg-white/[0.09] text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-300'}`}><Video className="w-3.5 h-3.5" /> Vídeo</button>
          <button type="button" onClick={() => setMediaMode('IMAGE')} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-bold transition-all ${mediaMode === 'IMAGE' ? 'bg-white/[0.09] text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-300'}`}><ImageIcon className="w-3.5 h-3.5" /> Imagem</button>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.13em] text-zinc-700"><Sparkles className="w-3 h-3 text-violet-400"/> Auto Router · Assets compartilhados</div>
      </div>
      {handoffNotice && <div className="shrink-0 mx-3 mt-2 rounded-lg border border-violet-400/20 bg-violet-400/[0.08] px-3 py-1.5 text-[9px] font-medium text-violet-200">{handoffNotice}</div>}
      <div className="flex-1 min-h-0">{mediaMode === 'VIDEO' ? <CreateView /> : <ImageCreateView onUseImageForVideo={useImageForVideo} />}</div>
    </div>
  );
};
