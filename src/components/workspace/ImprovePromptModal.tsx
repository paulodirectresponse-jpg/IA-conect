import React, { useState } from 'react';
import { PromptImproveObjective } from '../../types/index.js';
import { workspaceService } from '../../services/workspaceService.js';
import { Sparkles, X, Check, RefreshCw, AlertCircle, Edit3 } from 'lucide-react';

interface ImprovePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalPrompt: string;
  onApplyImproved: (improvedPrompt: string) => void;
  modelName?: string;
  references?: Array<{ alias: string; type?: string; category?: string }>;
}

const OBJECTIVE_OPTIONS: Array<{ id: PromptImproveObjective; label: string; desc: string }> = [
  { id: 'CINEMATIC', label: 'Cinematográfico', desc: 'Direção de fotografia, movimento e luz' },
  { id: 'PRODUCT_FIDELITY', label: 'Fidelidade de Produto', desc: 'Reflexos, packshot e detalhes' },
  { id: 'CHARACTER_CONSISTENCY', label: 'Personagem', desc: 'Expressão natural, pele e consistência' },
  { id: 'MOTION', label: 'Movimento Dinâmico', desc: 'Velocidade, física e dinamismo temporal' },
  { id: 'REALISM', label: 'Fotorrealismo', desc: 'Texturas tácteis e iluminação natural' },
  { id: 'PROMPT_CLARITY', label: 'Clareza & Foco', desc: 'Eliminação de ambiguidades sintáticas' },
];

export const ImprovePromptModal: React.FC<ImprovePromptModalProps> = ({
  isOpen,
  onClose,
  originalPrompt,
  onApplyImproved,
  modelName = 'WAN 2.1 Video',
  references = [],
}) => {
  if (!isOpen) return null;

  const [objective, setObjective] = useState<PromptImproveObjective>('CINEMATIC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [improvedText, setImprovedText] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState<string>('');

  const handleGenerate = async (targetObjective = objective) => {
    setLoading(true);
    setError(null);
    try {
      const res = await workspaceService.improvePrompt({
        prompt: originalPrompt,
        objective: targetObjective,
        references,
        model_name: modelName,
      });
      setImprovedText(res.improved_prompt);
      setEditedText(res.improved_prompt);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Não foi possível otimizar o prompt com a IA.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && originalPrompt && !improvedText) {
      handleGenerate('CINEMATIC');
    }
  }, [isOpen]);

  const handleApply = () => {
    const finalPrompt = isEditing ? editedText : improvedText;
    onApplyImproved(finalPrompt || originalPrompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div
        id="modal-improve-prompt"
        className="w-full max-w-3xl bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden text-zinc-900 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Otimizador de Prompt (Gemini)</h2>
              <p className="text-xs text-zinc-500">Refine cinematografia e detalhes preservando suas @referências</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 text-xs">
          {/* Objectives */}
          <div>
            <label className="block text-zinc-700 font-medium mb-2">Objetivo de Otimização</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OBJECTIVE_OPTIONS.map((opt) => {
                const isSelected = objective === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setObjective(opt.id);
                      handleGenerate(opt.id);
                    }}
                    className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                        : 'bg-zinc-50/80 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <p className={`font-semibold ${isSelected ? 'text-emerald-700' : 'text-zinc-800'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comparison Side-by-Side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Original */}
            <div className="flex flex-col space-y-1.5">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="font-medium">Prompt Original</span>
                <span className="text-[10px] text-zinc-400 font-mono">{originalPrompt.length} chars</span>
              </div>
              <div className="flex-1 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-700 min-h-[140px] whitespace-pre-wrap leading-relaxed text-xs">
                {originalPrompt}
              </div>
            </div>

            {/* Improved */}
            <div className="flex flex-col space-y-1.5">
              <div className="flex items-center justify-between text-zinc-700">
                <span className="font-medium text-emerald-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Prompt Otimizado (Gemini)</span>
                </span>
                {improvedText && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-[11px] text-zinc-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditing ? 'Visualizar' : 'Editar'}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 p-3 rounded-xl bg-emerald-50/20 border border-emerald-200 text-zinc-800 min-h-[140px] relative">
                {loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-2xs rounded-xl">
                    <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                    <span className="text-zinc-600 text-xs">Otimizando detalhes com Gemini...</span>
                  </div>
                ) : isEditing ? (
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full h-full bg-transparent resize-none focus:outline-none text-zinc-900 text-xs leading-relaxed"
                  />
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed text-xs">
                    {improvedText || 'Clique em um objetivo acima para gerar a otimização.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Erro ao otimizar prompt</p>
                <p className="text-[11px] text-red-700 mt-0.5">{error}</p>
                <p className="text-[10px] text-zinc-500 mt-1">Seu prompt original foi mantido intacto.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors font-medium text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Gerar Novamente</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors font-medium text-xs cursor-pointer"
            >
              Manter Original
            </button>
            <button
              type="button"
              id="btn-apply-improved-prompt"
              onClick={handleApply}
              disabled={loading || (!improvedText && !editedText)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium transition-colors text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Usar Otimizado</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
