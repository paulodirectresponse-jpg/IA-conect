import React, { useEffect, useState } from 'react';
import { Navbar } from './Navbar.js';
import { Sidebar } from './Sidebar.js';

interface AppLayoutProps { currentView:string; onNavigate:(view:string)=>void; children:React.ReactNode; }

type ThemeMode='dark'|'light';
const THEME_KEY='ia-connect-theme';
function initialTheme():ThemeMode{
  try{
    const saved=localStorage.getItem(THEME_KEY);
    if(saved==='light'||saved==='dark')return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches?'light':'dark';
  }catch{return'dark';}
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentView,onNavigate,children }) => {
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [theme,setTheme]=useState<ThemeMode>(initialTheme);
  const isCreateView=currentView==='create-video'||currentView==='create-image';
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    document.documentElement.style.colorScheme=theme;
    try{localStorage.setItem(THEME_KEY,theme)}catch{}
  },[theme]);
  const toggleTheme=()=>setTheme(value=>value==='dark'?'light':'dark');
  return <div data-theme={theme} className="ia-shell flex h-screen overflow-hidden text-zinc-100 font-sans antialiased">
    <Sidebar currentView={currentView} onNavigate={onNavigate} isOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)}/>
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-[radial-gradient(circle_at_78%_-8%,rgba(25,184,255,.08),transparent_31%),linear-gradient(180deg,#07111b_0%,#050b12_100%)]">
      <Navbar onToggleSidebar={()=>setSidebarOpen(!sidebarOpen)} onNavigate={onNavigate} theme={theme} onToggleTheme={toggleTheme}/>
      <main className={`flex-1 min-w-0 ${isCreateView?'overflow-hidden flex flex-col':'overflow-y-auto px-4 py-5 sm:px-6 lg:px-7 lg:py-6'}`}>{isCreateView?children:<div className="max-w-[1420px] mx-auto w-full">{children}</div>}</main>
    </div>
  </div>;
};
