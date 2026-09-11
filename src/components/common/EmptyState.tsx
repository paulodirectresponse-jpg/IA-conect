import React from 'react';

export interface EmptyStateProps {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  id,
  icon,
  title,
  description,
  action,
}) => (
  <div
    id={id}
    className="flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-[var(--ia-line)] rounded-[var(--ia-radius-lg)] bg-[var(--ia-surface-soft)]"
  >
    {icon && (
      <div className="w-11 h-11 rounded-[var(--ia-radius-md)] border border-[var(--ia-line)] bg-[var(--ia-surface-2)] flex items-center justify-center text-[var(--ia-text-3)] mb-3">
        {icon}
      </div>
    )}
    <h4 className="text-sm font-semibold text-[var(--ia-text-1)] tracking-[-.01em]">{title}</h4>
    <p className="ia-compact max-w-sm mt-1 mb-4">{description}</p>
    {action && <div>{action}</div>}
  </div>
);
