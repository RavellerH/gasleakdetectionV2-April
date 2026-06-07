'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { TrendingUp, Thermometer, Zap, Wifi, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchAnalytics, type AnalyticsStats } from '@/lib/graphql';

interface Props { activeRU: string; warningThreshold?: number; criticalThreshold?: number; }

const RU_COLORS: Record<string, string> = {
  RU2: '#38bdf8', RU3: '#34d399', RU4: '#f59e0b',
  RU5: '#a78bfa', RU6: '#fb7185', RU7: '#22d3ee',
};

const CHART_TOOLTIP_STYLE = {
  background: 'var(--sidebar-bg)', border: '1px solid var(--card-border)',
  borderRadius: 8, fontSize: 11, color: 'var(--t2)',
  fontFamily: "'Geist Mono', monospace",
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--card-border)', color: 'var(--t1)', fontWeight: 700 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ padding: '4px 10px', color: p.color || 'var(--t2)' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px 22px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: sub ? 2 : 14 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace", marginBottom: 14 }}>{sub}</div>}
      {children}
    </div>
  );
}

function ppmColor(ppm: number, warning: number, critical: number): string {
  if (ppm === 0) return 'rgba(56,189,248,0.06)';
  if (ppm >= critical) return 'rgba(239,68,68,0.75)';
  if (ppm >= warning) return 'rgba(245,158,11,0.65)';
  const r = ppm / warning;
  return `rgba(56,189,248,${0.1 + r * 0.45})`;
}

function ppmTextColor(ppm: number, warning: number, critical: number): string {
  if (ppm >= critical) return '#ef4444';
  if (ppm >= warning) return '#f59e0b';
  return 'var(--t4)';
}

