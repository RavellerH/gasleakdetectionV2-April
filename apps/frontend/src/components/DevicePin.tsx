'use client';

import { Wifi, Network, Radio } from 'lucide-react';

interface DevicePinProps {
  type?: string;
  healthScore: number;
  confidence?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  size?: number;
}

const ANIM = `
  @keyframes gw-ring   { 0% { transform:scale(1); opacity:.7; } 100% { transform:scale(2.2); opacity:0; } }
  @keyframes pulse-ring { 0%,100% { transform:scale(1); opacity:.7; } 50% { transform:scale(1.9); opacity:0; } }
`;

function HealthBar({ pct, w }: { pct: number; w: number }) {
  const bg = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)', width:w, height:2.5, background:'rgba(0,0,0,0.55)', borderRadius:2, overflow:'hidden', zIndex:5 }}>
      <div style={{ width:`${pct}%`, height:'100%', background:bg }} />
    </div>
  );
}

export function DevicePin({
  type = 'SENSOR',
  healthScore,
  confidence = 0,
  warningThreshold = 0.70,
  criticalThreshold = 0.80,
  size = 20,
}: DevicePinProps) {
  const t = type.toUpperCase();
  const isCritical = confidence >= criticalThreshold;
  const isWarning  = !isCritical && confidence >= warningThreshold;
  const isAlert    = isCritical || isWarning;
  const alertColor = isCritical ? '#ef4444' : '#f59e0b';

  /* ── GATEWAY: large circle with expanding sonar ring ─────────── */
  if (t === 'GATEWAY') {
    const s = Math.round(size * 1.9);
    const color = isAlert ? alertColor : '#38bdf8';
    return (
      <div style={{ position:'relative', width:s, height:s, cursor:'pointer' }}>
        <style>{ANIM}</style>
        {/* Sonar ring — always active to show it's a live root node */}
        <div style={{ position:'absolute', inset:-3, borderRadius:'50%', border:`1.5px solid ${color}`, animation:'gw-ring 2.4s ease-out infinite', pointerEvents:'none' }} />
        {/* Body */}
        <div style={{ width:s, height:s, borderRadius:'50%', background:`${color}18`, border:`2.5px solid ${color}`, boxShadow:`0 0 16px ${color}55, 0 0 6px ${color}30 inset`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:2 }}>
          <Wifi size={Math.round(s * 0.42)} color={color} strokeWidth={2} />
        </div>
        <HealthBar pct={healthScore} w={s * 0.85} />
      </div>
    );
  }

  /* ── CLUSTER HEAD: diamond (rotated square) ──────────────────── */
  if (t === 'CLUSTER') {
    const s = Math.round(size * 1.4);
    const color = isAlert ? alertColor : '#3b82f6';
    return (
      <div style={{ position:'relative', width:s, height:s, cursor:'pointer' }}>
        <style>{ANIM}</style>
        {isAlert && (
          <div style={{ position:'absolute', inset:-3, borderRadius:5, background:color, opacity:.3, animation:'pulse-ring 1.4s infinite', transform:'rotate(45deg)' }} />
        )}
        <div style={{ width:s, height:s, borderRadius:5, background:`${color}18`, border:`2px solid ${color}`, boxShadow:`0 0 12px ${color}45`, transform:'rotate(45deg)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:2 }}>
          <div style={{ transform:'rotate(-45deg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Network size={Math.round(s * 0.48)} color={color} strokeWidth={2} />
          </div>
        </div>
        <HealthBar pct={healthScore} w={s * 0.85} />
      </div>
    );
  }

  /* ── SENSOR: small circle ────────────────────────────────────── */
  const color = isAlert ? alertColor : healthScore >= 70 ? '#22d3ee' : healthScore >= 40 ? '#f59e0b' : '#64748b';
  return (
    <div style={{ position:'relative', width:size, height:size, cursor:'pointer' }}>
      <style>{ANIM}</style>
      {isAlert && (
        <div style={{ position:'absolute', inset:-3, borderRadius:'50%', background:color, opacity:.4, animation:'pulse-ring 1.2s infinite' }} />
      )}
      <div style={{ width:size, height:size, borderRadius:'50%', background:`${color}20`, border:`2px solid ${color}`, boxShadow:`0 0 7px ${color}50`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:2 }}>
        <Radio size={Math.round(size * 0.52)} color={color} strokeWidth={2.5} />
      </div>
      <HealthBar pct={healthScore} w={size * 0.9} />
    </div>
  );
}
