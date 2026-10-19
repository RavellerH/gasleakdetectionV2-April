'use client';

import type { Device } from '@/lib/graphql';

/* Offline schematic of the RU site: every device placed from its own lat/lng,
   mesh links from parentMac, and the alarming device highlighted. Used where an
   alarm is shown so the operator sees where it is without opening the map. */
export function MiniLocationMap({ devices, focusMac, width = 220, height = 132 }: {
  devices: Device[];
  focusMac?: string | null;
  width?: number;
  height?: number;
}) {
  const pts = devices.filter(d => d.location && (d.location.lat !== 0 || d.location.lng !== 0));
  if (pts.length === 0) return null;
  const pad = 18;
  const lats = pts.map(d => d.location.lat), lngs = pts.map(d => d.location.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  // keep the site's real aspect ratio (1° lat ≈ 1° lng near the equator)
  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.0005);
  const scale = Math.min(width - pad * 2, height - pad * 2) / span;
  const cx = (minLng + maxLng) / 2, cy = (minLat + maxLat) / 2;
  const xy = (d: Device): [number, number] => [width / 2 + (d.location.lng - cx) * scale, height / 2 - (d.location.lat - cy) * scale];
  const byMac = Object.fromEntries(pts.map(d => [d.macAddress, d]));
  const focus = focusMac ? byMac[focusMac] : undefined;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={focus ? `Lokasi ${focus.name}` : 'Lokasi perangkat'}
      style={{ display: 'block', background: 'var(--input-bg)', borderRadius: 10, border: '1px solid var(--card-border)', flexShrink: 0 }}>
      <style>{`@keyframes mlm-ping { 0% { r: 7; opacity: .8 } 100% { r: 20; opacity: 0 } } .mlm-ping { animation: mlm-ping 1.4s ease-out infinite } @media (prefers-reduced-motion: reduce) { .mlm-ping { animation: none } }`}</style>
      {pts.map(d => {
        const p = d.parentMac ? byMac[d.parentMac] : undefined;
        if (!p) return null;
        const [x1, y1] = xy(d), [x2, y2] = xy(p);
        return <line key={`l-${d.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--t4)" strokeOpacity={0.45} strokeWidth={1} />;
      })}
      {pts.filter(d => d.macAddress !== focusMac).map(d => {
        const [x, y] = xy(d);
        const offline = d.status !== 'ONLINE';
        const fill = offline ? 'var(--t4)' : d.type === 'GATEWAY' ? 'var(--accent)' : d.type === 'SENSOR' ? 'var(--green)' : 'var(--t3)';
        return d.type === 'SENSOR'
          ? <rect key={d.id} x={x - 3.5} y={y - 3.5} width={7} height={7} rx={1.5} fill={fill} />
          : <circle key={d.id} cx={x} cy={y} r={d.type === 'GATEWAY' ? 5 : 3.5} fill={fill} />;
      })}
      {focus && (() => {
        const [x, y] = xy(focus);
        const labelLeft = x > width * 0.6;
        return (
          <g>
            <circle className="mlm-ping" cx={x} cy={y} r={7} fill="none" stroke="#E3242B" strokeWidth={2} />
            <rect x={x - 6} y={y - 6} width={12} height={12} rx={2.5} fill="#E3242B" stroke="#fff" strokeWidth={1.5} />
            <text x={labelLeft ? x - 11 : x + 11} y={y + 4} textAnchor={labelLeft ? 'end' : 'start'} fontSize={10} fontWeight={700}
              fill="#E3242B" fontFamily="'Geist Mono', monospace">{focus.macAddress}</text>
          </g>
        );
      })()}
      <text x={6} y={height - 6} fontSize={8} fill="var(--t4)" fontFamily="'Geist Mono', monospace">skematis · N↑</text>
    </svg>
  );
}

/* "SRU perimeter · -7.72020, 108.98930 · via CH 0x0012" */
export function locationText(d: Device | undefined): string {
  if (!d) return 'Lokasi tidak diketahui';
  const parts = [d.area || 'Area belum diisi'];
  if (d.location && (d.location.lat !== 0 || d.location.lng !== 0)) parts.push(`${d.location.lat.toFixed(5)}, ${d.location.lng.toFixed(5)}`);
  if (d.parentMac) parts.push(`via ${d.parentMac}`);
  return parts.join(' · ');
}
