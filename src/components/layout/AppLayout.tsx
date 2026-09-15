import React, { useEffect, useState } from 'react';
import { Navbar } from './Navbar.js';
import { Sidebar } from './Sidebar.js';
import { enterpriseVisualAssets } from '../../config/enterpriseVisualAssets.js';
import { markViewRendered } from '../../utils/performanceMetrics.js';

interface AppLayoutProps {
  currentView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
}

const THEME_KEY = 'ia-connect-theme';

export const AppLayout: React.FC<AppLayoutProps> = ({ currentView, onNavigate, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isCreateView = currentView === 'create-video' || currentView === 'create-image';

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
    try {
      localStorage.setItem(THEME_KEY, 'dark');
    } catch {
      // Storage can be unavailable in privacy-restricted contexts.
    }
  }, []);

  useEffect(() => {
    markViewRendered(currentView);
  }, [currentView]);

  const enterpriseVisualStyle = {
    '--ia-art-planet-home': `url("${enterpriseVisualAssets.homePlanet}")`,
    '--ia-art-planet-community': `url("${enterpriseVisualAssets.communityPlanet}")`,
    '--ia-art-planet-library': `url("${enterpriseVisualAssets.libraryPlanet}")`,
    '--ia-art-planet-studio': `url("${enterpriseVisualAssets.studioPlanet}")`,
    '--ia-art-planet-mobile': `url("${enterpriseVisualAssets.mobilePlanet}")`,
    '--ia-art-create-image': `url("${enterpriseVisualAssets.createImageHero}")`,
    '--ia-art-create-video': `url("${enterpriseVisualAssets.createVideoHero}")`,
  } as React.CSSProperties & Record<string, string>;

  return (
    <div data-theme="dark" style={enterpriseVisualStyle} className="ia-shell flex h-screen overflow-hidden font-sans antialiased text-[var(--ia-text-1)]">
      <Sidebar
        currentView={currentView}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="ia-shell-workspace flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar
          currentView={currentView}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          onNavigate={onNavigate}
        />

        <main className={`min-w-0 flex-1 ${isCreateView ? 'flex flex-col overflow-hidden' : 'overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 xl:px-10 lg:py-8'}`}>
          {isCreateView ? children : <div className="mx-auto w-full max-w-[1480px]">{children}</div>}
        </main>
      </div>
    </div>
  );
};
