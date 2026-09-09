import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Video,
  Music,
  Plus,
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

const isFrameReference = (ref: WorkspaceReference) =>
  ['START_FRAME', 'INITIAL_FRAME', 'INITIAL', 'END_FRAME', 'END'].includes(
    String(ref.role || '').toUpperCase()
  );

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

  const promptReferences = useMemo(
    () => references.filter((ref) => !isFrameReference(ref)),
    [references]
  );

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
    if (!match) {
      setMentionOpen(false);
      setMentionStart(null);
      return;
    }
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
    setTimeout(() => {
      const pos = start + token.length;
      textarea?.focus();
      textarea?.setSelectionRange(pos, pos);
    }, 0);
  };

  const mediaIcon = (type?: string) => {
    if (type === 'VIDEO') return <Video className="w-4 h-4" />;
    if (type === 'AUDIO') return <Music className="w-4 h-4" />;
    return <ImageIcon className="w-4 h-4" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-700">Prompt</label>
        <button
          type="button"
          onClick={onOpenImproveModal}
          disabled={!prompt.trim()}
          className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-40 flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          Melhorar prompt
        </button>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          id="workspace-prompt-input"
          value={prompt}
          onChange={(e) => {
            onChangePrompt(e.target.value);
            detectMention(e.target.value, e.target.selectionStart);
          }}
          onClick={(e) => detectMention(prompt, (e.target as HTMLTextAreaElement).selectionStart)}
          onKeyDown={(e) => {
            if (!mentionOpen) return;
            if (e.key === 'Escape') {
              e.preventDefault();
              setMentionOpen(false);
            } else if (e.key === 'ArrowDown' && suggestions.length) {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp' && suggestions.length) {
              e.preventDefault();
              setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter' && suggestions[activeIndex]) {
              e.preventDefault();
              insertReference(suggestions[activeIndex]);
            }
          }}
          placeholder="Descreva o vídeo. Digite @ para usar uma mídia anexada..."
          rows={5}
          maxLength={maxChars}
          className="w-full p-3 bg-white border border-zinc-200 hover:border-zinc-300 focus:border-emerald-600 rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-none leading-relaxed shadow-2xs transition-colors"
        />

        {mentionOpen && (
          <div className="absolute z-[90] left-2 right-2 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold text-zinc-700">Mídias deste vídeo</p>
                <p className="text-[9px] text-zinc-400">Somente assets anexados ao vídeo aparecem no @.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMentionOpen(false);
                  onRequestAddMedia();
                }}
                className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1 shrink-0 hover:text-emerald-800"
              >
                <Plus className="w-3 h-3" /> Adicionar mídia
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto p-1.5">
              {suggestions.map((ref, index) => {
                const asset = ref.asset;
                const imageUrl = asset?.thumbnail_url || asset?.public_url;
                return (
                  <button
                    key={ref.asset_id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => insertReference(ref)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                      index === activeIndex ? 'bg-emerald-50' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg bg-zinc-100 overflow-hidden shrink-0 flex items-center justify-center text-zinc-400 border border-zinc-100">
                      {asset?.type === 'IMAGE' && imageUrl ? (
                        <img src={imageUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        mediaIcon(asset?.type)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-900 truncate">{asset?.name || ref.alias_snapshot}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono font-semibold text-emerald-700">@{ref.alias_snapshot}</span>
                        <span className="text-[9px] uppercase text-zinc-400">{asset?.type || 'IMAGE'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!suggestions.length && (
                <div className="p-5 text-center">
                  <p className="text-[11px] text-zinc-500">
                    {promptReferences.length
                      ? 'Nenhuma mídia corresponde a esta busca.'
                      : 'Nenhum asset foi anexado a este vídeo ainda.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMentionOpen(false);
                      onRequestAddMedia();
                    }}
                    className="mt-2 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    + Adicionar mídia
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between mt-1 px-0.5 text-[10px] text-zinc-400">
          <span>Digite @ para mencionar um asset deste vídeo</span>
          <span className="font-mono">{prompt.length} / {maxChars}</span>
        </div>
      </div>

      {supportsNegativePrompt && (
        <div>
          <button
            type="button"
            onClick={() => setShowNegative((v) => !v)}
            className="text-[11px] text-zinc-500 hover:text-zinc-800 flex items-center gap-1 py-0.5"
          >
            {showNegative ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Negative prompt
          </button>
          {showNegative && (
            <textarea
              value={negativePrompt}
              onChange={(e) => onChangeNegativePrompt(e.target.value)}
              placeholder="Elementos que devem ser evitados..."
              rows={2}
              className="mt-1.5 w-full p-2.5 bg-zinc-50 border border-zinc-200 focus:border-zinc-300 rounded-xl text-xs focus:outline-none resize-none"
            />
          )}
        </div>
      )}
    </div>
  );
};
