'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'alt' | 'glass';
  hover?: boolean;
}

export function Card({ 
  children, 
  className = '', 
  variant = 'default',
  hover = false
}: CardProps) {
  
  const variants = {
    default: 'bg-card-bg border-card-border',
    alt: 'bg-card-bg-alt border-divider',
    glass: 'bg-header-bg backdrop-blur-xl border-card-border shadow-2xl'
  };

  const hoverClass = hover ? 'hover:scale-[1.01] hover:shadow-lg hover:shadow-black/20 transition-all duration-300' : '';

  return (
    <div className={`border rounded-xl ${variants[variant]} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 border-b border-divider flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-5 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 border-t border-divider ${className}`}>
      {children}
    </div>
  );
}
