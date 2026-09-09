import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CornerDownLeft,
  Image as ImageIcon,
  Music,
  Package,
  Palette,
  Plus,
  Search,
  Sparkles,
  UserRound,
  Video,
  Wand2,
} from 'lucide-react';
import { WorkspaceReference } from '../../types/index.js';

interface PromptComposerProps {
  prompt: string;
  onChangePrompt: (text: string) => void;
  negativePrompt: string;
  onChangeNegativePrompt: (text: string) => void;
  onOpenImproveModal: () => void;
  references: WorkspaceReference[];
  onRequestAddMedia: () => void;
  supportsNegativePrompt?: boolean;
  maxChars?: number;
}

type MentionPanel = 'ROOT' | 'MEDIA';

const isFrameReference = (ref: WorkspaceReference) => ['START_FRAME','INITIAL_FRAME','INITIAL','END_FRAME','END'].includes(String(ref.role || '').toUpperCase());
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const PromptComposer: React.FC<PromptComposerProps> = ({
  prompt,
  onChangePrompt,
  negativePrompt,
  onChangeNegativePrompt,
  onOpenImproveModal,
  references,
  onRequestAddMedia,
  supportsNegativePrompt = true,
  maxChars = 2000,
}) => {
  const [showNegative, setShowNegative] = useState(Boolean(negativePrompt));
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionPanel, setMentionPanel] = useState<MentionPanel>('ROOT');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const promptReferences = useMemo(() => references.filter((ref) => !isFrameReference(ref)), [references]);
  const suggestions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    return promptReferences.filter((r) => {
      const name = r.asset?.name?.toLowerCase() || '';
      const alias = r.alias_snapshot.toLowerCase();
      return !q || name.includes(q) || alias.includes(q);
    });
  }, [promptReferences, mentionQuery]);

  const highlightedPrompt = useMemo(() => {
    const aliases = promptReferences.map((ref) => ref.alias_snapshot).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!aliases.length || !prompt) return [<React.Fragment key="plain">{prompt}</React.Fragment>];
    const regex = new RegExp(`(@(?:${aliases.map(escapeRegExp).join('|')}))(?=\\b|\\s|$|[.,;:!?])`, 'gi');
    const parts = prompt.split(regex);
    const active = new Set(aliases.map((alias) => `@${alias.toLowerCase()}`));
    return parts.map((part, index) => active.has(part.toLowerCase())
      ? <span key={`${part}-${index}`} className="rounded-[5px] border border-cyan-300/40 bg-cyan-300/15 px-[2px] py-[1px] font-bold text-cyan-200 box-decoration-clone">{part}</span>
      : <React.Fragment key={`text-${index}`}>{part}</React.Fragment>
    );
  }, [prompt, promptReferences]);

  useEffect(() => setActiveIndex(0), [mentionQuery, suggestions.length, mentionPanel]);

  const syncScroll = () => {
    if (!textareaRef.current || !highlightRef.current) return;
    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  };

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = before.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
    if (!match) { setMentionOpen(false); setMentionStart(null); setMentionPanel('ROOT'); return; }
    const query = match[1] || '';
    setMentionQuery(query);
    setMentionStart(caret - query.length - 1);
    setMentionOpen(true);
    if (query) setMentionPanel('MEDIA');
  };

  const insertReference = (ref: WorkspaceReference) => {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? prompt.length;
    const start = mentionStart ?? caret;
    const token = `@${ref.alias_snapshot} `;
    const next = prompt.slice(0, start) + token + prompt.slice(caret);
    onChangePrompt(next);
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStart(null);
    setMentionPanel('ROOT');
    requestAnimationFrame(() => {
      const pos = start + token.length;
      textarea?.focus();
      textarea?.setSelectionRange(pos, pos);
      syncScroll();
    });
  };

  const mediaIcon = (type?: string) => type === 'VIDEO' ? <Video className="w-4 h-4"/> : type === 'AUDIO' ? <Music className="w-4 h-4"/> : <ImageIcon className="w-4 h-4"/>;
  const activeRefs = promptReferences.filter((ref) => prompt.toLowerCase().includes(`@${ref.alias_snapshot.toLowerCase()}`));

  const categoryRows = [
    { label: 'Mídia', icon: ImageIcon, count: promptReferences.length, action: () => setMentionPanel('MEDIA'), enabled: true },
    { label: 'Personagens', icon: UserRound, count: 0, action: onRequestAddMedia, enabled: true },
    { label: 'Elementos', icon: Package, count: 0, action: onRequestAddMedia, enabled: true },
    { label: 'Paletas de cores', icon: Palette, count: 0, action: undefined, enabled: false },
    { label: 'Efeitos', icon: Wand2, count: 0, action: undefined, enabled: false },
  ] as const;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between"><label className="text-[10px] font-bold text-zinc-300">Prompt</label><span className="text-[8px] font-mono text-zinc-700">{prompt.length}/{maxChars}</span></div>

      <div className="relative rounded-[14px] border border-white/[0.075] bg-[#0a0d12] focus-within:border-cyan-400/25 transition-colors overflow-visible">
        <div ref={highlightRef} aria-hidden="true" className="absolute left-0 right-0 top-0 bottom-10 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words overflow-hidden pointer-events-none text-zinc-100">{highlightedPrompt}{prompt.endsWith('\n') ? '\u200b' : null}</div>
        <textarea
          ref={textareaRef}
          id="workspace-prompt-input"
          value={prompt}
          onChange={(e) => { onChangePrompt(e.target.value); detectMention(e.target.value, e.target.selectionStart); }}
          onClick={(e) => detectMention(prompt, (e.target as HTMLTextAreaElement).selectionStart)}
          onScroll={syncScroll}
          onKeyUp={(e) => { if (!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)) detectMention(prompt, (e.target as HTMLTextAreaElement).selectionStart); }}
          onKeyDown={(e) => {
            if (!mentionOpen) return;
            if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); setMentionPanel('ROOT'); }
            else if (mentionPanel === 'MEDIA' && e.key === 'ArrowDown' && suggestions.length) { e.preventDefault(); setActiveIndex((i) => (i + 1) % suggestions.length); }
            else if (mentionPanel === 'MEDIA' && e.key === 'ArrowUp' && suggestions.length) { e.preventDefault(); setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length); }
            else if (mentionPanel === 'MEDIA' && e.key === 'Enter' && suggestions[activeIndex]) { e.preventDefault(); insertReference(suggestions[activeIndex]); }
            else if (mentionPanel === 'ROOT' && e.key === 'Enter') { e.preventDefault(); setMentionPanel('MEDIA'); }
          }}
          placeholder="Descreva exatamente o que você quer gerar... Digite @ para usar uma referência."
          rows={5}
          maxLength={maxChars}
          className="relative z-10 w-full min-h-[120px] p-3 pb-10 bg-transparent border-0 text-[11px] leading-relaxed text-transparent caret-cyan-300 placeholder:text-zinc-700 outline-none resize-none selection:bg-cyan-300/20"
          style={{ WebkitTextFillColor: 'transparent' }}
        />

        <div className="absolute left-2.5 right-2.5 bottom-2 flex items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto"><button type="button" onClick={onRequestAddMedia} className="h-7 px-2 rounded-lg border border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06] text-[8px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3"/> Referência</button><button type="button" onClick={onOpenImproveModal} disabled={!prompt.trim()} className="h-7 px-2 rounded-lg border border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06] disabled:opacity-30 text-[8px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1"><Sparkles className="w-3 h-3 text-cyan-300"/> Melhorar</button></div>
          <span className="text-[8px] text-zinc-700">@ para mencionar</span>
        </div>

        {mentionOpen && <div className="absolute z-[100] left-2 top-full mt-1.5 w-[310px] max-w-[calc(100%-16px)] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#171719] shadow-[0_24px_70px_rgba(0,0,0,.72)]">
          <div className="p-2 border-b border-white/[0.055]">
            <div className="h-9 px-2.5 rounded-xl bg-[#111214] border border-white/[0.06] flex items-center gap-2">
              {mentionPanel === 'MEDIA' ? <button type="button" onClick={() => setMentionPanel('ROOT')} className="text-zinc-500 hover:text-white"><ArrowLeft className="w-3.5 h-3.5"/></button> : <Search className="w-3.5 h-3.5 text-zinc-600"/>}
              <span className={`text-[10px] flex-1 truncate ${mentionQuery ? 'text-zinc-300' : 'text-zinc-600'}`}>{mentionPanel === 'MEDIA' ? (mentionQuery ? `Buscar: ${mentionQuery}` : 'Mídia deste job') : (mentionQuery ? mentionQuery : 'Pesquisar')}</span>
            </div>
          </div>

          {mentionPanel === 'ROOT' ? <div className="p-1.5">
            {categoryRows.map(({label,icon:Icon,count,action,enabled}) => <button key={label} type="button" onClick={() => enabled && action?.()} className={`w-full h-10 px-2.5 rounded-xl flex items-center gap-2.5 text-left transition-colors ${enabled ? 'hover:bg-white/[0.07]' : 'opacity-45 cursor-default'}`}>
              <div className="w-6 h-6 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] grid place-items-center text-cyan-200"><Icon className="w-3.5 h-3.5"/></div>
              <span className="text-[10px] font-semibold text-zinc-200 flex-1">{label}</span>
              {count > 0 && <span className="text-[8px] text-zinc-600 mr-1">{count}</span>}
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600"/>
            </button>)}
          </div> : <div className="max-h-60 overflow-y-auto p-1.5">
            {suggestions.map((ref, index) => { const asset = ref.asset; const imageUrl = asset?.thumbnail_url || asset?.public_url; return <button key={ref.asset_id} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => insertReference(ref)} className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition-colors ${index === activeIndex ? 'bg-white/[0.08]' : 'hover:bg-white/[0.045]'}`}><div className="w-10 h-10 rounded-lg bg-[#0b0e13] overflow-hidden shrink-0 flex items-center justify-center text-zinc-500 border border-white/[0.06]">{asset?.type === 'IMAGE' && imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" alt=""/> : mediaIcon(asset?.type)}</div><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold text-white truncate">{asset?.name || ref.alias_snapshot}</p><div className="flex items-center gap-2 mt-0.5"><span className="text-[8px] font-mono font-bold text-cyan-300">@{ref.alias_snapshot}</span><span className="text-[7px] uppercase text-zinc-700">{asset?.type || 'IMAGE'}</span></div></div></button>; })}
            {!suggestions.length && <div className="p-4 text-center"><p className="text-[9px] text-zinc-600">{promptReferences.length ? 'Nenhuma mídia corresponde à busca.' : 'Nenhuma mídia anexada ainda.'}</p><button type="button" onClick={() => { setMentionOpen(false); setMentionPanel('ROOT'); onRequestAddMedia(); }} className="mt-2 text-[9px] font-semibold text-cyan-300">+ Adicionar mídia</button></div>}
          </div>}

          <div className="h-8 px-2.5 border-t border-white/[0.055] flex items-center justify-end gap-3 text-[7px] text-zinc-600">
            <span className="inline-flex items-center gap-1"><ArrowUpDown className="w-3 h-3"/> Navegar</span>
            <span className="inline-flex items-center gap-1"><CornerDownLeft className="w-3 h-3"/> Inserir</span>
          </div>
        </div>}
      </div>

      {promptReferences.length > 0 && <div className="flex flex-wrap gap-1.5">{promptReferences.map((ref) => { const active = activeRefs.some((item) => item.asset_id === ref.asset_id); return <button key={ref.asset_id} type="button" onClick={() => { const token = `@${ref.alias_snapshot} `; if (!prompt.toLowerCase().includes(token.trim().toLowerCase())) onChangePrompt(`${prompt}${prompt && !prompt.endsWith(' ') ? ' ' : ''}${token}`); textareaRef.current?.focus(); }} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[8px] font-semibold transition-all ${active ? 'border-cyan-300/45 bg-cyan-300/12 text-cyan-200 shadow-[0_0_16px_rgba(103,232,249,.08)]' : 'border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-300'}`}>{mediaIcon(ref.asset?.type)} @{ref.alias_snapshot}{active && <span className="text-[6px] uppercase tracking-wide text-cyan-300/75">em uso</span>}</button>; })}</div>}

      {supportsNegativePrompt && <div><button type="button" onClick={() => setShowNegative((v) => !v)} className="text-[9px] text-zinc-600 hover:text-zinc-300 flex items-center gap-1 py-0.5">{showNegative ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>} Negative prompt</button>{showNegative && <textarea value={negativePrompt} onChange={(e) => onChangeNegativePrompt(e.target.value)} placeholder="Elementos que devem ser evitados..." rows={2} className="mt-1.5 w-full p-2.5 bg-[#0a0d12] border border-white/[0.07] focus:border-white/[0.13] rounded-xl text-[10px] text-zinc-200 placeholder:text-zinc-700 outline-none resize-none"/>}</div>}
    </div>
  );
};
