import React, { useEffect, useMemo, useState } from 'react';
import { Box, FolderKanban, Image as ImageIcon, Layers3, Plus, Search, UserRound } from 'lucide-react';
import { CreativeEntity, CreativeEntityKind, creativeEntityService } from '../../services/creativeEntityService.js';
import { assetService } from '../../services/assetService.js';
import { Asset } from '../../types/index.js';
import { EntityLibraryView } from './EntityLibraryView.js';
import { SingleImageEntityLibraryView } from './SingleImageEntityLibraryView.js';
import { AssetsView } from './AssetsView.js';

type LibrarySection = 'ASSETS' | 'CHARACTER' | 'PRODUCT' | 'STYLE';
const tabs: Array<{id:LibrarySection; label:string; icon:any}> = [
  { id:'ASSETS', label:'Assets', icon:ImageIcon },
  { id:'CHARACTER', label:'Personagens', icon:UserRound },
  { id:'PRODUCT', label:'Produtos', icon:Box },
  { id:'STYLE', label:'Estilos', icon:Layers3 },
];

const ProjectAssets: React.FC<{project:CreativeEntity; onProjectChange:(p:CreativeEntity)=>void}> = ({project,onProjectChange}) => {
  const [assets,setAssets]=useState<Asset[]>([]); const [query,setQuery]=useState(''); const [saving,setSaving]=useState<string|null>(null);
  useEffect(()=>{assetService.listAssets().then(setAssets).catch(()=>setAssets([]));},[]);
  const visible=useMemo(()=>{const q=query.trim().toLowerCase();return q?assets.filter(a=>`${a.name} ${a.alias}`.toLowerCase().includes(q)):assets;},[assets,query]);
  const selected=new Set(project.asset_ids||[]);
  return <div className="ia-project-assets space-y-4">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3"><div><h2 className="text-lg font-black text-white">Assets do projeto</h2><p className="mt-1 text-[11px] text-zinc-500">O arquivo continua existindo uma única vez na Biblioteca Global; aqui guardamos somente o vínculo.</p></div><span className="text-[10px] text-cyan-300 font-semibold">{selected.size} vinculado(s)</span></div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar assets globais..." className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#11151c] border border-white/[0.07] text-xs text-white outline-none focus:border-cyan-300/25"/></div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">{visible.map(asset=>{const on=selected.has(asset.asset_id);const preview=asset.thumbnail_url||asset.public_url;return <button key={asset.asset_id} disabled={saving===asset.asset_id} onClick={async()=>{setSaving(asset.asset_id);try{onProjectChange(await creativeEntityService.toggleProjectAsset(project.entity_id,asset.asset_id));}finally{setSaving(null);}}} className={`ia-library-asset-card group text-left rounded-2xl overflow-hidden border transition-all ${on?'border-cyan-300/45 bg-cyan-300/[0.06] shadow-[0_0_24px_rgba(34,211,238,.08)]':'border-white/[0.07] bg-[#11151c] hover:border-white/[0.14]'}`}><div className="ia-library-media aspect-square bg-[#0b0e13] relative overflow-hidden">{asset.type==='IMAGE'&&preview?<img src={preview} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full grid place-items-center"><ImageIcon className="w-7 h-7 text-zinc-700"/></div>}<span className={`absolute right-2 top-2 px-2 py-1 rounded-full text-[8px] font-black ${on?'bg-cyan-300 text-[#071015]':'bg-black/65 text-zinc-400'}`}>{on?'NO PROJETO':'ADICIONAR'}</span></div><div className="p-2.5"><p className="text-[10px] font-bold text-white truncate">{asset.name}</p><p className="mt-0.5 text-[8px] font-mono text-zinc-600 truncate">@{asset.alias}</p></div></button>;})}</div>
  </div>;
};

