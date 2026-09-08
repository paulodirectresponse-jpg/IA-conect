import React from 'react';

export interface BadgeProps {
  id?: string;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  id,
  variant = 'neutral',
  children,
  className = '',
}) => {
  const variantStyles = {
    neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
  };

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap tracking-tight ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
