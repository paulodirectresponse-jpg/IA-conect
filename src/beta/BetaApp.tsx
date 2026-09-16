import React, { useState } from 'react';
import { ArrowLeft, FlaskConical, Home, Library } from 'lucide-react';
import { BrandMark } from '../components/common/BrandMark.js';
import { BetaHomeView } from './views/BetaHomeView.js';
import { BetaLibraryView } from './views/BetaLibraryView.js';
import { BetaLibraryIntent } from './libraryClient.js';
import { TaskCenter } from './components/TaskCenter.js';
import './styles/beta.css';

interface BetaAppProps {
  onExit: () => void;
}

const INTENT_KEY='ia-conect:beta:library-intent:v1';

export const BetaApp: React.FC<BetaAppProps> = ({ onExit }) => {
  const [view,setView]=useState<'home'|'library'>('home');
  const [intent,setIntent]=useState<BetaLibraryIntent|null>(()=>{
    if(typeof window==='undefined')return null;
    try{return JSON.parse(window.sessionStorage.getItem(INTENT_KEY)||'null');}catch{return null;}
  });

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
      ?<BetaHomeView pendingIntent={intent} onOpenLibrary={()=>setView('library')}/>
      :<BetaLibraryView onIntent={handleIntent}/>}
  </div>;
};

export default BetaApp;
