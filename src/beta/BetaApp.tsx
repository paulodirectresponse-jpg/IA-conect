import React, { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, Box, FlaskConical, Home, Image as ImageIcon, Library, Music2, Video } from 'lucide-react';
import { BrandMark } from '../components/common/BrandMark.js';
import { BetaHomeView } from './views/BetaHomeView.js';
import { BetaLibraryView } from './views/BetaLibraryView.js';
import { BetaLibraryIntent } from './libraryClient.js';
import { TaskCenter } from './components/TaskCenter.js';
import { getPublicBetaFlags } from './services/betaAccessService.js';
import './styles/beta.css';

interface BetaAppProps {
  onExit: () => void;
}

const INTENT_KEY='ia-conect:beta:library-intent:v1';
const BetaAudioView=lazy(()=>import('./views/BetaAudioView.js').then(module=>({default:module.BetaAudioView})));
const BetaThreeDView=lazy(()=>import('./views/BetaThreeDView.js').then(module=>({default:module.BetaThreeDView})));
const BetaImageEditorView=lazy(()=>import('./views/BetaImageEditorView.js').then(module=>({default:module.BetaImageEditorView})));
const BetaVideoView=lazy(()=>import('./views/BetaVideoView.js').then(module=>({default:module.BetaVideoView})));

export const BetaApp: React.FC<BetaAppProps> = ({ onExit }) => {
  const [view,setView]=useState<'home'|'library'|'audio'|'three-d'|'image-editor'|'video'>('home');
  const [flags,setFlags]=useState<Record<string,boolean>>({});
  const [intent,setIntent]=useState<BetaLibraryIntent|null>(()=>{
    if(typeof window==='undefined')return null;
    try{return JSON.parse(window.sessionStorage.getItem(INTENT_KEY)||'null');}catch{return null;}
  });

  useEffect(()=>{void getPublicBetaFlags().then(setFlags).catch(()=>setFlags({}));},[]);

  const handleIntent=(next:BetaLibraryIntent)=>{
    setIntent(next);
    try{window.sessionStorage.setItem(INTENT_KEY,JSON.stringify(next));}catch{}
    window.dispatchEvent(new CustomEvent('ia:beta:library-intent',{detail:next}));
    setView('home');
  };

  return <div className="ia-beta-shell" data-theme="dark">
    <header className="ia-beta-navbar">
      <div className="ia-beta-brand">
        <BrandMark compact />
        <span className="ia-beta-badge"><FlaskConical aria-hidden="true" /> Beta</span>
      </div>
      <nav className="ia-beta-primary-nav" aria-label="Navegação Beta">
        <button className={view==='home'?'is-selected':''} onClick={()=>setView('home')}><Home/><span>Início</span></button>
        <button className={view==='library'?'is-selected':''} onClick={()=>setView('library')}><Library/><span>Library</span></button>
        {flags['beta.audio']&&<button className={view==='audio'?'is-selected':''} onClick={()=>setView('audio')}><Music2/><span>Áudio</span></button>}
        {flags['beta.image_editor']&&<button className={view==='image-editor'?'is-selected':''} onClick={()=>setView('image-editor')}><ImageIcon/><span>Imagem</span></button>}
        {flags['beta.video']&&<button className={view==='video'?'is-selected':''} onClick={()=>setView('video')}><Video/><span>Vídeo</span></button>}
        {flags['beta.three_d']&&<button className={view==='three-d'?'is-selected':''} onClick={()=>setView('three-d')}><Box/><span>3D</span></button>}
      </nav>
      <div className="ia-beta-navbar-actions">
        <TaskCenter />
        <button type="button" className="ia-beta-exit" onClick={onExit}>
          <ArrowLeft aria-hidden="true" />
          <span>Voltar à versão atual</span>
        </button>
      </div>
    </header>
    {view==='home'
      ?<BetaHomeView pendingIntent={intent} onOpenLibrary={()=>setView('library')} audioEnabled={flags['beta.audio']===true} onOpenAudio={()=>setView('audio')} imageEditorEnabled={flags['beta.image_editor']===true} onOpenImageEditor={()=>setView('image-editor')} videoEnabled={flags['beta.video']===true} onOpenVideo={()=>setView('video')} threeDEnabled={flags['beta.three_d']===true} onOpenThreeD={()=>setView('three-d')}/>
      :view==='library'?<BetaLibraryView onIntent={handleIntent}/>
      :view==='audio'?<Suspense fallback={<div className="ia-beta-module-loading">Carregando Audio V1…</div>}><BetaAudioView onOpenLibrary={()=>setView('library')}/></Suspense>
      :view==='image-editor'?<Suspense fallback={<div className="ia-beta-module-loading">Carregando Image Editor…</div>}><BetaImageEditorView initialAssetId={intent?.asset.type==='IMAGE'?intent.asset.asset_id:null} onOpenLibrary={()=>setView('library')}/></Suspense>
      :view==='video'?<Suspense fallback={<div className="ia-beta-module-loading">Carregando Video V1…</div>}><BetaVideoView initialAssetId={intent&&['IMAGE','VIDEO'].includes(intent.asset.type)?intent.asset.asset_id:null} initialAssetType={intent?.asset.type||null} onOpenLibrary={()=>setView('library')}/></Suspense>
      :<Suspense fallback={<div className="ia-beta-module-loading">Carregando 3D V1…</div>}><BetaThreeDView onOpenLibrary={()=>setView('library')}/></Suspense>}
  </div>;
};

export default BetaApp;
