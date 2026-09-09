import React, { useEffect, useState } from 'react';
import { Asset } from '../../types/index.js';
import { CreateView } from './CreateView.js';
import { ImageCreateView } from './ImageCreateView.js';

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
    <div className="flex-1 min-h-0">{mediaMode==='VIDEO'
      ? <CreateView initialAsset={videoSeedAsset} onEditImage={editImage}/>
      : <ImageCreateView onUseImageForVideo={useImageForVideo} initialEditAsset={imageEditAsset}/>
    }</div>
  </div>;
};