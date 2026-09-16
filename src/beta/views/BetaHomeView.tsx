import React from 'react';
import { Box, Image as ImageIcon, Music2, Network, Sparkles, Video } from 'lucide-react';

const modules = [
  { key: 'image', title: 'Imagem', description: 'Criação e edição visual em um único espaço.', icon: ImageIcon },
  { key: 'video', title: 'Vídeo', description: 'Geração, extensão e edição generativa.', icon: Video },
  { key: 'audio', title: 'Áudio', description: 'Voz, música, efeitos, transcrição e dublagem.', icon: Music2 },
  { key: '3d', title: '3D', description: 'Geração, visualização e texturização de objetos.', icon: Box },
  { key: 'flows', title: 'Fluxos', description: 'Conecte ferramentas em workflows multimodais.', icon: Network },
] as const;

export const BetaHomeView: React.FC = () => (
  <main className="ia-beta-home">
    <section className="ia-beta-hero" aria-labelledby="ia-beta-title">
      <div className="ia-beta-kicker"><Sparkles aria-hidden="true" /> IA Conect Beta</div>
      <h1 id="ia-beta-title">Crie, conecte e automatize.</h1>
      <p>Uma nova experiência do IA Conect está sendo construída para unir imagem, vídeo, áudio, 3D e Fluxos no mesmo sistema.</p>
    </section>

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
          <article className="ia-beta-module-card" key={key}>
            <div className="ia-beta-module-icon"><Icon aria-hidden="true" /></div>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <span className="ia-beta-module-status">Em preparação</span>
          </article>
        ))}
      </div>
    </section>
  </main>
);
