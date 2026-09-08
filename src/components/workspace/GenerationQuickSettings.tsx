import React from 'react';
import { ModelCapabilities } from '../../types/index.js';

interface GenerationQuickSettingsProps {
  aspectRatio: string;
  onChangeAspectRatio: (val: string) => void;
  durationSeconds: number;
  onChangeDuration: (val: number) => void;
  resolution: string;
  onChangeResolution: (val: string) => void;
  numberOfOutputs: number;
  onChangeNumberOfOutputs: (val: number) => void;
  capabilities: ModelCapabilities | null;
}

const DEFAULT_ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', desc: 'Landscape' },
  { id: '9:16', label: '9:16', desc: 'Portrait' },
  { id: '1:1', label: '1:1', desc: 'Square' },
  { id: '21:9', label: '21:9', desc: 'Cinematic' },
];

export const GenerationQuickSettings: React.FC<GenerationQuickSettingsProps> = ({
  aspectRatio,
  onChangeAspectRatio,
  durationSeconds,
  onChangeDuration,
  resolution,
  onChangeResolution,
  numberOfOutputs,
  onChangeNumberOfOutputs,
  capabilities,
}) => {
  const supportedDurations = capabilities?.supported_durations || [5, 10];
  const supportedResolutions = capabilities?.supported_resolutions || ['720p', '1080p'];
  const supportedRatios = capabilities?.supported_aspect_ratios || ['16:9', '9:16', '1:1', '21:9'];

  return (
    <div className="space-y-3 pt-1">
      {/* Aspect Ratio */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          Aspect Ratio
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {DEFAULT_ASPECT_RATIOS.map((item) => {
            const isSelected = aspectRatio === item.id;
            const isSupported = supportedRatios.includes(item.id);

            return (
              <button
                key={item.id}
                type="button"
                disabled={!isSupported}
                onClick={() => onChangeAspectRatio(item.id)}
                className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-center ${
                  isSelected
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : isSupported
                    ? 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    : 'bg-zinc-50 border border-zinc-100 text-zinc-300 cursor-not-allowed'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration & Quality Row */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Duration */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            Duration
          </label>
          <div className="flex gap-1">
            {supportedDurations.map((dur) => {
              const isSelected = durationSeconds === dur;
              return (
                <button
                  key={dur}
                  type="button"
                  onClick={() => onChangeDuration(dur)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {dur}s
                </button>
              );
            })}
          </div>
        </div>

        {/* Quality / Resolution */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            Resolution
          </label>
          <div className="flex gap-1">
            {supportedResolutions.map((res) => {
              const isSelected = resolution === res;
              return (
                <button
                  key={res}
                  type="button"
                  onClick={() => onChangeResolution(res)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {res}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Number of Outputs */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-zinc-700">Variations</label>
          <span className="text-[10px] text-zinc-400">Generates N takes</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 4].map((count) => {
            const isSelected = numberOfOutputs === count;
            return (
              <button
                key={count}
                type="button"
                onClick={() => onChangeNumberOfOutputs(count)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-center ${
                  isSelected
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {count} {count === 1 ? 'take' : 'takes'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
