import React from 'react';

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ compact = false, className = '' }) => (
  <div className={`flex items-center gap-2.5 select-none ${className}`}>
    <div className="relative w-8 h-8 shrink-0">
      <span className="absolute left-[2px] top-[4px] h-6 w-3 rounded-full rotate-[28deg] bg-gradient-to-b from-violet-400 via-fuchsia-500 to-cyan-400 shadow-[0_0_18px_rgba(168,85,247,.35)]" />
      <span className="absolute right-[2px] top-[4px] h-6 w-3 rounded-full -rotate-[28deg] bg-gradient-to-b from-cyan-300 via-emerald-400 to-violet-500 shadow-[0_0_18px_rgba(34,211,238,.28)]" />
      <span className="absolute left-1/2 top-[11px] h-3.5 w-2 -translate-x-1/2 rounded-full bg-[#0b0d12]" />
    </div>
    {!compact && (
      <div className="leading-none">
        <div className="text-[15px] font-black tracking-[-0.03em] text-white">IA Connect</div>
        <div className="mt-1 text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Creative Studio</div>
      </div>
    )}
  </div>
);
