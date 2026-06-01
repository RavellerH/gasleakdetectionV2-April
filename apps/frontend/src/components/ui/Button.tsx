'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  children, 
  className = '', 
  ...props 
}: ButtonProps) {
  
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed outline-none';
  
  const variants = {
    primary: 'bg-gradient-to-br from-brand-navy to-brand-blue text-white shadow-lg shadow-brand-navy/20 hover:shadow-brand-navy/40 active:scale-[0.98]',
    secondary: 'bg-card-bg border border-card-border text-t3 hover:bg-card-bg-alt hover:text-t2',
    danger: 'bg-status-offline/10 border border-status-offline/20 text-status-offline hover:bg-status-offline/20',
    success: 'bg-status-online/10 border border-status-online/20 text-status-online hover:bg-status-online/20',
    ghost: 'bg-transparent text-t4 hover:text-t2 hover:bg-card-bg-alt'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2'
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  );
}
