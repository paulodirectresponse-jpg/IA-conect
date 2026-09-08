import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

export const ToastNotification: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          error: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
          info: <Info className="w-4 h-4 text-sky-600 shrink-0" />,
        };

        const borders = {
          success: 'border-emerald-200 bg-white text-zinc-900',
          warning: 'border-amber-200 bg-white text-zinc-900',
          error: 'border-rose-200 bg-white text-zinc-900',
          info: 'border-sky-200 bg-white text-zinc-900',
        };

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border shadow-lg text-sm transition-all ${borders[t.type]}`}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5">{icons[t.type]}</span>
              <p className="text-xs leading-relaxed text-zinc-800 font-medium">{t.message}</p>
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
