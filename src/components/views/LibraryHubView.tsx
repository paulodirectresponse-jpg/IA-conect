import React, { useState } from 'react';
import { Box, FolderKanban, Layers3, UserRound } from 'lucide-react';
import { CreativeEntityKind } from '../../services/creativeEntityService.js';
import { EntityLibraryView } from './EntityLibraryView.js';

const tabs: Array<{kind:CreativeEntityKind; label:string; icon:any}> = [
  { kind:'CHARACTER', label:'Personagens', icon:UserRound },
  { kind:'PRODUCT', label:'Produtos', icon:Box },
  { kind:'STYLE', label:'Estilos', icon:Layers3 },
  { kind:'PROJECT', label:'Projetos', icon:FolderKanban },
];

export const LibraryHubView: React.FC = () => {
  const [kind, setKind] = useState<CreativeEntityKind>('CHARACTER');
  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-violet-400">Biblioteca</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] text-white">Sua base criativa</h1>
          <p className="mt-1 text-xs text-zinc-500">Personagens, produtos, estilos e projetos em um só lugar.</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.07] bg-[#11151c] p-1 overflow-x-auto">
          {tabs.map(({kind:itemKind,label,icon:Icon}) => <button key={itemKind} onClick={()=>setKind(itemKind)} className={`h-8 px-3 rounded-lg inline-flex items-center gap-1.5 text-[10px] font-semibold whitespace-nowrap transition-all ${kind===itemKind?'bg-white/[0.09] text-white ring-1 ring-white/[0.07]':'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.035]'}`}><Icon className="w-3.5 h-3.5"/>{label}</button>)}
        </div>
      </div>
      <div className="-mt-2"><EntityLibraryView kind={kind} embedded /></div>
    </div>
  );
};
