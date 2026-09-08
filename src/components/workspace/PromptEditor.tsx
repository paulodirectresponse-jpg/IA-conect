import React, { useState, useRef, useEffect } from 'react';
import { Asset, WorkspaceReference } from '../../types/index.js';
import { ReferenceAutocomplete } from './ReferenceAutocomplete.js';
import { Sparkles, SlidersHorizontal, EyeOff, Shield } from 'lucide-react';

interface PromptEditorProps {
  prompt: string;
  onChangePrompt: (val: string) => void;
  negativePrompt?: string;
  onChangeNegativePrompt?: (val: string) => void;
  supportsNegativePrompt?: boolean;
  maxPromptLength?: number;
  availableAssets: Asset[];
  attachedReferences: WorkspaceReference[];
  onAddReference: (asset: Asset) => void;
  onOpenQuickUpload: () => void;
  onOpenImproveModal: () => void;
  onTriggerGenerate?: () => void;
  onSaveDraft?: () => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  prompt,
  onChangePrompt,
  negativePrompt = '',
  onChangeNegativePrompt,
  supportsNegativePrompt = true,
  maxPromptLength = 2500,
  availableAssets,
  attachedReferences,
  onAddReference,
  onOpenQuickUpload,
  onOpenImproveModal,
  onTriggerGenerate,
  onSaveDraft,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [atPosition, setAtPosition] = useState<number | null>(null);
  const [showNegativePrompt, setShowNegativePrompt] = useState(Boolean(negativePrompt));

  // Filter assets based on query
  const filteredAssets = availableAssets.filter((a) => {
    if (!autocompleteQuery) return true;
    const q = autocompleteQuery.toLowerCase();
    return a.alias.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
  });

  // Handle cursor and key events for @ detection
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChangePrompt(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (atMatch) {
      setAtPosition(cursorPos - atMatch[0].length);
      setAutocompleteQuery(atMatch[1] || '');
      setShowAutocomplete(true);
      setAutocompleteIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleSelectAsset = (asset: Asset) => {
    if (atPosition === null || !textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart;
    const beforeAt = prompt.slice(0, atPosition);
    const afterCursor = prompt.slice(cursorPos);
    const replacement = `@${asset.alias} `;

    const newPrompt = beforeAt + replacement + afterCursor;
    onChangePrompt(newPrompt);
    setShowAutocomplete(false);

    // Make sure it's attached as reference
    onAddReference(asset);

    // Restore focus and cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextCursor = atPosition + replacement.length;
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete navigation
    if (showAutocomplete && filteredAssets.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev + 1) % filteredAssets.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev - 1 + filteredAssets.length) % filteredAssets.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredAssets[autocompleteIndex];
        if (selected) {
          handleSelectAsset(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowAutocomplete(false);
        return;
      }
    }

    // Global workspace shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (onTriggerGenerate) onTriggerGenerate();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (onSaveDraft) onSaveDraft();
    }
  };

  return (
    <div className="relative flex flex-col bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl focus-within:border-zinc-700 transition-all text-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 mb-2">
        <label htmlFor="workspace-prompt-input" className="font-medium text-zinc-300 flex items-center gap-1.5">
          <span>Prompt da Cena</span>
          <span className="text-[11px] text-zinc-500 font-normal">
            (use <strong className="text-emerald-400 font-mono">@</strong> para referenciar produtos e mídias)
          </span>
        </label>

        {/* Action Button: Improve Prompt */}
        <button
          type="button"
          id="btn-improve-prompt-trigger"
          onClick={onOpenImproveModal}
          disabled={!prompt.trim()}
          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 font-medium transition-colors"
          title="Melhorar prompt com Gemini"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Melhorar com IA</span>
        </button>
      </div>

      {/* Main Prompt Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="workspace-prompt-input"
          value={prompt}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Descreva a cena desejada em detalhes. Ex: Um comercial de @perfume caindo em câmera lenta sobre águas translúcidas com reflexos dourados e iluminação cinematográfica..."
          rows={4}
          className="w-full bg-transparent resize-none focus:outline-none text-zinc-100 placeholder:text-zinc-600 text-sm leading-relaxed"
        />

        {/* Autocomplete Popup */}
        {showAutocomplete && (
          <div className="absolute left-2 top-full mt-1">
            <ReferenceAutocomplete
              assets={filteredAssets}
              selectedIndex={autocompleteIndex}
              onSelect={handleSelectAsset}
              onQuickUpload={() => {
                setShowAutocomplete(false);
                onOpenQuickUpload();
              }}
              query={autocompleteQuery}
            />
          </div>
        )}
      </div>

      {/* Negative Prompt Expandable */}
      {showNegativePrompt && supportsNegativePrompt && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 animate-in fade-in">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="workspace-negative-prompt" className="text-zinc-400 font-medium flex items-center gap-1">
              <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
              <span>Negative Prompt (O que evitar)</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setShowNegativePrompt(false);
                if (onChangeNegativePrompt) onChangeNegativePrompt('');
              }}
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Remover
            </button>
          </div>
          <textarea
            id="workspace-negative-prompt"
            value={negativePrompt}
            onChange={(e) => onChangeNegativePrompt && onChangeNegativePrompt(e.target.value)}
            placeholder="Ex: deformado, baixa resolução, sombras estouradas, ruído, distorção de logo..."
            rows={2}
            className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-3 py-2 text-zinc-300 placeholder:text-zinc-600 text-xs focus:outline-none focus:border-zinc-700 resize-none"
          />
        </div>
      )}

      {/* Footer bar */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500">
        <div className="flex items-center gap-3">
          {supportsNegativePrompt && !showNegativePrompt && (
            <button
              type="button"
              id="btn-toggle-negative-prompt"
              onClick={() => setShowNegativePrompt(true)}
              className="hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>+ Negative Prompt</span>
            </button>
          )}

          <span className="flex items-center gap-1 text-zinc-400">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>{attachedReferences.length} @ref ativa(s)</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-zinc-600 font-mono">
            Ctrl+Enter para validar
          </span>
          <span className={`font-mono ${prompt.length > maxPromptLength ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
            {prompt.length}/{maxPromptLength}
          </span>
        </div>
      </div>
    </div>
  );
};
