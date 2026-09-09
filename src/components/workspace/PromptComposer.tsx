import React, { useMemo, useRef, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Upload, Image as ImageIcon, Video, Music, Loader2 } from 'lucide-react';
import { Asset, WorkspaceReference } from '../../types/index.js';
import { assetService } from '../../services/assetService.js';

interface PromptComposerProps {
  prompt: string;
  onChangePrompt: (text: string) => void;
  negativePrompt: string;
  onChangeNegativePrompt: (text: string) => void;
  onOpenImproveModal: () => void;
  references: WorkspaceReference[];
  availableAssets: Asset[];
  onAttachAsset: (asset: Asset) => void;
  onAssetUploaded: (asset: Asset) => void;
  supportsNegativePrompt?: boolean;
  maxChars?: number;
}

const makeName = (file: File) => file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

export const PromptComposer: React.FC<PromptComposerProps> = ({
  prompt, onChangePrompt, negativePrompt, onChangeNegativePrompt, onOpenImproveModal,
  references, availableAssets, onAttachAsset, onAssetUploaded, supportsNegativePrompt = true, maxChars = 2000,
}) => {
  const [showNegative, setShowNegative] = useState(Boolean(negativePrompt));
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return availableAssets.filter(a => !q || a.name.toLowerCase().includes(q) || a.alias.toLowerCase().includes(q)).slice(0, 8);
  }, [availableAssets, mentionQuery]);

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = before.match(/(?:^|\s)@([\w-]*)$/);
    if (!match) { setMentionOpen(false); setMentionStart(null); return; }
    setMentionQuery(match[1] || '');
    setMentionStart(caret - (match[1]?.length || 0) - 1);
    setMentionOpen(true);
  };

  const insertAsset = (asset: Asset) => {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? prompt.length;
    const start = mentionStart ?? caret;
    const token = `@${asset.alias} `;
    const updated = prompt.slice(0, start) + token + prompt.slice(caret);
    onChangePrompt(updated);
    onAttachAsset(asset);
    setMentionOpen(false);
    setMentionQuery('');
    setTimeout(() => {
      textarea?.focus();
      const pos = start + token.length;
      textarea?.setSelectionRange(pos, pos);
    }, 0);
  };

  const quickUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await assetService.uploadAsset({ file, name: makeName(file) || file.name });
      onAssetUploaded(asset);
      insertAsset(asset);
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const mediaIcon = (asset: Asset) => asset.type === 'VIDEO' ? <Video className="w-4 h-4"/> : asset.type === 'AUDIO' ? <Music className="w-4 h-4"/> : <ImageIcon className="w-4 h-4"/>;

  return <div className="space-y-2">
    <div className="flex items-center justify-between">
      <label className="text-xs font-semibold text-zinc-700">Prompt</label>
      <button type="button" onClick={onOpenImproveModal} disabled={!prompt.trim()} className="text-[11px] font-medium text-emerald-700 disabled:opacity-40 flex items-center gap-1"><Sparkles className="w-3 h-3"/>Improve prompt</button>
    </div>

    <div className="relative">
      <textarea ref={textareaRef} id="workspace-prompt-input" value={prompt}
        onChange={e => { onChangePrompt(e.target.value); detectMention(e.target.value, e.target.selectionStart); }}
        onClick={e => detectMention(prompt, (e.target as HTMLTextAreaElement).selectionStart)}
        onKeyUp={e => { if (e.key === 'Escape') setMentionOpen(false); }}
        placeholder="Describe your video. Type @ to instantly reference an asset..." rows={5} maxLength={maxChars}
        className="w-full p-3 bg-white border border-zinc-200 hover:border-zinc-300 focus:border-emerald-600 rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-none leading-relaxed shadow-2xs" />

      {mentionOpen && <div className="absolute z-[80] left-2 right-2 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-zinc-500">Assets {mentionQuery ? `· ${mentionQuery}` : ''}</span>
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Upload className="w-3 h-3"/>} Novo asset
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {suggestions.map(asset => <button key={asset.asset_id} type="button" onClick={() => insertAsset(asset)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-50 text-left">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 overflow-hidden shrink-0 flex items-center justify-center text-zinc-400">
              {(asset.thumbnail_url || asset.public_url) && asset.type === 'IMAGE' ? <img src={asset.thumbnail_url || asset.public_url} className="w-full h-full object-cover" alt=""/> : mediaIcon(asset)}
            </div>
            <div className="min-w-0"><p className="text-xs font-semibold truncate">{asset.name}</p><p className="text-[10px] font-mono text-emerald-700 truncate">@{asset.alias}</p></div>
          </button>)}
          {!suggestions.length && <div className="p-4 text-center text-[11px] text-zinc-400">Nenhum asset encontrado. Clique em Novo asset para enviar agora.</div>}
        </div>
      </div>}
      <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={e => quickUpload(e.target.files?.[0])}/>
      <div className="flex justify-between mt-1 px-0.5 text-[10px] text-zinc-400"><span>Digite @ para abrir seus assets</span><span className="font-mono">{prompt.length} / {maxChars}</span></div>
    </div>

    {references.length > 0 && <div className="flex gap-1.5 overflow-x-auto py-0.5">{references.map(r => <span key={r.asset_id} className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">@{r.alias_snapshot}</span>)}</div>}

    {supportsNegativePrompt && <div>
      <button type="button" onClick={() => setShowNegative(!showNegative)} className="text-[11px] text-zinc-500 hover:text-zinc-800 flex items-center gap-1 py-0.5">
        {showNegative ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}<span>Negative prompt</span>
      </button>
      {showNegative && <textarea value={negativePrompt} onChange={e => onChangeNegativePrompt(e.target.value)} placeholder="Elements to avoid..." rows={2} className="mt-1.5 w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none resize-none"/>}
    </div>}
  </div>;
};
