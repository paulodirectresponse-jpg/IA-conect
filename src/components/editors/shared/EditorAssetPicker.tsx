import React,{useMemo,useState}from'react';
import{Image as ImageIcon,Search,Upload,Video as VideoIcon,X}from'lucide-react';
import{Asset,AssetType}from'../../../types/index.js';

interface EditorAssetPickerProps{
 open:boolean;
 assets:Asset[];
 selectedId?:string;
 uploading?:boolean;
 loading?:boolean;
 assetType?:Extract<AssetType,'IMAGE'|'VIDEO'>;
 title?:string;
 subtitle?:string;
 onClose:()=>void;
 onSelect:(asset:Asset)=>void;
 onUpload:(event:React.ChangeEvent<HTMLInputElement>)=>void;
}

export const EditorAssetPicker:React.FC<EditorAssetPickerProps>=({open,assets,selectedId,uploading,loading,assetType='IMAGE',title,subtitle,onClose,onSelect,onUpload})=>{
 const[query,setQuery]=useState('');
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?assets.filter(asset=>String(asset.name||'').toLowerCase().includes(q)||String(asset.alias||'').toLowerCase().includes(q)):assets;},[assets,query]);
 if(!open)return null;
 const isVideo=assetType==='VIDEO';
 const heading=title||`Abrir ${isVideo?'vídeo':'imagem'}`;
 const supporting=subtitle||`Escolha um asset da Biblioteca Global ou envie um novo ${isVideo?'vídeo':'arquivo de imagem'}.`;
 return <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-5 backdrop-blur-sm" onMouseDown={event=>{if(event.currentTarget===event.target)onClose();}}>
  <section className="w-full sm:max-w-5xl max-h-[88vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/[0.08] bg-[#09121c] shadow-2xl">
   <header className="flex items-center gap-3 border-b border-white/[0.07] p-4">
    <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-white">{heading}</h2><p className="mt-0.5 text-[10px] text-zinc-500">{supporting}</p></div>
    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] px-3 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400/[0.12]"><Upload className="h-3.5 w-3.5"/>{uploading?'Enviando…':'Upload'}<input className="hidden" type="file" accept={isVideo?'video/*':'image/*'} onChange={onUpload}/></label>
    <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] text-zinc-500 hover:text-white"><X className="h-4 w-4"/></button>
   </header>
   <div className="p-4">
    <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3"><Search className="h-3.5 w-3.5 text-zinc-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar na Biblioteca…" className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600"/></label>
   </div>
   <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
    {loading?<div className="grid min-h-[240px] place-items-center rounded-2xl border border-white/[0.05] bg-white/[0.015]"><div className="text-center"><span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-cyan-300/70 border-t-transparent"/><p className="mt-2 text-[10px] text-zinc-500">Carregando a mesma Biblioteca do IA Connect…</p></div></div>:filtered.length?<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{filtered.map(asset=>{const preview=asset.thumbnail_url||asset.public_url;return <button key={asset.asset_id} onClick={()=>onSelect(asset)} className={`group overflow-hidden rounded-xl border text-left transition ${selectedId===asset.asset_id?'border-cyan-400/50 bg-cyan-400/[0.06]':'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'}`}>
      <div className="aspect-video bg-black/30">{preview?(isVideo?<video src={asset.public_url||preview} muted preload="metadata" playsInline className="h-full w-full object-cover"/>:<img src={preview} alt={asset.name||'Imagem'} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover"/>):<div className="grid h-full place-items-center">{isVideo?<VideoIcon className="h-6 w-6 text-zinc-700"/>:<ImageIcon className="h-6 w-6 text-zinc-700"/>}</div>}</div>
      <div className="px-2.5 py-2"><div className="truncate text-[9px] font-medium text-zinc-300 group-hover:text-white">{asset.name||`${isVideo?'Vídeo':'Imagem'} sem nome`}</div><div className="mt-0.5 truncate text-[8px] text-zinc-600">@{asset.alias||'asset'}</div></div>
     </button>})}</div>:<div className="grid min-h-[240px] place-items-center rounded-2xl border border-dashed border-white/[0.07] text-center"><div>{isVideo?<VideoIcon className="mx-auto h-8 w-8 text-zinc-700"/>:<ImageIcon className="mx-auto h-8 w-8 text-zinc-700"/>}<p className="mt-2 text-[10px] text-zinc-500">Nenhum {isVideo?'vídeo':'imagem'} encontrado na Biblioteca Global.</p></div></div>}
   </div>
  </section>
 </div>;
};

export default EditorAssetPicker;
