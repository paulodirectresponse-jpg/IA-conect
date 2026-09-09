import React from 'react';
import { ChevronDown, ChevronUp, Sliders, Dices } from 'lucide-react';
import { ModelCapabilities } from '../../types/index.js';

interface AdvancedSettingsProps {
  isOpen: boolean;
  onToggle: () => void;
  seed: number | '';
  onChangeSeed: (seed: number | '') => void;
  motionStrength: number;
  onChangeMotionStrength: (val: number) => void;
  capabilities: ModelCapabilities | null;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  isOpen,
  onToggle,
  seed,
  onChangeSeed,
  motionStrength,
  onChangeMotionStrength,
  capabilities,
}) => {
  const supportsSeed = capabilities?.supports_seed !== false;
  const supportsMotion = Boolean(capabilities?.supports_motion_strength);
  if (!supportsSeed && !supportsMotion) return null;

  const handleRandomizeSeed = () => onChangeSeed(Math.floor(Math.random() * 999999999));

  return (
    <div className="border-t border-zinc-100 pt-2">
      <button
        type="button"
        id="btn-toggle-advanced-settings"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
          <span>Configurações avançadas</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {isOpen && (
        <div className="space-y-3 pt-2 pb-1 animate-in fade-in text-xs">
          {supportsMotion && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-600 font-medium">Intensidade de movimento</label>
                <span className="font-mono text-zinc-800 font-semibold">{motionStrength} / 10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={motionStrength}
                onChange={(e) => onChangeMotionStrength(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-zinc-200 rounded-lg appearance-none"
              />
            </div>
          )}

          {supportsSeed && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-600 font-medium">Seed</label>
                <button
                  type="button"
                  onClick={handleRandomizeSeed}
                  className="text-[10px] text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-medium"
                >
                  <Dices className="w-3 h-3" /> Aleatória
                </button>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => onChangeSeed(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="Automática"
                  className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-zinc-900 text-xs focus:outline-none focus:border-zinc-400 placeholder:text-zinc-400"
                />
                {seed !== '' && (
                  <button
                    type="button"
                    onClick={() => onChangeSeed('')}
                    className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-[11px] font-medium"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
