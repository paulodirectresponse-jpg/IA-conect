import React, { useEffect, useMemo, useState } from 'react';
import { Box, FolderKanban, Layers3, Plus, Search, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import { assetService } from '../../services/assetService.js';
import { creativeEntityService, CreativeEntity, CreativeEntityKind } from '../../services/creativeEntityService.js';
import { Asset } from '../../types/index.js';

const meta: Record<CreativeEntityKind, { title: string; singular: string; description: string; icon: any }> = {
  CHARACTER: { title: 'Personagens', singular: 'Personagem', description: 'Identidades visuais reutilizáveis para manter consistência entre gerações.', icon: UserRound },
  PRODUCT: { title: 'Produtos', singular: 'Produto', description: 'Referências principais de produto para campanhas, CGI e vídeos comerciais.', icon: Box },
  STYLE: { title: 'Estilos', singular: 'Estilo', description: 'Direções visuais que você pode reaproveitar em diferentes trabalhos.', icon: Layers3 },
  PROJECT: { title: 'Projetos', singular: 'Projeto', description: 'Agrupe referências e organize trabalhos em andamento.', icon: FolderKanban },
};

export const EntityLibraryView: React.FC<{ kind: CreativeEntityKind; embedded?: boolean }> = ({ kind, embedded = false }) => {
  const info = meta[kind];
  const Icon = info.icon;
  const [items, setItems] = useState<CreativeEntity[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [queryText, setQueryText] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverId, setCoverId] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => setItems(await creativeEntityService.list(kind));
  useEffect(() => { refresh().catch(() => setItems([])); assetService.listAssets().then(setAssets).catch(() => setAssets([])); }, [kind]);

  const visible = useMemo(() => { const q=queryText.trim().toLowerCase(); return q?items.filter((item)=>`${item.name} ${item.description}`.toLowerCase().includes(q)):items; }, [items,queryText]);
  const selectedCover = assets.find((asset) => asset.asset_id === coverId) || null;

  const save = async () => {
    if (!name.trim()) return; setSaving(true);
    try {
      await creativeEntityService.save({ kind, name, description, cover_asset_id:selectedCover?.asset_id||null, cover_url:selectedCover?.thumbnail_url||selectedCover?.public_url||null, asset_ids:selectedCover?[selectedCover.asset_id]:[] });
      setOpen(false); setName(''); setDescription(''); setCoverId(''); await refresh();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 pb-8">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          {!embedded && <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400"><Icon className="w-4 h-4" /> Biblioteca criativa</div>}
          <h2 className={`${embedded?'text-lg':'mt-2 text-2xl'} font-black tracking-[-0.03em] text-white`}>{info.title}</h2>
          <p className="mt-1 text-[11px] text-zinc-500 max-w-2xl">{info.description}</p>
        </div>
        <button onClick={() => setOpen(true)} className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-[10px] font-bold text-white flex items-center gap-2 shadow-[0_10px_30px_rgba(124,58,237,.16)] hover:brightness-110"><Plus className="w-3.5 h-3.5" /> Novo {info.singular.toLowerCase()}</button>
      </section>

      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"/><input value={queryText} onChange={(e)=>setQueryText(e.target.value)} placeholder={`Buscar ${info.title.toLowerCase()}...`} className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#11151c] border border-white/[0.07] text-xs text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-violet-400/25"/></div>

      {visible.length ? <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">{visible.map((item)=><article key={item.entity_id} className="group rounded-2xl overflow-hidden border border-white/[0.07] bg-[#11151c] hover:border-violet-400/20 transition-colors shadow-[0_18px_45px_rgba(0,0,0,.15)]"><div className="aspect-[4/3] bg-[#0b0e13] relative overflow-hidden">{item.cover_url?<img src={item.cover_url} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" alt=""/>:<div className="w-full h-full grid place-items-center"><Icon className="w-8 h-8 text-zinc-800"/></div>}<span className="absolute left-3 top-3 px-2 py-1 rounded-full border border-white/10 bg-black/55 backdrop-blur text-[8px] font-bold uppercase tracking-wider text-zinc-300">{info.singular}</span></div><div className="p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-bold text-white truncate">{item.name}</h3><p className="mt-1 text-[10px] leading-relaxed text-zinc-600 line-clamp-2">{item.description||'Sem descrição.'}</p></div><button onClick={async()=>{await creativeEntityService.remove(item.entity_id);await refresh();}} className="p-1.5 rounded-lg text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5"/></button></div><div className="mt-3 flex items-center gap-1.5 text-[9px] text-zinc-700"><Sparkles className="w-3 h-3 text-violet-400"/> {item.asset_ids.length} referência(s)</div></div></article>)}</div>:<div className="min-h-[320px] rounded-2xl border border-dashed border-white/[0.07] bg-[#11151c]/50 grid place-items-center"><div className="text-center"><div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.035] border border-white/[0.06] grid place-items-center"><Icon className="w-5 h-5 text-zinc-700"/></div><p className="mt-3 text-sm font-semibold text-zinc-300">Nenhum {info.singular.toLowerCase()} ainda</p><p className="mt-1 text-[10px] text-zinc-600">Crie o primeiro e reaproveite referências em novos trabalhos.</p></div></div>}

      {open && <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm grid place-items-center p-4"><div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#11151c] shadow-2xl"><div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between"><div><h2 className="text-sm font-bold text-white">Novo {info.singular.toLowerCase()}</h2><p className="text-[9px] text-zinc-600">Comece simples; você pode evoluir essa entidade depois.</p></div><button onClick={()=>setOpen(false)} className="p-1.5 rounded-lg text-zinc-600 hover:text-white"><X className="w-4 h-4"/></button></div><div className="p-4 space-y-3"><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nome" className="w-full h-10 px-3 rounded-xl bg-[#0b0e13] border border-white/[0.07] text-xs text-white outline-none focus:border-violet-400/30"/><textarea value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Descrição, aparência, regras ou contexto..." className="w-full min-h-24 p-3 rounded-xl bg-[#0b0e13] border border-white/[0.07] text-xs text-white outline-none resize-none focus:border-violet-400/30"/><div><p className="mb-2 text-[10px] font-semibold text-zinc-400">Imagem principal</p><div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">{assets.filter((a)=>a.type==='IMAGE').slice(0,30).map((asset)=><button key={asset.asset_id} onClick={()=>setCoverId(asset.asset_id)} className={`aspect-square rounded-xl overflow-hidden border-2 ${coverId===asset.asset_id?'border-violet-400 ring-2 ring-violet-400/10':'border-white/[0.06]'}`}><img src={asset.thumbnail_url||asset.public_url} alt="" className="w-full h-full object-cover"/></button>)}</div></div></div><div className="px-4 py-3 border-t border-white/[0.06] flex justify-end gap-2"><button onClick={()=>setOpen(false)} className="h-9 px-3 rounded-xl text-[10px] font-semibold text-zinc-500 hover:text-white">Cancelar</button><button disabled={!name.trim()||saving} onClick={save} className="h-9 px-4 rounded-xl bg-white text-black text-[10px] font-bold disabled:opacity-40">{saving?'Salvando...':'Criar'}</button></div></div></div>}
    </div>
  );
};
