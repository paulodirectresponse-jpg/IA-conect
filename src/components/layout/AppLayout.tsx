import React, { useEffect, useState } from 'react';
import { Navbar } from './Navbar.js';
import { Sidebar } from './Sidebar.js';

interface AppLayoutProps {
  currentView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
}

type ThemeMode = 'dark' | 'light';
const THEME_KEY = 'ia-connect-theme';

function initialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentView, onNavigate, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const isCreateView = currentView === 'create-video' || currentView === 'create-image';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage can be unavailable in privacy-restricted contexts.
    }
  }, [theme]);

  const toggleTheme = () => setTheme((value) => (value === 'dark' ? 'light' : 'dark'));

  return (
    <div data-theme={theme} className="ia-shell flex h-screen overflow-hidden font-sans antialiased text-[var(--ia-text-1)]">
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
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className={`min-w-0 flex-1 ${isCreateView ? 'flex flex-col overflow-hidden' : 'overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7'}`}>
          {isCreateView ? children : <div className="mx-auto w-full max-w-[1440px]">{children}</div>}
        </main>
      </div>
    </div>
  );
};
