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
  const isCreateView = currentView === 'create';

  return (
    <div className="flex h-screen bg-[#F7F7F8] overflow-hidden text-[#18181B] font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-[#F7F7F8]">
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onNavigate={onNavigate}
        />
        <main
          className={`flex-1 min-w-0 ${
            isCreateView
              ? 'overflow-hidden flex flex-col'
              : 'overflow-y-auto p-4 sm:p-6 lg:p-8'
          }`}
        >
          {isCreateView ? (
            children
          ) : (
            <div className="max-w-7xl mx-auto w-full">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
};
