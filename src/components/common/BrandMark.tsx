import React from 'react';

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ compact = false, className = '' }) => (
  <div className={`flex items-center gap-2.5 select-none ${className}`}>
    <img
      src="/brand/ia-connect-logo-oficial.png"
      alt={compact ? '' : 'IA Connect'}
      aria-hidden={compact ? true : undefined}
      className="h-8 w-auto max-w-[96px] shrink-0 object-contain"
      draggable={false}
    />
    {!compact && (
      <div className="leading-none">
        <div className="text-[14px] font-black tracking-[-0.035em] text-[var(--ia-text-1)]">IA Connect</div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.20em] text-[var(--ia-text-4)]">Creative AI Studio</div>
      </div>
    )}
  </div>
);
