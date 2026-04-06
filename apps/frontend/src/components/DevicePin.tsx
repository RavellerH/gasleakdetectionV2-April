'use client';

import { Wifi, Network, Radio, Camera, Activity } from 'lucide-react';

interface DevicePinProps {
  type?: string;
  healthScore: number;
  ppm?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  size?: number;
}

export function DevicePin({ 
  type = 'SENSOR',
  healthScore, 
  ppm = 0, 
  warningThreshold = 50, 
  criticalThreshold = 80, 
  size = 20 
}: DevicePinProps) {
  
  // Color logic based on PPM (Priority) then Health
  let color = '#22d3ee'; // Default Safe Cyan
  let isAlert = false;

  if (ppm >= criticalThreshold) {
    color = '#ef4444'; // Critical Red
    isAlert = true;
  } else if (ppm >= warningThreshold) {
    color = '#f59e0b'; // Warning Orange
    isAlert = true;
  } else if (healthScore < 50) {
    color = '#64748b'; // Low health gray
  }

  const renderIcon = () => {
    const iconSize = size * 0.55;
    const props = { size: iconSize, strokeWidth: 2.5, className: "text-white" };
    
    switch (type.toUpperCase()) {
      case 'GATEWAY':
        return <Wifi {...props} />;
      case 'CLUSTER':
        return <Network {...props} />;
      case 'SENSOR':
        return <Radio {...props} />;
      default:
        return <Activity {...props} />;
    }
  };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <style>{`
        @keyframes pin-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.4; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      
      {isAlert && (
        <div 
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: '50%',
            background: color,
            opacity: 0.4,
            animation: 'pin-pulse 1.5s infinite'
          }}
        />
      )}

      <div
        className="cursor-pointer group"
        style={{
          width: size,
          height: size,
          borderRadius: '50% 50% 50% 0',
          backgroundColor: color,
          border: '1.5px solid rgba(255,255,255,0.9)',
          boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
          transform: 'rotate(-45deg)',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 2
        }}
      >
        <div style={{ 
          transform: 'rotate(45deg)', // Counter-rotate the inner icon
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {renderIcon()}
        </div>
      </div>
      
      {/* Mini health indicator bar */}
      <div style={{
        position: 'absolute',
        bottom: -5,
        left: '50%',
        transform: 'translateX(-50%)',
        width: size * 0.9,
        height: 2.5,
        background: 'rgba(0,0,0,0.4)',
        borderRadius: 1,
        overflow: 'hidden',
        zIndex: 3
      }}>
        <div style={{
          width: `${healthScore}%`,
          height: '100%',
          background: healthScore > 70 ? '#22c55e' : healthScore > 30 ? '#f59e0b' : '#ef4444'
        }} />
      </div>
    </div>
  );
}
