import React, { useState } from 'react';
import { Navbar } from './Navbar.js';
import { Sidebar } from './Sidebar.js';

interface AppLayoutProps { currentView:string; onNavigate:(view:string)=>void; children:React.ReactNode; }

export const AppLayout: React.FC<AppLayoutProps> = ({ currentView,onNavigate,children }) => {
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const isCreateView=currentView==='create-video'||currentView==='create-image';
  return <div className="ia-shell flex h-screen bg-[#080a0f] overflow-hidden text-zinc-100 font-sans antialiased">
    <Sidebar currentView={currentView} onNavigate={onNavigate} isOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)}/>
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-[radial-gradient(circle_at_80%_-20%,rgba(34,211,238,.055),transparent_34%),#0b0e13]">
      <Navbar onToggleSidebar={()=>setSidebarOpen(!sidebarOpen)} onNavigate={onNavigate}/>
      <main className={`flex-1 min-w-0 ${isCreateView?'overflow-hidden flex flex-col':'overflow-y-auto px-4 py-5 sm:px-6 lg:px-7 lg:py-6'}`}>{isCreateView?children:<div className="max-w-[1480px] mx-auto w-full">{children}</div>}</main>
    </div>
  </div>;
};
