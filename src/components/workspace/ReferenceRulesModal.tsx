import React, { useState } from 'react';
import { WorkspaceReference, ReferencePriority } from '../../types/index.js';
import { DEFAULT_PRESERVATION_RULES } from '../../config/constants.js';
import { X, Check, Shield, Sliders, AlertCircle } from 'lucide-react';

interface ReferenceRulesModalProps {
  reference: WorkspaceReference;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: WorkspaceReference) => void;
}

export const ReferenceRulesModal: React.FC<ReferenceRulesModalProps> = ({
  reference,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const categoryKey = (reference.asset?.category || 'PRODUCT') as keyof typeof DEFAULT_PRESERVATION_RULES;
  const defaults = DEFAULT_PRESERVATION_RULES[categoryKey] || DEFAULT_PRESERVATION_RULES.PRODUCT;

  const [priority, setPriority] = useState<ReferencePriority>(reference.priority || 'HIGH');
  const [preservationRules, setPreservationRules] = useState<string[]>(
    reference.preservation_rules && reference.preservation_rules.length > 0
      ? reference.preservation_rules
      : defaults.preserve
  );
  const [flexibleRules, setFlexibleRules] = useState<string[]>(
    reference.flexible_rules && reference.flexible_rules.length > 0
      ? reference.flexible_rules
      : defaults.flexible
  );
  const [notes, setNotes] = useState<string>(reference.notes || '');
  const [customRuleInput, setCustomRuleInput] = useState('');
  const [customRuleType, setCustomRuleType] = useState<'PRESERVE' | 'FLEXIBLE'>('PRESERVE');

  const toggleRule = (rule: string, target: 'PRESERVE' | 'FLEXIBLE') => {
    if (target === 'PRESERVE') {
      if (preservationRules.includes(rule)) {
        setPreservationRules(preservationRules.filter((r) => r !== rule));
      } else {
        setPreservationRules([...preservationRules, rule]);
        setFlexibleRules(flexibleRules.filter((r) => r !== rule));
      }
    } else {
      if (flexibleRules.includes(rule)) {
        setFlexibleRules(flexibleRules.filter((r) => r !== rule));
      } else {
        setFlexibleRules([...flexibleRules, rule]);
        setPreservationRules(preservationRules.filter((r) => r !== rule));
      }
    }
  };

  const handleAddCustomRule = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customRuleInput.trim();
    if (!clean) return;

    if (customRuleType === 'PRESERVE') {
      if (!preservationRules.includes(clean)) setPreservationRules([...preservationRules, clean]);
    } else {
      if (!flexibleRules.includes(clean)) setFlexibleRules([...flexibleRules, clean]);
    }
    setCustomRuleInput('');
  };

  const handleSave = () => {
    onSave({
      ...reference,
      priority,
      preservation_rules: preservationRules,
      flexible_rules: flexibleRules,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
        id="modal-reference-rules"
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Regras de Preservação de Referência</h2>
              <p className="text-xs text-emerald-400 font-mono">@{reference.alias_snapshot}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 text-xs">
          {/* Priority Level */}
          <div>
            <label className="block text-zinc-300 font-medium mb-2 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <span>Prioridade de Fidelidade</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as ReferencePriority[]).map((p) => {
                const isSelected = priority === p;
                const labels: Record<ReferencePriority, string> = {
                  LOW: 'Baixa',
                  MEDIUM: 'Média',
                  HIGH: 'Alta',
                  CRITICAL: 'Crítica',
                };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-2 px-2 text-center rounded-lg border font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {labels[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preservation Rules (Must keep identical) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>O que DEVE ser preservado rigorosamente</span>
              </label>
              <span className="text-[10px] text-zinc-500">{preservationRules.length} regras ativas</span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80 min-h-[48px]">
              {defaults.preserve.map((rule) => {
                const active = preservationRules.includes(rule);
                return (
                  <button
                    key={rule}
                    type="button"
                    onClick={() => toggleRule(rule, 'PRESERVE')}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-medium'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 line-through'
                    }`}
                  >
                    {rule}
                  </button>
                );
              })}
              {preservationRules
                .filter((r) => !defaults.preserve.includes(r))
                .map((rule) => (
                  <span
                    key={rule}
                    className="px-2.5 py-1 rounded-lg border bg-emerald-500/20 border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-1"
                  >
                    {rule}
                    <button
                      type="button"
                      onClick={() => toggleRule(rule, 'PRESERVE')}
                      className="text-emerald-400 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          </div>

          {/* Flexible Rules (Can vary / creative freedom) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sky-400 font-medium flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>O que PODE variar criativamente</span>
              </label>
              <span className="text-[10px] text-zinc-500">{flexibleRules.length} variações</span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80 min-h-[48px]">
              {defaults.flexible.map((rule) => {
                const active = flexibleRules.includes(rule);
                return (
                  <button
                    key={rule}
                    type="button"
                    onClick={() => toggleRule(rule, 'FLEXIBLE')}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors ${
                      active
                        ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 font-medium'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 line-through'
                    }`}
                  >
                    {rule}
                  </button>
                );
              })}
              {flexibleRules
                .filter((r) => !defaults.flexible.includes(r))
                .map((rule) => (
                  <span
                    key={rule}
                    className="px-2.5 py-1 rounded-lg border bg-sky-500/20 border-sky-500/40 text-sky-300 text-[11px] flex items-center gap-1"
                  >
                    {rule}
                    <button
                      type="button"
                      onClick={() => toggleRule(rule, 'FLEXIBLE')}
                      className="text-sky-400 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          </div>

          {/* Add Custom Rule */}
          <form onSubmit={handleAddCustomRule} className="flex gap-2">
            <select
              value={customRuleType}
              onChange={(e) => setCustomRuleType(e.target.value as any)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none"
            >
              <option value="PRESERVE">Preservar</option>
              <option value="FLEXIBLE">Pode Variar</option>
            </select>
            <input
              type="text"
              value={customRuleInput}
              onChange={(e) => setCustomRuleInput(e.target.value)}
              placeholder="Adicionar regra personalizada (ex: textura do couro)..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-200 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium border border-zinc-700"
            >
              Adicionar
            </button>
          </form>

          {/* Additional Notes */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Notas Adicionais para a Compilação
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções específicas para o modelo a respeito desta referência..."
              rows={2}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 resize-none text-xs"
            />
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/40 text-[11px] text-zinc-400">
            <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Essas regras serão compiladas no cabeçalho do prompt para instruir o modelo sem comprometer a integridade da referência.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-end gap-2 bg-zinc-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-medium text-xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="btn-save-reference-rules"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold transition-colors text-xs flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Salvar Regras</span>
          </button>
        </div>
      </div>
    </div>
  );
};
