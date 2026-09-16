import React from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { BrandMark } from '../components/common/BrandMark.js';
import { BetaHomeView } from './views/BetaHomeView.js';
import './styles/beta.css';

interface BetaAppProps {
  onExit: () => void;
}

export const BetaApp: React.FC<BetaAppProps> = ({ onExit }) => (
  <div className="ia-beta-shell" data-theme="dark">
    <header className="ia-beta-navbar">
      <div className="ia-beta-brand">
        <BrandMark compact />
        <span className="ia-beta-badge"><FlaskConical aria-hidden="true" /> Beta</span>
      </div>
      <button type="button" className="ia-beta-exit" onClick={onExit}>
        <ArrowLeft aria-hidden="true" />
        <span>Voltar à versão atual</span>
      </button>
    </header>
    <BetaHomeView />
  </div>
);

export default BetaApp;
