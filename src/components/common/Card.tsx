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
    <section
      id={id}
      className={`ia-surface p-5 sm:p-6 ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-[var(--ia-line)]">
          <div className="min-w-0">
            {title && <h3 className="ia-section-title">{title}</h3>}
            {subtitle && <p className="ia-compact mt-1">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
};
