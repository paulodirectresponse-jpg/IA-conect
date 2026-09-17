import React from 'react';
import { ArrowRight, Box, Image as ImageIcon, Music2, Network, Sparkles, Video } from 'lucide-react';
import { BetaLibraryIntent } from '../libraryClient.js';

const modules = [
  { key: 'image', title: 'Imagem', description: 'Criação e edição visual em um único espaço.', icon: ImageIcon },
  { key: 'video', title: 'Vídeo', description: 'Geração, extensão e edição generativa.', icon: Video },
  { key: 'audio', title: 'Áudio', description: 'Voz, música, efeitos, transcrição e dublagem.', icon: Music2 },
  { key: '3d', title: '3D', description: 'Geração, visualização e texturização de objetos.', icon: Box },
  { key: 'flows', title: 'Fluxos', description: 'Conecte ferramentas em workflows multimodais.', icon: Network },
] as const;

export const BetaHomeView: React.FC<{pendingIntent?:BetaLibraryIntent|null;onOpenLibrary?:()=>void;audioEnabled?:boolean;onOpenAudio?:()=>void;imageEditorEnabled?:boolean;onOpenImageEditor?:()=>void;videoEnabled?:boolean;onOpenVideo?:()=>void;threeDEnabled?:boolean;onOpenThreeD?:()=>void;flowsEnabled?:boolean;onOpenFlows?:()=>void}> = ({pendingIntent,onOpenLibrary,audioEnabled,onOpenAudio,imageEditorEnabled,onOpenImageEditor,videoEnabled,onOpenVideo,threeDEnabled,onOpenThreeD,flowsEnabled,onOpenFlows}) => (
  <main className="ia-beta-home">
    <section className="ia-beta-hero" aria-labelledby="ia-beta-title">
      <div className="ia-beta-kicker"><Sparkles aria-hidden="true" /> IA Conect Beta</div>
      <h1 id="ia-beta-title">Crie, conecte e automatize.</h1>
      <p>Uma nova experiência do IA Conect está sendo construída para unir imagem, vídeo, áudio, 3D e Fluxos no mesmo sistema.</p>
    </section>

    {pendingIntent&&<section className="ia-beta-intent-card" aria-label="Asset preparado">
      <div><span>{pendingIntent.action==='REMIX'?'Remix preparado':'Asset preparado'}</span><strong>{pendingIntent.asset.name}</strong><p>Disponível para {pendingIntent.suggested_targets.join(', ')}. Os próximos módulos poderão consumir este intent sem duplicar o asset.</p></div>
      <button type="button" onClick={onOpenLibrary}>Abrir Library <ArrowRight/></button>
    </section>}

    <section className="ia-beta-section" aria-labelledby="ia-beta-modules-title">
      <div className="ia-beta-section-heading">
        <div>
          <span>Laboratório</span>
          <h2 id="ia-beta-modules-title">O que você quer criar?</h2>
        </div>
        <p>Os módulos serão liberados progressivamente durante o Beta.</p>
      </div>
      <div className="ia-beta-module-grid">
        {modules.map(({ key, title, description, icon: Icon }) => (
          <article className={`ia-beta-module-card ${(key==='image'&&imageEditorEnabled)||(key==='video'&&videoEnabled)||(key==='audio'&&audioEnabled)||(key==='3d'&&threeDEnabled)||(key==='flows'&&flowsEnabled)?'is-available':''}`} key={key}>
            <div className="ia-beta-module-icon"><Icon aria-hidden="true" /></div>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            {key==='image'&&imageEditorEnabled
              ?<button className="ia-beta-module-open" type="button" onClick={onOpenImageEditor}>Abrir Image Editor <ArrowRight/></button>
              :key==='video'&&videoEnabled?<button className="ia-beta-module-open" type="button" onClick={onOpenVideo}>Abrir Video V1 <ArrowRight/></button>
              :key==='audio'&&audioEnabled
              ?<button className="ia-beta-module-open" type="button" onClick={onOpenAudio}>Abrir Audio V1 <ArrowRight/></button>
              :key==='3d'&&threeDEnabled?<button className="ia-beta-module-open" type="button" onClick={onOpenThreeD}>Abrir 3D V1 <ArrowRight/></button>
              :key==='flows'&&flowsEnabled?<button className="ia-beta-module-open" type="button" onClick={onOpenFlows}>Abrir Flows Editor <ArrowRight/></button>
              :<span className="ia-beta-module-status">Em preparação</span>}
          </article>
        ))}
      </div>
    </section>
  </main>
);
