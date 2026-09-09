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
    <div className="h-full min-h-0 flex flex-col bg-transparent">
      <div className="shrink-0 px-4 md:px-5 py-2.5 border-b border-white/[0.06] bg-[#0b0e13]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.035] border border-white/[0.07]">
            <button type="button" onClick={() => setMediaMode('VIDEO')} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${mediaMode === 'VIDEO' ? 'bg-white/[0.09] text-white shadow-sm ring-1 ring-white/[0.06]' : 'text-zinc-500 hover:text-zinc-200'}`}>
              <Video className="w-3.5 h-3.5" /> Vídeo
            </button>
            <button type="button" onClick={() => setMediaMode('IMAGE')} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${mediaMode === 'IMAGE' ? 'bg-white/[0.09] text-white shadow-sm ring-1 ring-white/[0.06]' : 'text-zinc-500 hover:text-zinc-200'}`}>
              <ImageIcon className="w-3.5 h-3.5" /> Imagem
            </button>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[9px] font-medium text-zinc-600"><Sparkles className="w-3 h-3 text-violet-400"/> Studio unificado · Assets compartilhados · Auto Router</div>
        </div>
        {handoffNotice && <div className="mt-2 rounded-lg border border-violet-400/20 bg-violet-400/[0.08] px-3 py-1.5 text-[10px] font-medium text-violet-200">{handoffNotice}</div>}
      </div>
      <div className="flex-1 min-h-0">{mediaMode === 'VIDEO' ? <CreateView /> : <ImageCreateView onUseImageForVideo={useImageForVideo} />}</div>
    </div>
  );
};
