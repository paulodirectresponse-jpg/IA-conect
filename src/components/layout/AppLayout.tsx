import React, { useState } from 'react';
import { Navbar } from './Navbar.js';
import { Sidebar } from './Sidebar.js';

interface AppLayoutProps {
  currentView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  onNavigate,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden text-zinc-900 font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onNavigate={onNavigate}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
