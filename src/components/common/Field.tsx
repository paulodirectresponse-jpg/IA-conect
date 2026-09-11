import React from 'react';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const FieldShell: React.FC<FieldShellProps> = ({ label, hint, error, children, className = '' }) => (
  <label className={`block ${className}`}>
    {label && <span className="ia-label block mb-2">{label}</span>}
    {children}
    {(error || hint) && (
      <span className={`mt-1.5 block text-[10px] leading-relaxed ${error ? 'text-rose-300' : 'text-[var(--ia-text-4)]'}`}>
        {error || hint}
      </span>
    )}
  </label>
);

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({ invalid = false, className = '', ...props }) => (
  <input
    aria-invalid={invalid || undefined}
    className={`ia-control h-10 w-full px-3 text-xs outline-none placeholder:text-[var(--ia-text-4)] ${invalid ? 'border-rose-400/35' : ''} ${className}`}
    {...props}
  />
);

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({ invalid = false, className = '', ...props }) => (
  <textarea
    aria-invalid={invalid || undefined}
    className={`ia-control min-h-24 w-full px-3 py-2.5 text-xs leading-relaxed outline-none placeholder:text-[var(--ia-text-4)] ${invalid ? 'border-rose-400/35' : ''} ${className}`}
    {...props}
  />
);
