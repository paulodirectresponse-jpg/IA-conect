import React from 'react';

export interface CardProps {
  id?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  id,
  title,
  subtitle,
  action,
  children,
  className = '',
}) => {
  return (
    <div
      id={id}
      className={`bg-white rounded-xl border border-zinc-200/80 p-5 sm:p-6 shadow-xs ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-zinc-100">
          <div>
            {title && <h3 className="text-base font-semibold text-zinc-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};
