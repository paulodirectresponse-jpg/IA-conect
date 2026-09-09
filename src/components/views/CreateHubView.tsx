import React, { useState } from 'react';
import { Image as ImageIcon, Video } from 'lucide-react';
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
    <div className="h-full min-h-0 flex flex-col bg-[#F7F7F8]">
      <div className="shrink-0 px-4 md:px-6 pt-3 pb-2 border-b border-zinc-200/70 bg-white/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 border border-zinc-200">
            <button
              type="button"
              onClick={() => setMediaMode('VIDEO')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mediaMode === 'VIDEO' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Video className="w-3.5 h-3.5" /> Vídeo
            </button>
            <button
              type="button"
              onClick={() => setMediaMode('IMAGE')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mediaMode === 'IMAGE' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> Imagem
            </button>
          </div>
          <span className="hidden sm:block text-[10px] text-zinc-400">
            Um estúdio · mesmos Assets · Auto ou IA específica
          </span>
        </div>
        {handoffNotice && (
          <div className="max-w-7xl mx-auto mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-medium text-emerald-800">
            {handoffNotice}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {mediaMode === 'VIDEO' ? <CreateView /> : <ImageCreateView onUseImageForVideo={useImageForVideo} />}
      </div>
    </div>
  );
};
