import React, { useState, useRef } from 'react';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle, X } from 'lucide-react';
import { WorkspaceReference } from '../../types/index.js';

interface PromptComposerProps {
  prompt: string;
  onChangePrompt: (text: string) => void;
  negativePrompt: string;
  onChangeNegativePrompt: (text: string) => void;
  onOpenImproveModal: () => void;
  references: WorkspaceReference[];
  maxChars?: number;
}

export const PromptComposer: React.FC<PromptComposerProps> = ({
  prompt,
  onChangePrompt,
  negativePrompt,
  onChangeNegativePrompt,
  onOpenImproveModal,
  references,
  maxChars = 2000,
}) => {
  const [showNegative, setShowNegative] = useState(Boolean(negativePrompt));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertAlias = (alias: string) => {
    const textToInsert = `@${alias} `;
    if (!textareaRef.current) {
      onChangePrompt((prev) => (prev ? `${prev} ${textToInsert}` : textToInsert));
      return;
    }

    const start = textareaRef.current.selectionStart || prompt.length;
    const end = textareaRef.current.selectionEnd || prompt.length;
    const updated = prompt.slice(0, start) + textToInsert + prompt.slice(end);
    onChangePrompt(updated);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          start + textToInsert.length,
          start + textToInsert.length
        );
      }
    }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-700">Prompt</label>
        <button
          type="button"
          id="btn-improve-prompt"
          onClick={onOpenImproveModal}
          disabled={!prompt.trim()}
          className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Sparkles className="w-3 h-3 text-emerald-600" />
          <span>Improve prompt</span>
        </button>
      </div>

      {/* Available @alias suggestions chips if references exist */}
      {references.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          <span className="text-[10px] text-zinc-400 shrink-0">Insert:</span>
          {references.map((ref) => (
            <button
              key={ref.asset_id}
              type="button"
              onClick={() => handleInsertAlias(ref.alias_snapshot)}
              className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 shrink-0 transition-colors cursor-pointer"
            >
              @{ref.alias_snapshot}
            </button>
          ))}
        </div>
      )}

      {/* Main Prompt Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="workspace-prompt-input"
          value={prompt}
          onChange={(e) => onChangePrompt(e.target.value)}
          placeholder="Describe your scene, camera movements, lighting, and action... Use @alias to reference assets."
          rows={4}
          maxLength={maxChars}
          className="w-full p-3 bg-white border border-zinc-200 hover:border-zinc-300 focus:border-emerald-600 rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-none leading-relaxed transition-colors shadow-2xs"
        />
        <div className="flex items-center justify-between mt-1 px-0.5 text-[10px] text-zinc-400">
          <span>Be descriptive for better results</span>
          <span className="font-mono">
            {prompt.length} / {maxChars}
          </span>
        </div>
      </div>

      {/* Negative Prompt Toggle */}
      <div>
        <button
          type="button"
          id="btn-toggle-negative-prompt"
          onClick={() => setShowNegative(!showNegative)}
          className="text-[11px] text-zinc-500 hover:text-zinc-800 flex items-center gap-1 cursor-pointer py-0.5"
        >
          {showNegative ? (
            <ChevronUp className="w-3 h-3 text-zinc-400" />
          ) : (
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          )}
          <span>Negative prompt</span>
          {negativePrompt && !showNegative && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 ml-0.5" />
          )}
        </button>

        {showNegative && (
          <div className="mt-1.5 animate-in fade-in">
            <textarea
              id="workspace-negative-prompt-input"
              value={negativePrompt}
              onChange={(e) => onChangeNegativePrompt(e.target.value)}
              placeholder="Elements to avoid (e.g. blur, artifacts, distorted hands, watermark)..."
              rows={2}
              className="w-full p-2.5 bg-zinc-50/60 border border-zinc-200 focus:border-zinc-300 focus:bg-white rounded-xl text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none resize-none leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  );
};
