import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Asset } from '../../types/index.js';
const CreateView=lazy(()=>import('./CreateView.js').then(m=>({default:m.CreateView})));
const ImageCreateView=lazy(()=>import('./ImageCreateView.js').then(m=>({default:m.ImageCreateView})));

export const CreateHubView: React.FC<{ initialMode?: 'VIDEO' | 'IMAGE' }> = ({ initialMode = 'VIDEO' }) => {
  const [mediaMode, setMediaMode] = useState<'VIDEO' | 'IMAGE'>(initialMode);
  const [videoSeedAsset, setVideoSeedAsset] = useState<Asset | null>(null);
  const [imageEditAsset, setImageEditAsset] = useState<Asset | null>(null);
  const [handoffNotice, setHandoffNotice] = useState('');
  useEffect(()=>setMediaMode(initialMode),[initialMode]);

  const useImageForVideo = (asset: Asset) => {
    setVideoSeedAsset(asset);
    setHandoffNotice(`${asset.name} foi colocada como imagem inicial do vídeo.`);
    setMediaMode('VIDEO');
    window.setTimeout(() => setHandoffNotice(''), 3200);
  };

  const editImage = (asset: Asset) => {
    setImageEditAsset(asset);
    setHandoffNotice(`${asset.name} foi preparada para edição.`);
    setMediaMode('IMAGE');
    window.setTimeout(() => setHandoffNotice(''), 3200);
  };

  return <div className="h-full min-h-0 flex flex-col bg-[radial-gradient(circle_at_82%_-10%,rgba(25,184,255,.07),transparent_28%),#06101a]">
    {handoffNotice && <div className="shrink-0 mx-3 mt-2 rounded-lg border border-sky-300/20 bg-sky-300/[0.07] px-3 py-1.5 text-[9px] font-medium text-sky-200">{handoffNotice}</div>}
    <div className="flex-1 min-h-0"><Suspense fallback={<div className="h-full min-h-[300px] grid place-items-center"><div className="w-5 h-5 rounded-full border-2 border-sky-400/70 border-t-transparent animate-spin"/></div>}>{mediaMode==='VIDEO'
      ? <CreateView initialAsset={videoSeedAsset} onEditImage={editImage}/>
      : <ImageCreateView onUseImageForVideo={useImageForVideo} initialEditAsset={imageEditAsset}/>
    }</Suspense></div>
  </div>;
};