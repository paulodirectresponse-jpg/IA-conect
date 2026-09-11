import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  id: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  id,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const sizeStyles = {
    sm: 'h-9 px-3 text-[11px]',
    md: 'h-10 sm:h-11 px-4 text-xs',
    lg: 'h-11 sm:h-12 px-5 text-sm',
  };

  const variantStyles = {
    primary: 'ia-button-primary',
    secondary: 'ia-control',
    outline:
      'border border-[var(--ia-line)] bg-transparent text-[var(--ia-text-2)] hover:border-[var(--ia-line-strong)] hover:bg-[var(--ia-surface-hover)] hover:text-[var(--ia-text-1)]',
    danger:
      'border border-rose-400/15 bg-rose-500/[0.07] text-rose-300 hover:bg-rose-500/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/20',
    ghost:
      'border border-transparent bg-transparent text-[var(--ia-text-2)] hover:bg-[var(--ia-surface-hover)] hover:text-[var(--ia-text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/15',
  };

  return (
    <button
      id={id}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--ia-radius-md)] font-semibold whitespace-nowrap select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
};
