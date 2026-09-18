import React from 'react';

interface EditorWorkspaceShellProps{
  topbar:React.ReactNode;
  tools:React.ReactNode;
  canvas:React.ReactNode;
  inspector:React.ReactNode;
}

export const EditorWorkspaceShell:React.FC<EditorWorkspaceShellProps>=({topbar,tools,canvas,inspector})=>(
 <div className="h-full min-h-0 overflow-y-auto xl:overflow-hidden bg-[#070c12] text-zinc-100">
  <div className="min-h-full xl:h-full flex flex-col">
   <header className="shrink-0 border-b border-white/[0.06] bg-[#081019]/95 backdrop-blur-xl">{topbar}</header>
   <div className="flex-1 min-h-0 flex flex-col xl:grid xl:grid-cols-[88px_minmax(0,1fr)_330px]">
    <aside className="shrink-0 border-b xl:border-b-0 xl:border-r border-white/[0.06] bg-[#071018] px-3 py-3 xl:overflow-y-auto">{tools}</aside>
    <main className="min-h-[440px] xl:min-h-0 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,rgba(15,74,112,.12),transparent_42%),#050a10]">{canvas}</main>
    <aside className="shrink-0 border-t xl:border-t-0 xl:border-l border-white/[0.06] bg-[#081019] xl:overflow-y-auto">{inspector}</aside>
   </div>
  </div>
 </div>
);

export default EditorWorkspaceShell;
