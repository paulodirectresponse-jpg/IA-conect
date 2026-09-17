import React, { useEffect, useState } from 'react';
import { Navbar } from './Navbar.js';
import { Sidebar } from './Sidebar.js';
import { cssImageSet, enterpriseVisualAssets } from '../../config/enterpriseVisualAssets.js';
import { markViewRendered } from '../../utils/performanceMetrics.js';

interface AppLayoutProps {
  currentView: string;
  onNavigate: (view: string) => void;
  betaEnabled?: boolean;
  children: React.ReactNode;
}

const THEME_KEY = 'ia-connect-theme';

export const AppLayout: React.FC<AppLayoutProps> = ({ currentView, onNavigate, betaEnabled = false, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isCreateView = currentView === 'create-video' || currentView === 'create-image' || currentView === 'create-voice' || currentView === 'create-music' || currentView === 'create-3d';

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

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const syncLock = () => {
      const shouldLock = sidebarOpen && media.matches;
      document.documentElement.classList.toggle('ia-mobile-nav-lock', shouldLock);
      if (!media.matches && sidebarOpen) setSidebarOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sidebarOpen) setSidebarOpen(false);
    };
    syncLock();
    media.addEventListener('change', syncLock);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      media.removeEventListener('change', syncLock);
      document.removeEventListener('keydown', onKeyDown);
      document.documentElement.classList.remove('ia-mobile-nav-lock');
    };
  }, [sidebarOpen]);

  const enterpriseVisualStyle = {
    '--ia-art-planet-home': cssImageSet(enterpriseVisualAssets.homePlanet),
    '--ia-art-planet-community': cssImageSet(enterpriseVisualAssets.communityPlanet),
    '--ia-art-planet-library': cssImageSet(enterpriseVisualAssets.libraryPlanet),
    '--ia-art-planet-studio': cssImageSet(enterpriseVisualAssets.studioPlanet),
    '--ia-art-planet-mobile': cssImageSet(enterpriseVisualAssets.mobilePlanet),
    '--ia-art-create-image': cssImageSet(enterpriseVisualAssets.createImageHero),
    '--ia-art-create-video': cssImageSet(enterpriseVisualAssets.createVideoHero),
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
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          onNavigate={onNavigate}
          betaEnabled={betaEnabled}
        />

        <main className={`ia-shell-main min-w-0 flex-1 ${isCreateView ? 'ia-shell-main-create flex flex-col overflow-hidden' : 'ia-shell-main-standard overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 xl:px-10 lg:py-8'}`}>
          {isCreateView ? children : <div className="mx-auto w-full max-w-[1480px]">{children}</div>}
        </main>
      </div>
    </div>
  );
};