import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Image as ImageIcon, Music, Plus, Sparkles, Video } from 'lucide-react';
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

const isFrameReference = (ref: WorkspaceReference) => ['START_FRAME','INITIAL_FRAME','INITIAL','END_FRAME','END'].includes(String(ref.role || '').toUpperCase());

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const promptReferences = useMemo(() => references.filter((ref) => !isFrameReference(ref)), [references]);
  const suggestions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    return promptReferences.filter((r) => {
      const name = r.asset?.name?.toLowerCase() || '';
      const alias = r.alias_snapshot.toLowerCase();
      return !q || name.includes(q) || alias.includes(q);
    });
  }, [promptReferences, mentionQuery]);

  useEffect(() => setActiveIndex(0), [mentionQuery, suggestions.length]);

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = before.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
    if (!match) { setMentionOpen(false); setMentionStart(null); return; }
    const query = match[1] || '';
    setMentionQuery(query);
    setMentionStart(caret - query.length - 1);
    setMentionOpen(true);
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
    requestAnimationFrame(() => {
      const pos = start + token.length;
      textarea?.focus();
      textarea?.setSelectionRange(pos, pos);
    });
  };

  const mediaIcon = (type?: string) => type === 'VIDEO' ? <Video className="w-4 h-4"/> : type === 'AUDIO' ? <Music className="w-4 h-4"/> : <ImageIcon className="w-4 h-4"/>;
  const activeRefs = promptReferences.filter((ref) => prompt.toLowerCase().includes(`@${ref.alias_snapshot.toLowerCase()}`));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-zinc-300">Prompt</label>
        <span className="text-[8px] font-mono text-zinc-700">{prompt.length}/{maxChars}</span>
      </div>

      <div className="relative rounded-[14px] border border-white/[0.075] bg-[#0a0d12] focus-within:border-cyan-400/25 transition-colors overflow-visible">
        <textarea
          ref={textareaRef}
          id="workspace-prompt-input"
          value={prompt}
          onChange={(e) => { onChangePrompt(e.target.value); detectMention(e.target.value, e.target.selectionStart); }}
          onClick={(e) => detectMention(prompt, (e.target as HTMLTextAreaElement).selectionStart)}
          onKeyUp={(e) => { if (!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)) detectMention(prompt, (e.target as HTMLTextAreaElement).selectionStart); }}
          onKeyDown={(e) => {
            if (!mentionOpen) return;
            if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); }
            else if (e.key === 'ArrowDown' && suggestions.length) { e.preventDefault(); setActiveIndex((i) => (i + 1) % suggestions.length); }
            else if (e.key === 'ArrowUp' && suggestions.length) { e.preventDefault(); setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length); }
            else if (e.key === 'Enter' && suggestions[activeIndex]) { e.preventDefault(); insertReference(suggestions[activeIndex]); }
          }}
          placeholder="Descreva exatamente o vídeo que você quer gerar... Digite @ para usar uma referência."
          rows={5}
          maxLength={maxChars}
          className="w-full min-h-[120px] p-3 pb-10 bg-transparent border-0 text-[11px] leading-relaxed text-zinc-100 placeholder:text-zinc-700 outline-none resize-none caret-cyan-300"
        />

        <div className="absolute left-2.5 right-2.5 bottom-2 flex items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button type="button" onClick={onRequestAddMedia} className="h-7 px-2 rounded-lg border border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06] text-[8px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3"/> Referência</button>
            <button type="button" onClick={onOpenImproveModal} disabled={!prompt.trim()} className="h-7 px-2 rounded-lg border border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06] disabled:opacity-30 text-[8px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1"><Sparkles className="w-3 h-3 text-cyan-300"/> Melhorar</button>
          </div>
          <span className="text-[8px] text-zinc-700">@ para mencionar</span>
        </div>

        {mentionOpen && (
          <div className="absolute z-[100] left-2 right-2 top-full mt-1.5 overflow-hidden rounded-xl border border-white/[0.09] bg-[#11151c] shadow-2xl shadow-black/60">
            <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between gap-3">
              <div><p className="text-[9px] font-bold text-white">Referências deste job</p><p className="text-[8px] text-zinc-600">Selecione para inserir no prompt.</p></div>
              <button type="button" onClick={() => { setMentionOpen(false); onRequestAddMedia(); }} className="text-[8px] font-semibold text-cyan-300 flex items-center gap-1"><Plus className="w-3 h-3"/> Adicionar</button>
            </div>
            <div className="max-h-60 overflow-y-auto p-1.5">
              {suggestions.map((ref, index) => {
                const asset = ref.asset;
                const imageUrl = asset?.thumbnail_url || asset?.public_url;
                return <button key={ref.asset_id} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => insertReference(ref)} className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${index === activeIndex ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}>
                  <div className="w-10 h-10 rounded-lg bg-[#0b0e13] overflow-hidden shrink-0 flex items-center justify-center text-zinc-500 border border-white/[0.06]">{asset?.type === 'IMAGE' && imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" alt=""/> : mediaIcon(asset?.type)}</div>
                  <div className="min-w-0 flex-1"><p className="text-[9px] font-semibold text-white truncate">{asset?.name || ref.alias_snapshot}</p><div className="flex items-center gap-2 mt-0.5"><span className="text-[8px] font-mono font-bold text-cyan-300">@{ref.alias_snapshot}</span><span className="text-[7px] uppercase text-zinc-700">{asset?.type || 'IMAGE'}</span></div></div>
                </button>;
              })}
              {!suggestions.length && <div className="p-4 text-center"><p className="text-[9px] text-zinc-600">{promptReferences.length ? 'Nenhuma referência corresponde à busca.' : 'Nenhuma mídia anexada ainda.'}</p><button type="button" onClick={() => { setMentionOpen(false); onRequestAddMedia(); }} className="mt-2 text-[9px] font-semibold text-cyan-300">+ Adicionar referência</button></div>}
            </div>
          </div>
        )}
      </div>

      {promptReferences.length > 0 && <div className="flex flex-wrap gap-1.5">{promptReferences.map((ref) => {
        const active = activeRefs.some((item) => item.asset_id === ref.asset_id);
        return <button key={ref.asset_id} type="button" onClick={() => { const token = `@${ref.alias_snapshot} `; onChangePrompt(`${prompt}${prompt && !prompt.endsWith(' ') ? ' ' : ''}${token}`); textareaRef.current?.focus(); }} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[8px] font-semibold transition-all ${active ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-300'}`}>{mediaIcon(ref.asset?.type)} @{ref.alias_snapshot}</button>;
      })}</div>}

      {supportsNegativePrompt && <div>
        <button type="button" onClick={() => setShowNegative((v) => !v)} className="text-[9px] text-zinc-600 hover:text-zinc-300 flex items-center gap-1 py-0.5">{showNegative ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>} Negative prompt</button>
        {showNegative && <textarea value={negativePrompt} onChange={(e) => onChangeNegativePrompt(e.target.value)} placeholder="Elementos que devem ser evitados..." rows={2} className="mt-1.5 w-full p-2.5 bg-[#0a0d12] border border-white/[0.07] focus:border-white/[0.13] rounded-xl text-[10px] text-zinc-200 placeholder:text-zinc-700 outline-none resize-none"/>}
      </div>}
    </div>
  );
};