export const LibraryHubView: React.FC = () => {
  const [section,setSection]=useState<LibrarySection>('ASSETS');
  const [projects,setProjects]=useState<CreativeEntity[]>([]);
  const [selectedProjectId,setSelectedProjectId]=useState<string|null>(null);
  const [newProjectName,setNewProjectName]=useState('');
  const [creating,setCreating]=useState(false);
  const refreshProjects=async()=>setProjects(await creativeEntityService.listProjects());
  useEffect(()=>{refreshProjects().catch(()=>setProjects([]));},[]);
  const selectedProject=projects.find(p=>p.entity_id===selectedProjectId)||null;
  const currentLabel=selectedProject?.name||'Biblioteca Global';

  const createProject=async()=>{if(!newProjectName.trim())return;setCreating(true);try{const p=await creativeEntityService.save({kind:'PROJECT',name:newProjectName.trim(),description:'',asset_ids:[]});setProjects(prev=>[p,...prev]);setSelectedProjectId(p.entity_id);setNewProjectName('');}finally{setCreating(false);}};

  return <div className="ia-library-hub ia-creative-library pb-10">
    <div className="flex flex-col xl:flex-row gap-5">
      <aside className="ia-library-nav xl:w-[230px] shrink-0 space-y-3">
        <div><p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-300">Biblioteca</p><h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">Organização criativa</h1><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Assets, personagens, produtos e estilos sem duplicar arquivos.</p></div>
        <div className="ia-library-projects rounded-2xl border border-white/[0.07] bg-[#10141b] p-2 space-y-1"><button onClick={()=>setSelectedProjectId(null)} className={`w-full h-9 px-3 rounded-xl text-left text-[11px] font-bold flex items-center gap-2 ${selectedProjectId===null?'bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/15':'text-zinc-500 hover:bg-white/[0.04] hover:text-white'}`}><Layers3 className="w-3.5 h-3.5"/> Geral</button><div className="px-2 pt-2 pb-1 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-700">Projetos</div>{projects.map(p=><button key={p.entity_id} onClick={()=>setSelectedProjectId(p.entity_id)} className={`w-full h-9 px-3 rounded-xl text-left text-[11px] font-semibold flex items-center gap-2 truncate ${selectedProjectId===p.entity_id?'bg-white/[0.08] text-white':'text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-200'}`}><FolderKanban className="w-3.5 h-3.5 shrink-0"/><span className="truncate">{p.name}</span></button>)}<div className="pt-2 flex gap-1.5"><input value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')createProject();}} placeholder="Novo projeto" className="min-w-0 flex-1 h-8 px-2.5 rounded-lg border border-white/[0.07] bg-[#0b0e13] text-[9px] text-white outline-none"/><button disabled={!newProjectName.trim()||creating} onClick={createProject} className="w-8 h-8 rounded-lg bg-cyan-300 text-[#071015] grid place-items-center disabled:opacity-30"><Plus className="w-3.5 h-3.5"/></button></div></div>
      </aside>

      <section className="flex-1 min-w-0">
        <div className="mb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/[0.06] pb-3"><div><p className="text-[9px] text-zinc-700">Você está em</p><h2 className="text-lg font-black text-white">{currentLabel}</h2></div><div className="ia-library-tabs inline-flex gap-1 p-1 rounded-xl border border-white/[0.07] bg-[#11151c] overflow-x-auto">{tabs.map(({id,label,icon:TabIcon})=><button key={id} onClick={()=>setSection(id)} className={`h-8 px-3 rounded-lg text-[10px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 ${section===id?'bg-white/[0.09] text-white':'text-zinc-600 hover:text-zinc-200'}`}><TabIcon className="w-3.5 h-3.5"/>{label}</button>)}</div></div>
        {section==='ASSETS' && (selectedProject?<ProjectAssets project={selectedProject} onProjectChange={next=>setProjects(prev=>prev.map(p=>p.entity_id===next.entity_id?next:p))}/>:<AssetsView/>)}
        {section==='CHARACTER' && <EntityLibraryView kind="CHARACTER" embedded projectId={selectedProjectId}/>} 
        {section==='PRODUCT' && <SingleImageEntityLibraryView kind="PRODUCT" embedded projectId={selectedProjectId}/>} 
        {section==='STYLE' && <SingleImageEntityLibraryView kind="STYLE" embedded projectId={selectedProjectId}/>} 
      </section>
    </div>
  </div>;
};
