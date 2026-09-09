import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Image as ImageIcon, Music, Package, Palette, Plus, Search, Sparkles, UserRound, Video } from 'lucide-react';
import { WorkspaceReference } from '../../types/index.js';

type LibrarySection = 'ASSETS' | 'CHARACTERS' | 'PRODUCTS' | 'STYLES';
interface PromptComposerProps {
  prompt: string;
  onChangePrompt: (text: string) => void;
  negativePrompt: string;
  onChangeNegativePrompt: (text: string) => void;
  onOpenImproveModal: () => void;
  references: WorkspaceReference[];
  onRequestAddMedia: (section?: LibrarySection) => void;
  supportsNegativePrompt?: boolean;
  maxChars?: number;
}

const isFrameReference = (ref: WorkspaceReference) => ['START_FRAME','INITIAL_FRAME','INITIAL','END_FRAME','END'].includes(String(ref.role || '').toUpperCase());
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const PromptComposer: React.FC<PromptComposerProps> = ({
  prompt,onChangePrompt,negativePrompt,onChangeNegativePrompt,onOpenImproveModal,references,onRequestAddMedia,supportsNegativePrompt=true,maxChars=2000,
}) => {
  const [showNegative,setShowNegative]=useState(Boolean(negativePrompt));
  const [mentionOpen,setMentionOpen]=useState(false);
  const [mentionQuery,setMentionQuery]=useState('');
  const [mentionStart,setMentionStart]=useState<number|null>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  const highlightRef=useRef<HTMLDivElement>(null);
  const promptReferences=useMemo(()=>references.filter(ref=>!isFrameReference(ref)),[references]);
  const visibleReferences=useMemo(()=>{const q=mentionQuery.trim().toLowerCase();return promptReferences.filter(ref=>!q||ref.alias_snapshot.toLowerCase().includes(q)||(ref.asset?.name||'').toLowerCase().includes(q));},[promptReferences,mentionQuery]);
  const highlightedPrompt=useMemo(()=>{
    const aliases=promptReferences.map(ref=>ref.alias_snapshot).filter(Boolean).sort((a,b)=>b.length-a.length);
    if(!aliases.length||!prompt)return [<React.Fragment key="plain">{prompt}</React.Fragment>];
    const regex=new RegExp(`(@(?:${aliases.map(escapeRegExp).join('|')}))(?=\\b|\\s|$|[.,;:!?])`,'gi');
    const active=new Set(aliases.map(alias=>`@${alias.toLowerCase()}`));
    return prompt.split(regex).map((part,index)=>active.has(part.toLowerCase())?<span key={`${part}-${index}`} className="rounded-[5px] border border-cyan-300/40 bg-cyan-300/15 px-[2px] py-[1px] font-bold text-cyan-200 box-decoration-clone">{part}</span>:<React.Fragment key={`text-${index}`}>{part}</React.Fragment>);
  },[prompt,promptReferences]);
  const syncScroll=()=>{if(!textareaRef.current||!highlightRef.current)return;highlightRef.current.scrollTop=textareaRef.current.scrollTop;highlightRef.current.scrollLeft=textareaRef.current.scrollLeft;};
  const detectMention=(value:string,caret:number)=>{const before=value.slice(0,caret);const match=before.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);if(!match){setMentionOpen(false);setMentionStart(null);return;}const q=match[1]||'';setMentionQuery(q);setMentionStart(caret-q.length-1);setMentionOpen(true);};
  const insertReference=(ref:WorkspaceReference)=>{const textarea=textareaRef.current;const caret=textarea?.selectionStart??prompt.length;const start=mentionStart??caret;const token=`@${ref.alias_snapshot} `;onChangePrompt(prompt.slice(0,start)+token+prompt.slice(caret));setMentionOpen(false);setMentionQuery('');setMentionStart(null);requestAnimationFrame(()=>{const pos=start+token.length;textarea?.focus();textarea?.setSelectionRange(pos,pos);syncScroll();});};
  const mediaIcon=(type?:string)=>type==='VIDEO'?<Video className="w-4 h-4"/>:type==='AUDIO'?<Music className="w-4 h-4"/>:<ImageIcon className="w-4 h-4"/>;
  const activeRefs=promptReferences.filter(ref=>prompt.toLowerCase().includes(`@${ref.alias_snapshot.toLowerCase()}`));
  const openLibrary=(section:LibrarySection)=>{setMentionOpen(false);onRequestAddMedia(section);};

  return <div className="space-y-2">
    <div className="flex items-center justify-between"><label className="text-[10px] font-bold text-zinc-300">Prompt</label><span className="text-[8px] font-mono text-zinc-700">{prompt.length}/{maxChars}</span></div>
    <div className="relative rounded-[14px] border border-white/[0.075] bg-[#0a0d12] focus-within:border-cyan-400/25 transition-colors overflow-visible">
      <div ref={highlightRef} aria-hidden="true" className="absolute left-0 right-0 top-0 bottom-10 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words overflow-hidden pointer-events-none text-zinc-100">{highlightedPrompt}{prompt.endsWith('\n')?'\u200b':null}</div>
      <textarea ref={textareaRef} id="workspace-prompt-input" value={prompt} onChange={e=>{onChangePrompt(e.target.value);detectMention(e.target.value,e.target.selectionStart);}} onClick={e=>detectMention(prompt,(e.target as HTMLTextAreaElement).selectionStart)} onScroll={syncScroll} onKeyUp={e=>{if(!['Enter','Escape'].includes(e.key))detectMention(prompt,(e.target as HTMLTextAreaElement).selectionStart);}} onKeyDown={e=>{if(!mentionOpen)return;if(e.key==='Escape'){e.preventDefault();setMentionOpen(false);}else if(e.key==='Enter'&&visibleReferences[0]){e.preventDefault();insertReference(visibleReferences[0]);}}} placeholder="Descreva exatamente o que você quer gerar... Digite @ para usar uma referência." rows={5} maxLength={maxChars} className="relative z-10 w-full min-h-[120px] p-3 pb-10 bg-transparent border-0 text-[11px] leading-relaxed text-transparent caret-cyan-300 placeholder:text-zinc-700 outline-none resize-none selection:bg-cyan-300/20" style={{WebkitTextFillColor:'transparent'}}/>
      <div className="absolute left-2.5 right-2.5 bottom-2 flex items-center justify-between gap-2 pointer-events-none"><div className="flex items-center gap-1.5 pointer-events-auto"><button type="button" onClick={()=>onRequestAddMedia('ASSETS')} className="h-7 px-2 rounded-lg border border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06] text-[8px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3"/> Referência</button><button type="button" onClick={onOpenImproveModal} disabled={!prompt.trim()} className="h-7 px-2 rounded-lg border border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06] disabled:opacity-30 text-[8px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1"><Sparkles className="w-3 h-3 text-cyan-300"/> Melhorar</button></div><span className="text-[8px] text-zinc-700">@ para mencionar</span></div>

      {mentionOpen&&<div className="absolute z-[100] left-2 top-full mt-1.5 w-[330px] max-w-[calc(100%-16px)] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#171719] shadow-[0_24px_70px_rgba(0,0,0,.72)]">
        <div className="p-2 border-b border-white/[0.055]"><div className="h-9 px-2.5 rounded-xl bg-[#111214] border border-white/[0.06] flex items-center gap-2"><Search className="w-3.5 h-3.5 text-zinc-600"/><span className="text-[10px] flex-1 truncate text-zinc-500">{mentionQuery?`Buscar: ${mentionQuery}`:'Referências desta geração'}</span></div></div>
        <div className="max-h-48 overflow-y-auto p-1.5">{visibleReferences.map(ref=>{const asset=ref.asset;const imageUrl=asset?.thumbnail_url||asset?.public_url;return <button key={ref.asset_id} type="button" onClick={()=>insertReference(ref)} className="w-full flex items-center gap-2 p-2 rounded-xl text-left hover:bg-white/[0.07]"><div className="w-10 h-10 rounded-lg bg-[#0b0e13] overflow-hidden shrink-0 flex items-center justify-center text-zinc-500 border border-white/[0.06]">{asset?.type==='IMAGE'&&imageUrl?<img src={imageUrl} className="w-full h-full object-cover" alt=""/>:mediaIcon(asset?.type)}</div><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold text-white truncate">{asset?.name||ref.alias_snapshot}</p><span className="text-[8px] font-mono font-bold text-cyan-300">@{ref.alias_snapshot}</span></div></button>;})}{!visibleReferences.length&&<div className="px-3 py-4 text-center"><p className="text-[9px] text-zinc-600">Nenhuma referência anexada.</p></div>}</div>
        <div className="border-t border-white/[0.055] p-1.5"><p className="px-2 pt-1 pb-1.5 text-[7px] font-bold uppercase tracking-[0.16em] text-zinc-700">Abrir biblioteca completa</p>{[
          {label:'Mídia',icon:ImageIcon,section:'ASSETS' as LibrarySection},{label:'Personagens',icon:UserRound,section:'CHARACTERS' as LibrarySection},{label:'Produtos',icon:Package,section:'PRODUCTS' as LibrarySection},{label:'Estilos',icon:Palette,section:'STYLES' as LibrarySection},
        ].map(({label,icon:Icon,section})=><button key={section} type="button" onClick={()=>openLibrary(section)} className="w-full h-9 px-2.5 rounded-xl flex items-center gap-2.5 text-left hover:bg-white/[0.07]"><div className="w-6 h-6 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] grid place-items-center text-cyan-200"><Icon className="w-3.5 h-3.5"/></div><span className="text-[9px] font-semibold text-zinc-200">{label}</span></button>)}</div>
      </div>}
    </div>
    {promptReferences.length>0&&<div className="flex flex-wrap gap-1.5">{promptReferences.map(ref=>{const active=activeRefs.some(item=>item.asset_id===ref.asset_id);return <button key={ref.asset_id} type="button" onClick={()=>{const token=`@${ref.alias_snapshot} `;if(!prompt.toLowerCase().includes(token.trim().toLowerCase()))onChangePrompt(`${prompt}${prompt&&!prompt.endsWith(' ')?' ':''}${token}`);textareaRef.current?.focus();}} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[8px] font-semibold transition-all ${active?'border-cyan-300/45 bg-cyan-300/12 text-cyan-200':'border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-300'}`}>{mediaIcon(ref.asset?.type)} @{ref.alias_snapshot}{active&&<span className="text-[6px] uppercase tracking-wide text-cyan-300/75">em uso</span>}</button>;})}</div>}
    {supportsNegativePrompt&&<div><button type="button" onClick={()=>setShowNegative(v=>!v)} className="text-[9px] text-zinc-600 hover:text-zinc-300 flex items-center gap-1 py-0.5">{showNegative?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>} Negative prompt</button>{showNegative&&<textarea value={negativePrompt} onChange={e=>onChangeNegativePrompt(e.target.value)} placeholder="Elementos que devem ser evitados..." rows={2} className="mt-1.5 w-full rounded-xl border border-white/[0.07] bg-[#0a0d12] p-2.5 text-[10px] text-zinc-300 outline-none resize-none"/>}</div>}
  </div>;
};
