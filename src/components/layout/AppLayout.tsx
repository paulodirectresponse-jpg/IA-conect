import React, { useState } from 'react';
import { Navbar } from './Navbar.js';
import { Sidebar } from './Sidebar.js';

interface AppLayoutProps { currentView:string; onNavigate:(view:string)=>void; children:React.ReactNode; }

export const AppLayout: React.FC<AppLayoutProps> = ({ currentView,onNavigate,children }) => {
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const isCreateView=currentView==='create-video'||currentView==='create-image';
  return <div className="ia-shell flex h-screen overflow-hidden text-zinc-100 font-sans antialiased">
    <Sidebar currentView={currentView} onNavigate={onNavigate} isOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)}/>
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-[radial-gradient(circle_at_78%_-8%,rgba(25,184,255,.08),transparent_31%),linear-gradient(180deg,#07111b_0%,#050b12_100%)]">
      <Navbar onToggleSidebar={()=>setSidebarOpen(!sidebarOpen)} onNavigate={onNavigate}/>
      <main className={`flex-1 min-w-0 ${isCreateView?'overflow-hidden flex flex-col':'overflow-y-auto px-4 py-5 sm:px-6 lg:px-7 lg:py-6'}`}>{isCreateView?children:<div className="max-w-[1420px] mx-auto w-full">{children}</div>}</main>
    </div>
  </div>;
};
