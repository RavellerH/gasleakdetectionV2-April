'use client';

import React from 'react';

interface BadgeProps {
  variant?: 'online' | 'offline' | 'warning' | 'info' | 'critical' | 'health' | 'battery';
  value?: string | number;
  children?: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ 
  variant = 'info', 
  value, 
  children, 
  className = '',
  dot = false 
}: BadgeProps) {
  
  const variants = {
    online: 'text-status-online bg-status-online/10 border-status-online/20',
    offline: 'text-status-offline bg-status-offline/10 border-status-offline/20',
    warning: 'text-status-warning bg-status-warning/10 border-status-warning/20',
    critical: 'text-status-offline bg-status-offline/10 border-status-offline/20',
    info: 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20',
    health: 'bg-opacity-10 font-bold',
    battery: 'font-bold'
  };

  const getHealthColor = (h: number) => {
    if (h >= 80) return 'text-status-online bg-status-online/10 border-status-online/20';
    if (h >= 50) return 'text-status-warning bg-status-warning/10 border-status-warning/20';
    return 'text-status-offline bg-status-offline/10 border-status-offline/20';
  };

  const getBatteryColor = (b: number) => {
    if (b >= 60) return 'text-status-online bg-status-online/10 border-status-online/20';
    if (b >= 30) return 'text-status-warning bg-status-warning/10 border-status-warning/20';
    return 'text-status-offline bg-status-offline/10 border-status-offline/20';
  };

  let variantClass = variants[variant as keyof typeof variants] || variants.info;
  
  if (variant === 'health' && typeof value === 'number') {
    variantClass = getHealthColor(value);
  } else if (variant === 'battery' && typeof value === 'number') {
    variantClass = getBatteryColor(value);
  }

  const dotColor = variant === 'online' ? 'bg-status-online' : 
                   variant === 'offline' ? 'bg-status-offline' : 
                   variant === 'warning' ? 'bg-status-warning' : 'bg-current';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono tracking-tight uppercase ${variantClass} ${className}`}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {variant === 'online' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`}></span>
        </span>
      )}
      {children || value}
    </div>
  );
}
