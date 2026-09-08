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
}) => {
  return (
    <div
      id={id}
      className="flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50"
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 mb-3">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-semibold text-zinc-900 tracking-tight">{title}</h4>
      <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
