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
}) => (
  <span
    id={id}
    data-tone={variant}
    className={`ia-badge ${className}`}
  >
    {children}
  </span>
);
