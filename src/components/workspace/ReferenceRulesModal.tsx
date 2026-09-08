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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div
        id="modal-reference-rules"
        className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden text-zinc-900 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Regras de Preservação de Referência</h2>
              <p className="text-xs text-emerald-700 font-mono">@{reference.alias_snapshot}</p>
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

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 text-xs">
          {/* Priority Level */}
          <div>
            <label className="block text-zinc-700 font-medium mb-2 flex items-center gap-1.5">
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
                    className={`py-2 px-2 text-center rounded-xl border font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
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
              <label className="text-emerald-700 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>O que DEVE ser preservado rigorosamente</span>
              </label>
              <span className="text-[10px] text-zinc-400">{preservationRules.length} regras ativas</span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-zinc-50 border border-zinc-200 min-h-[48px]">
              {defaults.preserve.map((rule) => {
                const active = preservationRules.includes(rule);
                return (
                  <button
                    key={rule}
                    type="button"
                    onClick={() => toggleRule(rule, 'PRESERVE')}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                        : 'bg-white border-zinc-200 text-zinc-400 line-through'
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
                    className="px-2.5 py-1 rounded-lg border bg-emerald-50 border-emerald-300 text-emerald-800 text-[11px] flex items-center gap-1"
                  >
                    {rule}
                    <button
                      type="button"
                      onClick={() => toggleRule(rule, 'PRESERVE')}
                      className="text-emerald-600 hover:text-emerald-900 cursor-pointer ml-1"
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
              <label className="text-sky-700 font-medium flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>O que PODE variar criativamente</span>
              </label>
              <span className="text-[10px] text-zinc-400">{flexibleRules.length} variações</span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-zinc-50 border border-zinc-200 min-h-[48px]">
              {defaults.flexible.map((rule) => {
                const active = flexibleRules.includes(rule);
                return (
                  <button
                    key={rule}
                    type="button"
                    onClick={() => toggleRule(rule, 'FLEXIBLE')}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                      active
                        ? 'bg-sky-50 border-sky-300 text-sky-800 font-medium'
                        : 'bg-white border-zinc-200 text-zinc-400 line-through'
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
                    className="px-2.5 py-1 rounded-lg border bg-sky-50 border-sky-300 text-sky-800 text-[11px] flex items-center gap-1"
                  >
                    {rule}
                    <button
                      type="button"
                      onClick={() => toggleRule(rule, 'FLEXIBLE')}
                      className="text-sky-600 hover:text-sky-900 cursor-pointer ml-1"
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
              className="bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 text-zinc-800 text-xs focus:outline-none"
            >
              <option value="PRESERVE">Preservar</option>
              <option value="FLEXIBLE">Pode Variar</option>
            </select>
            <input
              type="text"
              value={customRuleInput}
              onChange={(e) => setCustomRuleInput(e.target.value)}
              placeholder="Adicionar regra (ex: textura do tecido)..."
              className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-zinc-900 text-xs placeholder:text-zinc-400 focus:outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl font-medium border border-zinc-200 cursor-pointer"
            >
              Adicionar
            </button>
          </form>

          {/* Additional Notes */}
          <div>
            <label className="block text-zinc-700 font-medium mb-1">
              Notas Adicionais para a Compilação
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções específicas para o modelo a respeito desta referência..."
              rows={2}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-600 resize-none text-xs"
            />
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-500">
            <AlertCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Essas regras serão compiladas no cabeçalho do prompt para instruir o modelo sem comprometer a integridade da referência.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-100 flex items-center justify-end gap-2 bg-zinc-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors font-medium text-xs cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="btn-save-reference-rules"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Salvar Regras</span>
          </button>
        </div>
      </div>
    </div>
  );
};
