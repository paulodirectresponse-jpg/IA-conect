import React from 'react';
import { WorkspacePreset } from '../../types/index.js';
import { Film, Sparkles, CheckCircle2, AlertCircle, Clock, Play, Bookmark, ArrowRight, ShieldCheck } from 'lucide-react';

interface ResultsCanvasProps {
  lastSavedTime: string | null;
  validating: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  onOpenPresets: () => void;
  presets: WorkspacePreset[];
  onApplyPreset: (preset: WorkspacePreset) => void;
  prompt: string;
  hasReferences: boolean;
}

export const ResultsCanvas: React.FC<ResultsCanvasProps> = ({
  lastSavedTime,
  validating,
  validationErrors,
  validationWarnings,
  onOpenPresets,
  presets,
  onApplyPreset,
  prompt,
  hasReferences,
}) => {
  return (
    <div className="flex-1 h-full flex flex-col bg-[#F7F7F8] p-4 lg:p-6 overflow-y-auto">
      {/* Top Canvas Bar: Status and Presets trigger */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Canvas Workspace</span>
          {lastSavedTime && (
            <span className="text-[11px] text-zinc-400 font-mono">
              • Saved {lastSavedTime}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenPresets}
          className="px-3 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
        >
          <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
          <span>Presets & Templates ({presets.length})</span>
        </button>
      </div>

      {/* Main Canvas Centerpiece */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[440px] max-w-3xl w-full mx-auto">
        <div className="w-full aspect-video max-h-[480px] bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center relative overflow-hidden group">
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Icon / Action Focal Point */}
          <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-400 mb-4 shadow-2xs group-hover:scale-105 transition-transform">
            <Film className="w-6 h-6 text-zinc-500" />
          </div>

          <h3 className="text-base font-semibold text-zinc-900 mb-1">
            {prompt.trim() ? 'Ready to compile production' : 'Create your next video'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-md leading-relaxed mb-6">
            {prompt.trim()
              ? 'Your prompt and reference assets are configured. Click "Generate video" in the left panel to validate parameters and compile the production payload.'
              : 'Select your preferred AI model on the left, add reference media or start frames, and describe the camera motion to generate cinematic takes.'}
          </p>

          {/* Validation Status Badges */}
          {validationErrors.length > 0 ? (
            <div className="w-full max-w-md p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 text-left mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-red-900">Please review settings</p>
                <p className="text-[11px] text-red-700 mt-0.5">{validationErrors[0]}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Deterministic pricing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero dark mode distortion</span>
              </div>
            </div>
          )}

          {/* Quick inspiration template pills */}
          {presets.length > 0 && !prompt.trim() && (
            <div className="mt-6 pt-6 border-t border-zinc-100 w-full max-w-lg">
              <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider block mb-2">
                Quick Start Templates
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {presets.slice(0, 3).map((p) => (
                  <button
                    key={p.preset_id}
                    type="button"
                    onClick={() => onApplyPreset(p)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>{p.name}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