export function AnalyticsTab({ activeRU, warningThreshold = 50, criticalThreshold = 80 }: Props) {
  const [data, setData] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState<24 | 168>(24);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAnalytics({
        ruId: activeRU !== 'ALL' ? activeRU : undefined,
        hours,
      });
      setData(result);
    } catch (e) { console.error('[Analytics] fetch error', e); }
    finally { setLoading(false); }
  }, [activeRU, hours]);

  useEffect(() => { load(); }, [load]);

  const ruIds = data ? Array.from(new Set(data.ruComparison.map(r => r.ruId))).sort() : [];

  // Heatmap: group by ruId → array of 24 cells
  const heatmapByRu: Record<string, number[]> = {};
  if (data) {
    for (const cell of data.heatmap) {
      if (!heatmapByRu[cell.ruId]) heatmapByRu[cell.ruId] = Array(24).fill(0);
      heatmapByRu[cell.ruId][cell.hour] = cell.avgPpm;
    }
  }

  const maxBattery = data ? Math.max(...data.fleetHealth.batteryDist.map(b => b.count), 1) : 1;
  const maxNetwork = data ? Math.max(...data.fleetHealth.networkDist.map(n => n.count), 1) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.4s ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)' }}>Analytics</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace", marginTop: 2 }}>
            {activeRU === 'ALL' ? 'All Refinery Units' : activeRU} &nbsp;·&nbsp; {hours === 24 ? 'Last 24 hours' : 'Last 7 days'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Time range toggle */}
          <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden' }}>
            {([24, 168] as const).map(h => (
              <button key={h}
                onClick={() => setHours(h)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: hours === h ? 700 : 400, cursor: 'pointer', border: 'none', background: hours === h ? 'rgba(56,189,248,0.15)' : 'transparent', color: hours === h ? '#38bdf8' : 'var(--t3)', fontFamily: "'Geist Mono', monospace", transition: 'all 0.12s' }}>
                {h === 24 ? '24H' : '7D'}
              </button>
            ))}
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 9, cursor: 'pointer', color: 'var(--t3)', fontSize: 12 }}>
            <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
          </button>
        </div>
      </div>

      {/* Row 1: Trend charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SectionCard title="Gas Concentration Trend" sub={`Average PPM across sensors · ${hours === 24 ? 'hourly' : 'daily'}`}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data?.trendData || []}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--t4)', fontSize: 10, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} interval={hours === 24 ? 3 : 0} />
              <YAxis tick={{ fill: 'var(--t4)', fontSize: 10, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={warningThreshold} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1} />
              <ReferenceLine y={criticalThreshold} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1} />
              <Area type="monotone" dataKey="avgPpm" stroke="#38bdf8" strokeWidth={2} fill="url(#aGrad)" name="Avg PPM" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#f59e0b', fontFamily: "'Geist Mono', monospace" }}>
              <div style={{ width: 16, height: 1, borderTop: '1px dashed #f59e0b' }} /> Warning {warningThreshold} ppm
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#ef4444', fontFamily: "'Geist Mono', monospace" }}>
              <div style={{ width: 16, height: 1, borderTop: '1px dashed #ef4444' }} /> Critical {criticalThreshold} ppm
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Threshold Breaches" sub={`Count of readings exceeding warning threshold · ${hours === 24 ? 'hourly' : 'daily'}`}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.trendData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--t4)', fontSize: 10, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} interval={hours === 24 ? 3 : 0} />
              <YAxis tick={{ fill: 'var(--t4)', fontSize: 10, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="breachCount" radius={[4, 4, 0, 0]} name="Breaches">
                {(data?.trendData || []).map((d, i) => (
                  <Cell key={i} fill={d.breachCount > 0 ? '#f59e0b' : 'rgba(56,189,248,0.2)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace", marginTop: 8 }}>
            Total: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{data?.trendData.reduce((s, t) => s + t.breachCount, 0) ?? 0}</span> breaches in period
          </div>
        </SectionCard>
      </div>

      {/* Row 2: RU Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SectionCard title="Avg Gas Level per RU" sub={`Mean PPM per refinery unit · ${hours === 24 ? '24h' : '7d'}`}>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={data?.ruComparison || []} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--t4)', fontSize: 10, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="ruId" tick={{ fill: 'var(--t2)', fontSize: 11, fontFamily: "'Geist Mono', monospace", fontWeight: 700 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine x={warningThreshold} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
              <Bar dataKey="avgPpm" radius={[0, 4, 4, 0]} name="Avg PPM" maxBarSize={18}>
                {(data?.ruComparison || []).map((r) => (
                  <Cell key={r.ruId} fill={
                    r.avgPpm >= criticalThreshold ? '#ef4444' :
                    r.avgPpm >= warningThreshold ? '#f59e0b' :
                    (RU_COLORS[r.ruId] || '#38bdf8')
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Breach Count per RU" sub={`Readings exceeding warning threshold · ${hours === 24 ? '24h' : '7d'}`}>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={data?.ruComparison || []} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--t4)', fontSize: 10, fontFamily: "'Geist Mono', monospace" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="ruId" tick={{ fill: 'var(--t2)', fontSize: 11, fontFamily: "'Geist Mono', monospace", fontWeight: 700 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="breachCount" radius={[0, 4, 4, 0]} name="Breaches" maxBarSize={18}>
                {(data?.ruComparison || []).map((r, i) => (
                  <Cell key={r.ruId} fill={r.breachCount > 0 ? '#f59e0b' : 'rgba(56,189,248,0.2)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Row 3: Heatmap */}
      <SectionCard title="Gas Level Heatmap" sub="Average PPM by hour of day × refinery unit (7-day window)">
        <div style={{ overflowX: 'auto' }}>
          {/* Hour labels */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2, marginBottom: 4 }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ fontSize: 9, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace", textAlign: 'center' }}>
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Grid rows by RU */}
          {ruIds.map(ru => {
            const cells = heatmapByRu[ru] || Array(24).fill(0);
            const isActive = activeRU === 'ALL' || activeRU === ru;
            return (
              <div key={ru} style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2, marginBottom: 2, opacity: isActive ? 1 : 0.35 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: RU_COLORS[ru] || '#38bdf8', fontFamily: "'Geist Mono', monospace", display: 'flex', alignItems: 'center', paddingRight: 4 }}>
                  {ru}
                </div>
                {cells.map((ppm, h) => (
                  <div key={h}
                    title={`${ru} @ ${String(h).padStart(2, '0')}:00 — ${ppm.toFixed(1)} ppm`}
                    style={{
                      height: 22, borderRadius: 3,
                      background: ppmColor(ppm, warningThreshold, criticalThreshold),
                      border: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'default',
                    }}
                  />
                ))}
              </div>
            );
          })}

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 10, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>
            <span>Low</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((r, i) => {
                const ppm = i === 5 ? criticalThreshold + 1 : r * criticalThreshold;
                return <div key={i} style={{ width: 18, height: 10, borderRadius: 2, background: ppmColor(ppm, warningThreshold, criticalThreshold) }} />;
              })}
            </div>
            <span>High</span>
            <div style={{ marginLeft: 8, display: 'flex', gap: 10 }}>
              <span style={{ color: '#f59e0b' }}>▪ Warning ≥{warningThreshold} ppm</span>
              <span style={{ color: '#ef4444' }}>▪ Critical ≥{criticalThreshold} ppm</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Row 4: Top sensors + Fleet health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Top risky sensors */}
        <SectionCard title="Top Risky Sensors" sub={`Ranked by avg PPM · ${hours === 24 ? 'last 24h' : 'last 7d'}`}>
          {(!data || data.topSensors.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t4)', fontSize: 12, fontFamily: "'Geist Mono', monospace" }}>
              No sensor data for this period
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 50px', gap: 6, padding: '0 0 8px', borderBottom: '1px solid var(--divider)' }}>
                {['Sensor', 'Avg PPM', 'Max PPM', 'Breaches'].map(h => (
                  <div key={h} style={{ fontSize: 9, color: 'var(--t4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'Geist Mono', monospace" }}>{h}</div>
                ))}
              </div>
              {data.topSensors.slice(0, 10).map((s, i) => (
                <div key={s.deviceId} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 50px', gap: 6, padding: '7px 0', borderBottom: '1px solid var(--divider)', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: i < 3 ? 700 : 400 }}>{s.deviceName}</div>
                    <div style={{ fontSize: 10, color: RU_COLORS[s.ruId] || '#38bdf8', fontFamily: "'Geist Mono', monospace" }}>{s.ruId}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ppmTextColor(s.avgPpm, warningThreshold, criticalThreshold), fontFamily: "'Geist Mono', monospace" }}>
                    {s.avgPpm.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 11, color: ppmTextColor(s.maxPpm, warningThreshold, criticalThreshold), fontFamily: "'Geist Mono', monospace" }}>
                    {s.maxPpm.toFixed(1)}
                  </div>
                  <div>
                    {s.breachCount > 0 ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '2px 6px', borderRadius: 5, fontFamily: "'Geist Mono', monospace" }}>
                        {s.breachCount}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Fleet health */}
        <SectionCard title="Fleet Health" sub="Current device status snapshot">
          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Online/Offline row */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#34d399' }}>{data.fleetHealth.online}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'Geist Mono', monospace", marginTop: 2 }}>Online</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{data.fleetHealth.offline}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'Geist Mono', monospace", marginTop: 2 }}>Offline</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#38bdf8' }}>{data.fleetHealth.total}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'Geist Mono', monospace", marginTop: 2 }}>Total</div>
                </div>
              </div>

              {/* Battery distribution */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--t2)' }}>
                  <Zap size={12} color="#f59e0b" /> Battery Distribution
                </div>
                {data.fleetHealth.batteryDist.map(b => (
                  <div key={b.range} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 28px', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>{b.range}</span>
                    <div style={{ height: 5, background: 'var(--card-border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${maxBattery > 0 ? (b.count / maxBattery) * 100 : 0}%`, height: '100%', background: b.range.startsWith('75') ? '#34d399' : b.range.startsWith('50') ? '#38bdf8' : b.range.startsWith('25') ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace", textAlign: 'right' }}>{b.count}</span>
                  </div>
                ))}
              </div>

              {/* Network quality */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--t2)' }}>
                  <Wifi size={12} color="#38bdf8" /> Network Quality
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {data.fleetHealth.networkDist.map(n => {
                    const gradeColor = { A: '#34d399', B: '#38bdf8', C: '#f59e0b', D: '#ef4444' }[n.grade] || '#94a3b8';
                    return (
                      <div key={n.grade} style={{ flex: 1, background: `${gradeColor}12`, border: `1px solid ${gradeColor}30`, borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: gradeColor, fontFamily: "'Geist Mono', monospace" }}>{n.grade}</div>
                        <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{n.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </SectionCard>

      </div>

      {loading && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--sidebar-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '8px 14px', fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>
          LOADING ANALYTICS…
        </div>
      )}
    </div>
  );
}
