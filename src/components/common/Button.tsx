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
    sm: 'py-1.5 px-3 text-xs min-h-[36px]',
    md: 'py-2 px-4 text-sm min-h-[40px] sm:min-h-[44px]',
    lg: 'py-2.5 px-5 text-base min-h-[44px] sm:min-h-[48px]',
  };

  const variantStyles = {
    primary:
      'bg-zinc-900 text-zinc-50 hover:bg-zinc-800 active:bg-zinc-950 border border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2',
    secondary:
      'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 border border-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2',
    outline:
      'bg-transparent text-zinc-800 hover:bg-zinc-100 border border-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border border-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2',
    ghost:
      'bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2',
  };

  return (
    <button
      id={id}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
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
