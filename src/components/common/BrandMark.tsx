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
      <div className="min-w-[78px] leading-none">
        <div className="whitespace-nowrap text-[14px] font-bold tracking-[-0.02em] text-[var(--ia-text-1)]">IA Connect</div>
        <div className="mt-1 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ia-text-4)]">AI Studio</div>
      </div>
    )}
  </div>
);
