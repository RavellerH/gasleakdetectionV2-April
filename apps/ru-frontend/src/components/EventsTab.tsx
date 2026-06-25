'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Download, FileText,
  Filter, LogIn, Search, Shield, Wifi, WifiOff, X, ClipboardCheck,
} from 'lucide-react';
import { fetchEventLogs, acknowledgeEvent, createEventLog, type EventLog, type User } from '@/lib/graphql';

interface Props {
  currentUser: User;
  activeRU: string;
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  THRESHOLD_BREACH: { label: 'Threshold Breach', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  DEVICE_OFFLINE:   { label: 'Device Offline',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  DEVICE_ONLINE:    { label: 'Device Online',     color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
  LOGIN:            { label: 'Login',              color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  LOGOUT:           { label: 'Logout',             color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  ACK:              { label: 'Acknowledgement',    color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
};

const SEV_META: Record<string, { color: string }> = {
  CRITICAL: { color: '#ef4444' },
  WARNING:  { color: '#f59e0b' },
  INFO:     { color: '#38bdf8' },
};

function TypeBadge({ type }: { type: string }) {
  const m = TYPE_META[type] || { label: type, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: m.color, background: m.bg, padding: '2px 8px', borderRadius: 20, fontFamily: "'Geist Mono', monospace", whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function SevDot({ severity }: { severity: string }) {
  const c = (SEV_META[severity] || SEV_META['INFO']).color;
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />;
}

function fmtTs(ts: string): { date: string; time: string } {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

function relTime(ts: string): string {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 0 || isNaN(m)) return 'just now';
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function generateReportHTML(events: EventLog[], user: User, ruId: string): string {
  const now = new Date().toLocaleString('en-GB');
  const counts = events.reduce<Record<string, number>>((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {});
  const unacked = events.filter(e => !e.acknowledged).length;

  const rows = events.map(e => `
    <tr>
      <td>${new Date(e.timestamp).toLocaleString('en-GB')}</td>
      <td><span class="badge ${e.type.toLowerCase()}">${TYPE_META[e.type]?.label || e.type}</span></td>
      <td style="color:${(SEV_META[e.severity] || SEV_META['INFO']).color};font-weight:700">${e.severity}</td>
      <td>${e.ruId || '—'}</td>
      <td style="max-width:260px;word-wrap:break-word">${e.message}</td>
      <td style="color:${e.acknowledged ? '#16a34a' : '#94a3b8'};font-weight:700">${e.acknowledged ? '✓ YES' : '—'}</td>
      <td>${e.acknowledgedBy || '—'}</td>
      <td style="max-width:180px;word-wrap:break-word;font-style:italic;color:#64748b">${e.ackNote || '—'}</td>
    </tr>
  `).join('');

  const summary = Object.entries(counts).map(([k, v]) =>
    `<span class="chip">${TYPE_META[k]?.label || k}: <strong>${v}</strong></span>`
  ).join(' ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GASGUARD v2.1 — Event Log Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 32px; font-size: 12px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #0284c7; }
    .header h1 { font-size: 20px; color: #0284c7; letter-spacing: -0.5px; }
    .header .sub { font-size: 11px; color: #64748b; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
    .meta-card .val { font-size: 22px; font-weight: 700; color: #0f172a; }
    .meta-card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    .summary { margin-bottom: 18px; display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 20px; padding: 3px 10px; font-size: 11px; color: #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th { background: #0284c7; color: #fff; padding: 9px 10px; text-align: left; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .badge { padding: 2px 7px; border-radius: 20px; font-size: 10px; font-weight: 700; background: #e2e8f0; color: #334155; }
    .badge.threshold_breach { background: #fee2e2; color: #dc2626; }
    .badge.device_offline   { background: #fef3c7; color: #d97706; }
    .badge.device_online    { background: #dbeafe; color: #1d4ed8; }
    .badge.login            { background: #dbeafe; color: #2563eb; }
    .badge.ack              { background: #d1fae5; color: #059669; }
    .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>GASGUARD v2.1 — Event Log Report</h1>
      <div class="sub">Exported by ${user.email} &nbsp;|&nbsp; Site: ${ruId === 'ALL' ? 'All Sites' : ruId} &nbsp;|&nbsp; Generated: ${now}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#94a3b8">RESTRICTED — AUDIT USE ONLY</div>
  </div>

  <div class="meta-grid">
    <div class="meta-card"><div class="val">${events.length}</div><div class="lbl">Total Events</div></div>
    <div class="meta-card"><div class="val" style="color:#ef4444">${unacked}</div><div class="lbl">Unacknowledged</div></div>
    <div class="meta-card"><div class="val" style="color:#16a34a">${events.length - unacked}</div><div class="lbl">Acknowledged</div></div>
  </div>

  <div class="summary">${summary}</div>

  <table>
    <thead>
      <tr>
        <th style="width:130px">Timestamp</th>
        <th>Type</th>
        <th style="width:70px">Severity</th>
        <th style="width:50px">RU</th>
        <th>Message</th>
        <th style="width:55px">Acked</th>
        <th style="width:110px">Acked By</th>
        <th>Operator Note</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">GASGUARD v2.1 Operational Control Portal &nbsp;·&nbsp; This report is system-generated and may be used for audit, compliance, and RCA purposes.</div>
</body>
</html>`;
}

export function EventsTab({ currentUser, activeRU }: Props) {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterType, setFilterType] = useState('ALL');
  const [filterAck, setFilterAck] = useState<'all' | 'unacked' | 'acked'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [ackTarget, setAckTarget] = useState<EventLog | null>(null);
  const [ackNote, setAckNote] = useState('');
  const [ackError, setAckError] = useState('');
  const [ackSubmitting, setAckSubmitting] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEventLogs({ ruId: activeRU !== 'ALL' ? activeRU : undefined, limit: 500 });
      setEvents(data);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [activeRU]);

  useEffect(() => {
    loadEvents();
    const id = setInterval(loadEvents, 20000);
    return () => clearInterval(id);
  }, [loadEvents]);

  const filtered = useMemo(() => {
    let ev = events;
    if (filterType !== 'ALL') ev = ev.filter(e => e.type === filterType);
    if (filterAck === 'unacked') ev = ev.filter(e => !e.acknowledged);
    if (filterAck === 'acked')   ev = ev.filter(e => e.acknowledged);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      ev = ev.filter(e =>
        e.message.toLowerCase().includes(s) ||
        (e.ruId || '').toLowerCase().includes(s) ||
        (e.operatorEmail || '').toLowerCase().includes(s)
      );
    }
    return ev;
  }, [events, filterType, filterAck, searchTerm]);

  const handleAckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackNote.trim()) { setAckError('Operator note is required'); return; }
    if (!ackTarget) return;
    setAckSubmitting(true); setAckError('');
    try {
      await acknowledgeEvent(ackTarget.id, ackNote, currentUser.id, currentUser.email);
      setAckTarget(null); setAckNote('');
      loadEvents();
    } catch { setAckError('Failed to acknowledge. Try again.'); }
    finally { setAckSubmitting(false); }
  };

  const exportCSV = () => {
    const headers = ['Timestamp', 'Type', 'Severity', 'RU', 'Message', 'Acknowledged', 'Acknowledged By', 'Ack Note'];
    const rows = filtered.map(e => [
      new Date(e.timestamp).toISOString(),
      e.type,
      e.severity,
      e.ruId || '',
      `"${e.message.replace(/"/g, '""')}"`,
      e.acknowledged ? 'YES' : 'NO',
      e.acknowledgedBy || '',
      e.ackNote ? `"${e.ackNote.replace(/"/g, '""')}"` : '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gasguard-events-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(generateReportHTML(filtered, currentUser, activeRU));
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const unackedCount = events.filter(e => !e.acknowledged).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.4s ease' }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)' }}>Event Log</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace", marginTop: 2 }}>
            {events.length} total &nbsp;·&nbsp;
            <span style={{ color: unackedCount > 0 ? '#f59e0b' : 'var(--t4)' }}>{unackedCount} unacknowledged</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 9, cursor: 'pointer', color: 'var(--t2)', fontSize: 12, fontWeight: 600 }}
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={exportPDF}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 9, cursor: 'pointer', color: '#38bdf8', fontSize: 12, fontWeight: 600 }}
          >
            <FileText size={13} /> Export PDF
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 14px' }}>
        <Filter size={13} color="var(--t4)" />

        {/* Type filter */}
        {['ALL', ...Object.keys(TYPE_META)].map(t => (
          <button key={t}
            onClick={() => setFilterType(t)}
            style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: filterType === t ? 700 : 400, cursor: 'pointer', background: filterType === t ? 'rgba(56,189,248,0.12)' : 'transparent', border: filterType === t ? '1px solid rgba(56,189,248,0.3)' : '1px solid var(--card-border)', color: filterType === t ? '#38bdf8' : 'var(--t3)', fontFamily: "'Geist Mono', monospace", transition: 'all 0.12s' }}>
            {t === 'ALL' ? 'All Types' : (TYPE_META[t]?.label || t)}
          </button>
        ))}

        <div style={{ width: 1, height: 18, background: 'var(--divider)', margin: '0 4px' }} />

        {/* Ack status */}
        {(['all', 'unacked', 'acked'] as const).map(v => (
          <button key={v}
            onClick={() => setFilterAck(v)}
            style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: filterAck === v ? 700 : 400, cursor: 'pointer', background: filterAck === v ? 'rgba(56,189,248,0.12)' : 'transparent', border: filterAck === v ? '1px solid rgba(56,189,248,0.3)' : '1px solid var(--card-border)', color: filterAck === v ? '#38bdf8' : 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>
            {v === 'all' ? 'All Status' : v === 'unacked' ? 'Unacked' : 'Acked'}
          </button>
        ))}

        {/* Search */}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t4)' }} />
          <input
            placeholder="Search events…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 10px 6px 28px', color: 'var(--t1)', fontSize: 12, outline: 'none', width: 180 }}
          />
        </div>
      </div>

      {/* Events table */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden' }}>
        {loading && filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--t4)', fontSize: 12, fontFamily: "'Geist Mono', monospace" }}>
            LOADING EVENTS…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Shield size={36} color="var(--t4)" style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: 13, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>NO EVENTS MATCH FILTERS</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--sidebar-bg)', zIndex: 10 }}>
                <tr>
                  {['Timestamp', 'Type', 'Sev', 'RU', 'Message', 'Operator', 'Status', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 10, color: 'var(--t4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'Geist Mono', monospace", borderBottom: '1px solid var(--card-border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ev, i) => (
                  <tr key={ev.id}
                    style={{ borderBottom: '1px solid var(--divider)', background: ev.acknowledged ? 'transparent' : 'rgba(245,158,11,0.015)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(56,189,248,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ev.acknowledged ? 'transparent' : 'rgba(245,158,11,0.015)'}
                  >
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      {(() => { const { date, time } = fmtTs(ev.timestamp); return (
                        <>
                          <div style={{ fontSize: 11, color: 'var(--t2)', fontFamily: "'Geist Mono', monospace", lineHeight: 1.3 }}>{date}</div>
                          <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace", lineHeight: 1.3 }}>{time}</div>
                          <div style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace", marginTop: 1 }}>{relTime(ev.timestamp)}</div>
                        </>
                      ); })()}
                    </td>
                    <td style={{ padding: '11px 14px' }}><TypeBadge type={ev.type} /></td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <SevDot severity={ev.severity} />
                        <span style={{ fontSize: 10, color: (SEV_META[ev.severity] || SEV_META['INFO']).color, fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>{ev.severity}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, color: '#38bdf8', fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>{ev.ruId || '—'}</span>
                    </td>
                    <td style={{ padding: '11px 14px', maxWidth: 320 }}>
                      <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.4 }}>{ev.message}</div>
                      {ev.ackNote && (
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4, fontStyle: 'italic' }}>
                          Note: {ev.ackNote}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>
                        {ev.operatorEmail || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {ev.acknowledged ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#34d399', fontWeight: 700, fontFamily: "'Geist Mono', monospace" }}>
                          <CheckCircle2 size={12} /> ACKED
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#f59e0b', fontWeight: 700, fontFamily: "'Geist Mono', monospace" }}>
                          <Clock size={12} /> OPEN
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {!ev.acknowledged && ev.type !== 'ACK' && ev.type !== 'LOGIN' && ev.type !== 'LOGOUT' && (
                        <button
                          onClick={() => { setAckTarget(ev); setAckNote(''); setAckError(''); }}
                          style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <ClipboardCheck size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ack modal */}
      {ackTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--card-border)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>Acknowledge Event</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace", marginTop: 3 }}>Operator note required for audit trail</div>
              </div>
              <button onClick={() => setAckTarget(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t4)', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>

            {/* Event summary */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <TypeBadge type={ackTarget.type} />
                <SevDot severity={ackTarget.severity} />
                <span style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>{new Date(ackTarget.timestamp).toLocaleString('en-GB')}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>{ackTarget.message}</div>
            </div>

            <form onSubmit={handleAckSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                  Operator Note <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  autoFocus
                  placeholder="Describe the action taken, root cause, or resolution…"
                  value={ackNote}
                  onChange={e => setAckNote(e.target.value)}
                  rows={4}
                  style={{ width: '100%', background: 'var(--input-bg)', border: `1px solid ${ackError ? '#ef4444' : 'var(--card-border)'}`, borderRadius: 10, padding: '10px 14px', color: 'var(--t1)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
                />
                {ackError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{ackError}</div>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>
                Acknowledging as: <span style={{ color: '#38bdf8' }}>{currentUser.email}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setAckTarget(null)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--t3)', borderRadius: 10, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={ackSubmitting}
                  style={{ flex: 1, background: 'linear-gradient(135deg,#0369a1,#0284c7)', border: 'none', color: '#fff', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: ackSubmitting ? 0.7 : 1 }}>
                  {ackSubmitting ? 'Saving…' : 'Confirm Acknowledgement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
