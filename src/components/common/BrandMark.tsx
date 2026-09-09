import React from 'react';

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ compact = false, className = '' }) => (
  <div className={`flex items-center gap-2.5 select-none ${className}`}>
    <div className="relative w-8 h-8 shrink-0 rounded-[10px] bg-[linear-gradient(145deg,#151926,#090b11)] border border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,.28)] overflow-hidden">
      <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="ia-connect-mark" x1="4" y1="5" x2="28" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8b5cf6" />
            <stop offset="0.48" stopColor="#d946ef" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <path d="M7.5 23.5 12.4 8.8c.7-2 3.5-2.1 4.3-.1l2.2 5.7 2.4-5.4c.9-1.9 3.6-1.6 4 .5l2.1 14" fill="none" stroke="url(#ia-connect-mark)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.4 18.2h10.8" stroke="url(#ia-connect-mark)" strokeWidth="2.3" strokeLinecap="round" opacity=".92"/>
      </svg>
      <span className="absolute inset-x-1 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
    </div>
    {!compact && (
      <div className="leading-none">
        <div className="text-[14px] font-black tracking-[-0.035em] text-white">IA Connect</div>
        <div className="mt-1 text-[7px] font-bold uppercase tracking-[0.25em] text-zinc-600">Creative AI Studio</div>
      </div>
    )}
  </div>
);
