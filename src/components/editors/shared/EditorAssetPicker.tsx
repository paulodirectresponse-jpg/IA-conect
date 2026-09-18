import React,{useMemo,useState}from'react';
import{Image as ImageIcon,Search,Upload,X}from'lucide-react';
import{Asset}from'../../../types/index.js';

interface EditorAssetPickerProps{
 open:boolean;
 assets:Asset[];
 selectedId?:string;
 busy?:boolean;
 onClose:()=>void;
 onSelect:(asset:Asset)=>void;
 onUpload:(event:React.ChangeEvent<HTMLInputElement>)=>void;
}

export const EditorAssetPicker:React.FC<EditorAssetPickerProps>=({open,assets,selectedId,busy,onClose,onSelect,onUpload})=>{
 const[query,setQuery]=useState('');
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?assets.filter(asset=>String(asset.name||'').toLowerCase().includes(q)):assets;},[assets,query]);
 if(!open)return null;
 return <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-5 backdrop-blur-sm" onMouseDown={event=>{if(event.currentTarget===event.target)onClose();}}>
  <section className="w-full sm:max-w-4xl max-h-[86vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/[0.08] bg-[#09121c] shadow-2xl">
   <header className="flex items-center gap-3 border-b border-white/[0.07] p-4">
    <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-white">Abrir imagem</h2><p className="mt-0.5 text-[10px] text-zinc-500">Escolha um asset da Biblioteca ou envie uma nova imagem.</p></div>
    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] px-3 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400/[0.12]"><Upload className="h-3.5 w-3.5"/>{busy?'Enviando…':'Upload'}<input className="hidden" type="file" accept="image/*" onChange={onUpload}/></label>
    <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] text-zinc-500 hover:text-white"><X className="h-4 w-4"/></button>
   </header>
   <div className="p-4">
    <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3"><Search className="h-3.5 w-3.5 text-zinc-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar na Biblioteca…" className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600"/></label>
   </div>
   <div className="max-h-[58vh] overflow-y-auto px-4 pb-4">
    {filtered.length?<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{filtered.map(asset=><button key={asset.asset_id} onClick={()=>onSelect(asset)} className={`group overflow-hidden rounded-xl border text-left transition ${selectedId===asset.asset_id?'border-cyan-400/50 bg-cyan-400/[0.06]':'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'}`}>
      <div className="aspect-square bg-black/30">{asset.public_url?<img src={asset.public_url} alt={asset.name||'Imagem'} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center"><ImageIcon className="h-6 w-6 text-zinc-700"/></div>}</div>
      <div className="truncate px-2.5 py-2 text-[9px] text-zinc-400 group-hover:text-zinc-200">{asset.name||'Imagem sem nome'}</div>
     </button>)}</div>:<div className="grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-white/[0.07] text-center"><div><ImageIcon className="mx-auto h-8 w-8 text-zinc-700"/><p className="mt-2 text-[10px] text-zinc-500">Nenhuma imagem encontrada.</p></div></div>}
   </div>
  </section>
 </div>;
};

export default EditorAssetPicker;
