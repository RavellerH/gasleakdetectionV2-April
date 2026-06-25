'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import {
  Activity, AlertTriangle, ChevronLeft, ChevronRight, ClipboardList,
  Clock, Flame, HardDrive, LayoutDashboard, Map as MapIcon, Moon,
  RefreshCw, Search, Settings, Shield, Sun, TrendingDown,
  TrendingUp, Wifi, Network, Radio, LogOut, Filter,
  MoreHorizontal, Download, RotateCcw,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  fetchDevices, fetchDashboardStats, fetchSettings, updateSettings,
  fetchUsers, createUser, deleteUser, login,
  updateDeviceName, fetchSensorTimeline, createEventLog,
  type Device, type DashboardStats, type SystemSettings,
  type User, type Alert, type SensorTimeline,
} from '@/lib/graphql';
import { SensorListPanel } from './SensorListPanel';
import { UnitLayoutMap } from './UnitLayoutMap';
import { EventsTab } from './EventsTab';
import { AnalyticsTab } from './AnalyticsTab';

const DeviceMap = dynamic(() => import('./DeviceMap').then((m) => m.DeviceMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', color: 'var(--t3)', fontSize: 13, fontFamily: "'Geist Mono', monospace" }}>
      <RefreshCw size={18} style={{ marginRight: 10, animation: 'spin 1s linear infinite' }} />
      INITIALIZING MAP…
    </div>
  ),
});

/* This app is a single-RU child deployment: one instance runs per Refinery Unit,
   configured via NEXT_PUBLIC_RU_ID. It never sees other RUs' data. */
const RU_ID = (process.env.NEXT_PUBLIC_RU_ID || 'RU3').toUpperCase();

const NAV_GROUPS = [
  {
    label: 'GENERAL',
    items: [
      { icon: LayoutDashboard, label: 'Overview',    key: 'overview' },
      { icon: HardDrive,       label: 'Devices',     key: 'devices' },
      { icon: Network,         label: 'Unit Layout',  key: 'layout' },
      { icon: MapIcon,             label: 'Map View',     key: 'map' },
    ],
  },
  {
    label: 'MONITORING',
    items: [
      { icon: AlertTriangle,   label: 'Alerts',       key: 'alerts' },
      { icon: ClipboardList,   label: 'Events',       key: 'events' },
      { icon: TrendingUp,      label: 'Analytics',    key: 'analytics' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { icon: Settings,        label: 'Settings',     key: 'settings' },
    ],
  },
];
const NAV = NAV_GROUPS.flatMap(g => g.items);

const SENSOR_COLORS = ['#38bdf8','#3b82f6','#34d399','#f59e0b','#f472b6','#60a5fa','#fb923c','#4ade80','#e879f9','#22d3ee'];

/* ── tiny helpers ────────────────────────────────────────────── */
function statusColor(s: string) {
  return s === 'ONLINE' ? '#38bdf8' : s === 'OFFLINE' ? '#ef4444' : '#f59e0b';
}
function batteryColor(b: number | null) {
  return b === null ? '#3d5249' : b >= 60 ? '#38bdf8' : b >= 30 ? '#f59e0b' : '#ef4444';
}
function severityColor(s: string) {
  return s === 'CRITICAL' ? '#ef4444' : s === 'WARNING' ? '#f59e0b' : '#38bdf8';
}
function heatmapColor(conf: number | null, warning: number, critical: number): string {
  if (conf === null) return 'rgba(37,99,235,0.04)';
  if (conf >= critical) return 'rgba(239,68,68,0.75)';
  if (conf >= warning) return 'rgba(245,158,11,0.65)';
  const r = Math.min(conf / Math.max(warning, 0.01), 1);
  return `rgba(37,99,235,${0.08 + r * 0.50})`;
}
function typeIcon(t: string) {
  switch (t.toUpperCase()) {
    case 'GATEWAY': return Wifi;
    case 'CLUSTER': return Network;
    case 'SENSOR':  return Radio;
    default:        return Activity;
  }
}

function LiveClock() {
  const [t, setT] = useState('—:—:—');
  useEffect(() => {
    const upd = () => setT(new Date().toLocaleTimeString('en-GB'));
    upd();
    const id = setInterval(upd, 1000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--t3)' }}>{t} WIB</span>;
}

function Sparkline({ data, color = '#38bdf8' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const w = 80; const h = 28;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * w} cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
}

function TrendBadge({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const good = inverse ? value > 0 : value < 0;
  const color = good ? '#38bdf8' : '#ef4444';
  const bg = good ? 'rgba(37,99,235,0.12)' : 'rgba(239,68,68,0.12)';
  const Icon = value < 0 ? TrendingDown : TrendingUp;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color, background: bg, padding: '2px 7px', borderRadius: 20, fontFamily: "'Geist Mono', monospace" }}>
      <Icon size={10} /> {Math.abs(value)}%
    </span>
  );
}

function AnimNum({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    let s = 0; const step = Math.max(1, Math.floor(value / 30));
    const id = setInterval(() => { s += step; if (s >= value) { setD(value); clearInterval(id); } else setD(s); }, 20);
    return () => clearInterval(id);
  }, [value]);
  return <>{d}{suffix}</>;
}

function PulseDot({ color = '#38bdf8' }: { color?: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 7, height: 7 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, animation: 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite', opacity: 0.35 }} />
      <span style={{ position: 'absolute', inset: 1, borderRadius: '50%', background: color }} />
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 14 }}>{children}</div>;
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
export default function GasLeakDashboard() {
  /* auth */
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  /* nav — RU is fixed for this deployment, not switchable */
  const [tab, setTab] = useState('overview');
  const activeRU = RU_ID;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  /* data */
  const [apiDevices, setApiDevices] = useState<Device[]>([]);
  const [prevDeviceStatuses, setPrevDeviceStatuses] = useState<Record<string, string>>({});
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [localAlerts, setLocalAlerts] = useState<Alert[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sensorTimeline, setSensorTimeline] = useState<SensorTimeline[]>([]);
  const [backendReady, setBackendReady] = useState(false);
  const backendReadyRef = useRef(false);

  /* ui state */
  const [searchTerm, setSearchTerm] = useState('');
  const [activeType, setActiveType] = useState('ALL');
  const [sortCol, setSortCol] = useState('health');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: 'dev', ruId: RU_ID, role: 'ADMIN' });
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [deviceToRename, setDeviceToRename] = useState<Device | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');

  /* restore session */
  useEffect(() => {
    const stored = localStorage.getItem('gld_user');
    if (stored) { try { setCurrentUser(JSON.parse(stored)); } catch { localStorage.removeItem('gld_user'); } }
    setIsCheckingAuth(false);
  }, []);

  /* data fetching */
  const loadDashboardData = useCallback(async () => {
    try {
      const [s, settings, uList] = await Promise.all([fetchDashboardStats(), fetchSettings(), fetchUsers()]);
      setStats(s); setSysSettings(settings); setUsers(uList);
      if (s.recentAlerts) setLocalAlerts(s.recentAlerts);
      setLastUpdated(new Date());
      if (!backendReadyRef.current) { backendReadyRef.current = true; setBackendReady(true); }
    } catch (err) {
      console.error('[Dashboard] fetch error:', err);
      if (backendReadyRef.current) { backendReadyRef.current = false; setBackendReady(false); }
    }
  }, []);

  const loadDevices = useCallback(async (ruId: string) => {
    setDevicesLoading(true);
    try {
      const fresh: Device[] = await fetchDevices(ruId);
      // Detect status changes and create EventLog entries
      setPrevDeviceStatuses(prev => {
        if (Object.keys(prev).length > 0) {
          fresh.forEach(d => {
            const prevStatus = prev[d.id];
            if (prevStatus && prevStatus !== d.status) {
              const isOffline = d.status === 'OFFLINE';
              createEventLog({
                type: isOffline ? 'DEVICE_OFFLINE' : 'DEVICE_ONLINE',
                severity: isOffline ? 'WARNING' : 'INFO',
                deviceId: d.id,
                ruId: d.ruId,
                message: `${d.name} (${d.ruId}) changed status: ${prevStatus} → ${d.status}`,
                details: JSON.stringify({ macAddress: d.macAddress }),
              }).catch(() => {});
            }
          });
        }
        const next: Record<string, string> = {};
        fresh.forEach(d => { next[d.id] = d.status; });
        return next;
      });
      setApiDevices(fresh);
    } catch { setApiDevices([]); } finally { setDevicesLoading(false); }
  }, []);

  const loadSensorTimeline = useCallback(async (ruId: string) => {
    try {
      const tl = await fetchSensorTimeline(ruId);
      setSensorTimeline(tl);
    } catch { /* non-critical */ }
  }, []);

  /* fast probe: retry every 2s until backend responds */
  useEffect(() => {
    if (!currentUser || backendReady) return;
    loadDashboardData();
    const id = setInterval(loadDashboardData, 2000);
    return () => clearInterval(id);
  }, [currentUser, backendReady, loadDashboardData]);

  /* normal polling: every 10s once backend is up */
  useEffect(() => {
    if (!currentUser || !backendReady) return;
    const id = setInterval(loadDashboardData, 10000);
    return () => clearInterval(id);
  }, [currentUser, backendReady, loadDashboardData]);

  useEffect(() => { if (currentUser && backendReady) loadDevices(activeRU); }, [activeRU, loadDevices, currentUser, backendReady]);
  useEffect(() => { if (currentUser && backendReady) loadSensorTimeline(activeRU); }, [activeRU, loadSensorTimeline, currentUser, backendReady]);

  /* handlers */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoggingIn(true); setLoginError('');
    try {
      const res = await login(loginEmail);
      if (res.user) { setCurrentUser(res.user); localStorage.setItem('gld_user', JSON.stringify(res.user)); }
      else { setLoginError(res.error || 'No account found for that email'); }
    } catch { setLoginError('Server connection failed'); }
    finally { setIsLoggingIn(false); }
  };

  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('gld_user'); setLoginEmail(''); };

  const handleUpdateSettings = async (updates: Partial<SystemSettings>) => {
    setIsSaving(true);
    try { const u = await updateSettings(updates); setSysSettings(u); loadDashboardData(); }
    catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true);
    try { await createUser(newUser, currentUser!.id); setShowAddUser(false); setNewUser({ email: '', name: '', password: 'dev', ruId: RU_ID, role: 'ADMIN' }); loadDashboardData(); }
    catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    try { await deleteUser(id); loadDashboardData(); } catch (err) { console.error(err); }
  };

  const handleUpdateDeviceName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceToRename || !newDeviceName.trim()) return;
    setIsSaving(true);
    try { await updateDeviceName(deviceToRename.id, newDeviceName.trim()); setShowRenameModal(false); setDeviceToRename(null); setNewDeviceName(''); loadDevices(activeRU); }
    catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleUpdateAlertStatus = (alertId: string, status: string) =>
    setLocalAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status } : a));

  /* derived — all respond to activeRU filter */
  const displayDevices  = apiDevices; // already scoped to activeRU by loadDevices
  const totalDevices    = displayDevices.length > 0 ? displayDevices.length : (stats?.totalDevices || 0);
  const onlineDevices   = displayDevices.length > 0
    ? displayDevices.filter(d => d.status === 'ONLINE').length
    : (stats?.onlineDevices || 0);
  const avgHealth       = displayDevices.length > 0
    ? Math.round(displayDevices.reduce((s, d) => s + d.healthScore, 0) / displayDevices.length)
    : (stats?.avgHealth || 0);
  const avgBattery      = displayDevices.length > 0
    ? Math.round(displayDevices.reduce((s, d) => s + d.battery.soc, 0) / displayDevices.length)
    : 78;
  const filteredAlerts  = localAlerts.filter(a => a.ru === activeRU);
  const totalAlerts     = filteredAlerts.length;
  const ruData          = (stats?.ruData || []).filter(r => r.ru === activeRU);
  const timelineData    = stats?.timelineData   || [];
  const recentAlerts    = filteredAlerts;
  const networkQuality  = stats?.networkQuality || [];
  const mapRu           = activeRU;
  // sidebar notification badge still shows global count
  const globalAlertCount = localAlerts.length;

  const filteredDevices = apiDevices
    .filter(d => {
      if (activeType !== 'ALL' && d.type !== activeType) return false;
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return d.name.toLowerCase().includes(s) || d.id.toLowerCase().includes(s) || d.ruId.toLowerCase().includes(s);
    })
    .sort((a, b) => {
      const v = sortDir === 'asc' ? 1 : -1;
      if (sortCol === 'health')   return (a.healthScore - b.healthScore) * v;
      if (sortCol === 'battery')  return (a.battery.soc - b.battery.soc) * v;
      if (sortCol === 'rssi')     return (a.network.rssi - b.network.rssi) * v;
      return 0;
    });

  const minutesSinceUpdate = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 60000) : null;

  /* ── LOADING ── */
  if (isCheckingAuth) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <RefreshCw size={24} style={{ color: 'var(--green)', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  /* ── LOGIN ── */
  if (!currentUser) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* Syner-style glow */}
      <div style={{ position: 'fixed', top: -200, right: -200, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 380, padding: 36, background: 'var(--card-bg)', backdropFilter: 'blur(24px)', border: '1px solid var(--card-border)', borderRadius: 20, zIndex: 10, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Flame size={22} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', letterSpacing: -0.3 }}>GASGUARD v2.1</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4, fontFamily: "'Geist Mono', monospace" }}>OPERATIONAL CONTROL PORTAL</div>
        </div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loginError && (
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{loginError}</div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Email Address</label>
            <input
              type="email" placeholder="admin@gld.com" value={loginEmail} required
              onChange={e => setLoginEmail(e.target.value)}
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 14px', color: 'var(--t1)', fontSize: 14, outline: 'none' }}
            />
          </div>
          <button type="submit" disabled={isLoggingIn} style={{ width: '100%', padding: 12, borderRadius: 10, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 6, opacity: isLoggingIn ? 0.7 : 1 }}>
            {isLoggingIn ? 'AUTHENTICATING…' : 'ACCESS CONTROL PANEL'}
          </button>
        </form>
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>RESTRICTED ACCESS — SYSTEM LOGS ACTIVE</div>
      </div>
    </div>
  );

  /* ── DASHBOARD ── */
  const S = {
    sidebar: {
      width: sidebarCollapsed ? 64 : 220,
      bg: 'var(--sidebar-bg)',
      border: '1px solid var(--card-border)',
    },
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', fontFamily: "'DM Sans', sans-serif", color: 'var(--t2)', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        input::placeholder { color: var(--t4); }
      `}</style>

      {/* Syner ambient glow */}
      <div style={{ position: 'fixed', top: -150, right: -150, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,0.08) 0%,transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Backend connecting banner */}
      {!backendReady && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, background: 'linear-gradient(90deg,#1d4ed8,#2563eb)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', fontSize: 13, color: '#bae6fd', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
          Connecting to server — please wait while the backend starts up...
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <aside style={{ width: S.sidebar.width, height: '100vh', background: S.sidebar.bg, borderRight: S.sidebar.border, display: 'flex', flexDirection: 'column', transition: 'width 0.3s ease', zIndex: 50, flexShrink: 0, position: 'fixed', left: 0, top: 0 }}>
        {/* Logo */}
        <div style={{ padding: sidebarCollapsed ? '18px 0' : '18px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--card-border)', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Flame size={16} color="#38bdf8" />
          </div>
          {!sidebarCollapsed && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', letterSpacing: -0.3 }}>GLD System</div>
              <div style={{ fontSize: 9, color: 'var(--green)', letterSpacing: 2, fontFamily: "'Geist Mono', monospace" }}>{RU_ID}</div>
            </div>
          )}
        </div>

        {/* Search */}
        {!sidebarCollapsed && (
          <div style={{ padding: '12px 12px 4px', position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-18%)', color: 'var(--t4)' }} />
            <input
              placeholder="Search…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '7px 10px 7px 32px', color: 'var(--t1)', fontSize: 13, outline: 'none' }}
            />
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!sidebarCollapsed && (
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--t4)', padding: '0 12px 4px' }}>{group.label}</div>
              )}
              {group.items.map(({ icon: Icon, label, key }) => {
                const active = tab === key;
                return (
                  <div
                    key={key}
                    onClick={() => setTab(key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: sidebarCollapsed ? '10px 0' : '9px 12px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', borderRadius: 10, cursor: 'pointer', color: active ? '#fff' : 'var(--t3)', background: active ? 'var(--primary)' : 'transparent', boxShadow: active ? '0 4px 10px rgba(37,99,235,0.3)' : 'none', transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                  >
                    <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
                    {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{label}</span>}
                    {key === 'alerts' && globalAlertCount > 0 && (
                      <span style={{ position: sidebarCollapsed ? 'absolute' : 'relative', top: sidebarCollapsed ? 6 : 'auto', right: sidebarCollapsed ? 6 : 'auto', marginLeft: sidebarCollapsed ? 0 : 'auto', background: active ? 'rgba(255,255,255,0.25)' : '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, fontFamily: "'Geist Mono', monospace" }}>{globalAlertCount}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: sidebarCollapsed ? '8px 0' : '8px 12px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={12} color="var(--green)" />
            </div>
            {!sidebarCollapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.name || 'Admin'}</div>
                <div style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'" }}>{currentUser.email}</div>
              </div>
            )}
          </div>
          <div
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: sidebarCollapsed ? '8px 0' : '8px 12px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', borderRadius: 9, cursor: 'pointer', color: '#ef4444', marginTop: 2 }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.07)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
          >
            <LogOut size={15} />
            {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 500 }}>Sign Out</span>}
          </div>
        </div>

        {/* Theme toggle */}
        <div style={{ padding: sidebarCollapsed ? '0 8px 14px' : '0 12px 14px' }}>
          {sidebarCollapsed ? (
            <button onClick={() => setDarkMode(!darkMode)} style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '8px 0', borderRadius: 9, background: 'var(--input-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', color: 'var(--t3)' }}>
              {darkMode ? <Moon size={14} /> : <Sun size={14} />}
            </button>
          ) : (
            <div style={{ display: 'flex', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 3, gap: 2 }}>
              <button onClick={() => setDarkMode(false)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: !darkMode ? 'var(--card-bg)' : 'transparent', color: !darkMode ? 'var(--t1)' : 'var(--t4)', boxShadow: !darkMode ? '0 1px 4px rgba(0,0,0,0.15)' : 'none' }}>
                <Sun size={13} /> Light
              </button>
              <button onClick={() => setDarkMode(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: darkMode ? 'var(--card-bg)' : 'transparent', color: darkMode ? 'var(--t1)' : 'var(--t4)', boxShadow: darkMode ? '0 1px 4px rgba(0,0,0,0.15)' : 'none' }}>
                <Moon size={13} /> Dark
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{ position: 'absolute', right: -12, top: 72, width: 24, height: 24, borderRadius: '50%', background: 'var(--card-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 60 }}
        >
          {sidebarCollapsed ? <ChevronRight size={12} color="var(--t3)" /> : <ChevronLeft size={12} color="var(--t3)" />}
        </button>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, zIndex: 10, marginLeft: S.sidebar.width, transition: 'margin-left 0.3s ease' }}>

        {/* Top header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: 'var(--header-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--card-border)' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', letterSpacing: -0.5 }}>Dashboard</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {minutesSinceUpdate !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t3)' }}>
                <span>Updated<br /><span style={{ fontFamily: "'Geist Mono', monospace" }}>{minutesSinceUpdate === 0 ? 'just now' : `${minutesSinceUpdate}m ago`}</span></span>
                <button onClick={loadDashboardData} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex' }}>
                  <RotateCcw size={14} />
                </button>
              </div>
            )}
            <button
              onClick={() => setTab('events')}
              title="Event Log & Export"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
            >
              <Download size={14} /> Export
            </button>
            <button style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--t3)', display: 'flex' }}>
              <MoreHorizontal size={14} />
            </button>
          </div>
        </header>

        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid var(--card-border)', background: 'var(--header-bg)', backdropFilter: 'blur(16px)', gap: 0 }}>
          {NAV.filter(n => ['overview','devices','map','alerts','events','analytics','settings'].includes(n.key)).map(({ label, key }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{ padding: '12px 16px', fontSize: 13, fontWeight: tab === key ? 600 : 400, color: tab === key ? 'var(--primary)' : 'var(--t3)', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
            >
              {label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <LiveClock />
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderBottom: '1px solid var(--card-border)', background: 'var(--header-bg)', backdropFilter: 'blur(12px)' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--t2)', fontSize: 12, fontWeight: 500 }}>
            <Filter size={12} /> Filters
          </button>
          {/* Site is fixed for this deployment — no switcher */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.3)', color: 'var(--green)', fontFamily: "'Geist Mono', monospace" }}>
            Site: {activeRU}
          </span>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ══ OVERVIEW ══ */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeUp 0.4s ease' }}>

              {/* Row 1: Big KPI + small metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Total Devices card (Syner "Total emissions" style) */}
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '16px 20px', backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <HardDrive size={11} /> Total Devices
                    </div>
                    <TrendBadge value={-9} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 2 }}>
                    <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--t1)', letterSpacing: -1.5, lineHeight: 1 }}>
                      <AnimNum value={totalDevices} />
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--t3)', letterSpacing: -0.5 }}>,{String(onlineDevices).padStart(2,'0')}</span>
                    <span style={{ fontSize: 11, color: 'var(--t4)', marginLeft: 2, fontFamily: "'Geist Mono', monospace" }}>NODES</span>
                    <span style={{ fontSize: 10, color: 'var(--t4)', marginLeft: 6 }}>Last 30 days</span>
                  </div>
                  {/* CH4/CO2 style breakdown → Online / Offline */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                    {[
                      { label: 'Online', value: onlineDevices, color: '#38bdf8', unit: 'NODES' },
                      { label: 'Offline', value: totalDevices - onlineDevices, color: '#38bdf8', unit: 'NODES' },
                    ].map(({ label, value, color, unit }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>
                          {value}<span style={{ fontSize: 9, color: 'var(--t4)', marginLeft: 4, fontFamily: "'Geist Mono', monospace" }}>{unit}</span>
                        </div>
                        <div style={{ height: 2, borderRadius: 2, background: 'var(--card-border)', marginTop: 6 }}>
                          <div style={{ height: '100%', width: `${totalDevices > 0 ? (value / totalDevices) * 100 : 0}%`, background: color, borderRadius: 2, transition: 'width 1s ease' }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 4, fontFamily: "'Geist Mono', monospace" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4 small metric cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'AVG Health', value: avgHealth, unit: '%', sub: activeRU, trend: 17, color: '#38bdf8', spark: [88,90,89,92,91,93,avgHealth] },
                    { label: 'Compliance Rate', value: Math.min(100, Math.round(onlineDevices / Math.max(1, totalDevices) * 100)), unit: '%', sub: 'Online / Total', trend: -2, color: '#ef4444', spark: [91,89,90,88,87,89,Math.round(onlineDevices / Math.max(1, totalDevices) * 100)], inverse: true },
                    { label: 'Active Alerts', value: totalAlerts, unit: '', sub: activeRU, trend: -4, color: '#38bdf8', spark: [12,8,10,6,9,5,totalAlerts] },
                    { label: 'Avg Battery', value: avgBattery, unit: '%', sub: activeRU, trend: -20, color: '#38bdf8', spark: [70,72,75,74,77,76,avgBattery] },
                  ].map(({ label, value, unit, sub, trend, color, spark, inverse }) => (
                    <div key={label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, padding: '14px 18px', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)' }}>{label}</div>
                        <TrendBadge value={trend} inverse={inverse} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--t1)', letterSpacing: -1 }}>{value}</span>
                        <span style={{ fontSize: 12, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>{unit}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--t4)' }}>{sub}</span>
                        <Sparkline data={spark} color={color} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2: Gas Trend — one line per sensor */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '20px 24px', backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>Gas / Environment Trend</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace", marginTop: 2 }}>
                      24h · per sensor · {activeRU} &nbsp;·&nbsp; {sensorTimeline.length} sensor{sensorTimeline.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 20, height: 2, borderTop: '2px dashed #f59e0b', display: 'inline-block' }} />
                      <span style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>MIDDLE ≥{sysSettings?.warningThreshold ?? 0.70}</span>
                    </div>
                    <PulseDot color="#93c5fd" />
                    <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>Live</span>
                  </div>
                </div>
                {sensorTimeline.length > 0 ? (
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '108px repeat(24, 1fr)', gap: 2, marginBottom: 4, position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 2, paddingBottom: 4 }}>
                      <div style={{ fontSize: 9, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace", display: 'flex', alignItems: 'center', paddingLeft: 4 }}>SENSOR</div>
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} style={{ fontSize: 9, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace", textAlign: 'center' }}>
                          {String(h).padStart(2, '0')}
                        </div>
                      ))}
                    </div>
                    {sensorTimeline.map(s => {
                      const hourMap = new Map(s.data.map(d => [d.hour, d.confidence]));
                      return (
                        <div key={s.deviceId} style={{ display: 'grid', gridTemplateColumns: '108px repeat(24, 1fr)', gap: 2, marginBottom: 2 }}>
                          <div style={{ fontSize: 10, color: 'var(--t2)', fontFamily: "'Geist Mono', monospace", display: 'flex', alignItems: 'center', paddingLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.deviceName}
                          </div>
                          {Array.from({ length: 24 }, (_, h) => {
                            const hourKey = `${String(h).padStart(2, '0')}:00`;
                            const conf = hourMap.get(hourKey) ?? null;
                            return (
                              <div key={h}
                                title={`${s.deviceName} @ ${hourKey}: ${conf !== null ? (conf * 100).toFixed(1) + '%' : '—'}`}
                                style={{ height: 20, borderRadius: 3, background: heatmapColor(conf, sysSettings?.warningThreshold ?? 0.70, sysSettings?.criticalThreshold ?? 0.85), border: '1px solid rgba(255,255,255,0.04)', cursor: 'default' }}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 10, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>
                      <span>Low</span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((r, i) => (
                          <div key={i} style={{ width: 18, height: 10, borderRadius: 2, background: heatmapColor(r, 0.999, 1) }} />
                        ))}
                      </div>
                      <span>High</span>
                      <div style={{ marginLeft: 8, display: 'flex', gap: 10 }}>
                        <span style={{ color: '#f59e0b' }}>▪ MIDDLE ≥{sysSettings?.warningThreshold ?? 0.70}</span>
                        <span style={{ color: '#ef4444' }}>▪ HIGH ≥{sysSettings?.criticalThreshold ?? 0.85}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t4)', fontSize: 12, fontFamily: "'Geist Mono', monospace" }}>
                    NO SENSOR READINGS IN LAST 24H
                  </div>
                )}
              </div>

              {/* Row 3: Top by RU + Top by Device Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Top by RU — battery health + connection quality */}
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '20px 22px', backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-card)' }}>
                  <SectionTitle>Refinery Unit Health</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {ruData.slice(0, 6).map((r, i) => {
                      const ruDevices = apiDevices.filter(d => d.ruId === r.ru);
                      const avgBattery = ruDevices.length > 0 ? Math.round(ruDevices.reduce((s, d) => s + d.battery.soc, 0) / ruDevices.length) : 0;
                      const avgRssi    = ruDevices.length > 0 ? Math.round(ruDevices.reduce((s, d) => s + d.network.rssi, 0) / ruDevices.length) : -999;
                      const connLabel  = avgRssi > -60 ? 'Strong' : avgRssi > -75 ? 'Fair' : 'Weak';
                      const connColor  = avgRssi > -60 ? '#38bdf8' : avgRssi > -75 ? '#f59e0b' : '#ef4444';
                      const status     = r.health >= 80 ? 'Healthy' : r.health >= 50 ? 'Warning' : 'Bad';
                      const statusColor = r.health >= 80 ? '#38bdf8' : r.health >= 50 ? '#f59e0b' : '#ef4444';
                      const statusBg   = r.health >= 80 ? 'rgba(56,189,248,0.1)' : r.health >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
                      return (
                        <div key={r.ru} style={{ padding: '11px 0', borderBottom: i < ruData.slice(0,6).length - 1 ? '1px solid var(--divider)' : 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{r.ru}</span>
                              <span style={{ fontSize: 11, color: 'var(--t4)', marginLeft: 6 }}>{r.total} devices</span>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: statusBg, padding: '2px 8px', borderRadius: 20, fontFamily: "'Geist Mono', monospace" }}>{status}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {/* Battery */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: 'var(--t4)' }}>Battery</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: avgBattery >= 60 ? '#38bdf8' : avgBattery >= 30 ? '#f59e0b' : '#ef4444', fontFamily: "'Geist Mono', monospace" }}>{avgBattery}%</span>
                              </div>
                              <div style={{ height: 3, background: 'var(--card-border)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${avgBattery}%`, background: avgBattery >= 60 ? '#38bdf8' : avgBattery >= 30 ? '#f59e0b' : '#ef4444', borderRadius: 2, transition: 'width 0.8s ease' }} />
                              </div>
                            </div>
                            {/* Connection */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: 'var(--t4)' }}>Signal</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: connColor, fontFamily: "'Geist Mono', monospace" }}>{connLabel}</span>
                              </div>
                              <div style={{ height: 3, background: 'var(--card-border)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, ((avgRssi + 100) / 50) * 100))}%`, background: connColor, borderRadius: 2, transition: 'width 0.8s ease' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top by Device Type — battery health + connection quality */}
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '20px 22px', backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-card)' }}>
                  <SectionTitle>Health by Device Type</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[
                      { label: 'Sensor',       sub: 'End nodes',     typeKey: 'SENSOR'  },
                      { label: 'Routing Node',  sub: 'Cluster heads', typeKey: 'CLUSTER' },
                      { label: 'Gateway',       sub: 'Root nodes',    typeKey: 'GATEWAY' },
                    ].map(({ label, sub, typeKey }, i) => {
                      const group      = apiDevices.filter(d => d.type === typeKey);
                      const count      = group.length;
                      const avgBattery = count > 0 ? Math.round(group.reduce((s, d) => s + d.battery.soc, 0) / count) : 0;
                      const avgRssi    = count > 0 ? Math.round(group.reduce((s, d) => s + d.network.rssi, 0) / count) : -999;
                      const avgHealth  = count > 0 ? Math.round(group.reduce((s, d) => s + d.healthScore, 0) / count) : 0;
                      const connLabel  = avgRssi > -60 ? 'Strong' : avgRssi > -75 ? 'Fair' : 'Weak';
                      const connColor  = avgRssi > -60 ? '#38bdf8' : avgRssi > -75 ? '#f59e0b' : '#ef4444';
                      const status     = avgHealth >= 80 ? 'Healthy' : avgHealth >= 50 ? 'Warning' : 'Bad';
                      const statusColor = avgHealth >= 80 ? '#38bdf8' : avgHealth >= 50 ? '#f59e0b' : '#ef4444';
                      const statusBg   = avgHealth >= 80 ? 'rgba(56,189,248,0.1)' : avgHealth >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
                      return (
                        <div key={typeKey} style={{ padding: '14px 0', borderBottom: i < 2 ? '1px solid var(--divider)' : 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{label}</span>
                              <span style={{ fontSize: 11, color: 'var(--t4)', marginLeft: 6 }}>{sub} · {count} nodes</span>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: statusBg, padding: '2px 8px', borderRadius: 20, fontFamily: "'Geist Mono', monospace" }}>{status}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: 'var(--t4)' }}>Avg Battery</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: avgBattery >= 60 ? '#38bdf8' : avgBattery >= 30 ? '#f59e0b' : '#ef4444', fontFamily: "'Geist Mono', monospace" }}>{avgBattery}%</span>
                              </div>
                              <div style={{ height: 3, background: 'var(--card-border)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${avgBattery}%`, background: avgBattery >= 60 ? '#38bdf8' : avgBattery >= 30 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                              </div>
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: 'var(--t4)' }}>Signal</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: connColor, fontFamily: "'Geist Mono', monospace" }}>{avgRssi} dBm · {connLabel}</span>
                              </div>
                              <div style={{ height: 3, background: 'var(--card-border)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, ((avgRssi + 100) / 50) * 100))}%`, background: connColor, borderRadius: 2 }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ DEVICES ══ */}
          {tab === 'devices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.4s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, padding: '14px 18px', boxShadow: 'var(--shadow-card)' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>Device Fleet</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>{filteredDevices.length} NODES — {activeRU}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['ALL','GATEWAY','CLUSTER','SENSOR'].map(type => (
                    <button key={type} onClick={() => setActiveType(type)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: activeType === type ? 600 : 400, cursor: 'pointer', background: activeType === type ? 'var(--primary-soft)' : 'var(--input-bg)', border: activeType === type ? '1px solid var(--primary-border)' : '1px solid var(--card-border)', color: activeType === type ? 'var(--primary)' : 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--sidebar-bg)', zIndex: 10 }}>
                      <tr>
                        {[{l:'Device',k:'id'},{l:'Type',k:'type'},{l:'Site',k:'ru'},{l:'Battery',k:'battery'},{l:'Signal',k:'rssi'},{l:'Health',k:'health'},{l:'Status',k:'status'},{l:'',k:'actions'}].map(col => (
                          <th key={col.k} onClick={() => { if (col.k !== 'actions' && col.k !== 'id' && col.k !== 'type' && col.k !== 'ru') { setSortDir(sortCol === col.k && sortDir === 'asc' ? 'desc' : 'asc'); setSortCol(col.k); } }}
                            style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, color: 'var(--t4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'Geist Mono', monospace", borderBottom: '1px solid var(--card-border)', cursor: col.k !== 'actions' ? 'pointer' : 'default' }}>
                            {col.l}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.map((d, i) => {
                        const Icon = typeIcon(d.type);
                        const isAlert = (d.latestConfidence ?? 0) >= (sysSettings?.warningThreshold ?? 0.70);
                        return (
                          <tr key={d.id} onClick={() => setSelectedDevice(d)} style={{ background: selectedDevice?.id === d.id ? 'rgba(56,189,248,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', cursor: 'pointer', borderBottom: '1px solid var(--divider)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(56,189,248,0.03)'}
                            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = selectedDevice?.id === d.id ? 'rgba(56,189,248,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                          >
                            <td style={{ padding: '11px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 9, background: isAlert ? 'rgba(239,68,68,0.1)' : 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Icon size={14} color={isAlert ? '#ef4444' : 'var(--green)'} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{d.name}</div>
                                  <div style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>{d.id.slice(-8).toUpperCase()}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '11px 16px', fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>{d.type}</td>
                            <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--green)', fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>{d.ruId}</td>
                            <td style={{ padding: '11px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 36, height: 3, background: 'var(--card-border)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ width: `${d.battery.soc}%`, height: '100%', background: batteryColor(d.battery.soc), borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: batteryColor(d.battery.soc), fontFamily: "'Geist Mono', monospace" }}>{d.battery.soc}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: "'Geist Mono', monospace", color: d.network.rssi > -60 ? 'var(--green)' : 'var(--yellow)' }}>{d.network.rssi} dBm</td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: d.healthScore >= 80 ? 'var(--green)' : d.healthScore >= 50 ? 'var(--yellow)' : 'var(--red)', background: d.healthScore >= 80 ? 'rgba(56,189,248,0.1)' : d.healthScore >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 6, fontFamily: "'Geist Mono', monospace" }}>{d.healthScore}%</span>
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <PulseDot color={statusColor(d.status)} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(d.status), fontFamily: "'Geist Mono', monospace" }}>{d.status}</span>
                              </div>
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              <button onClick={e => { e.stopPropagation(); setDeviceToRename(d); setNewDeviceName(d.name); setShowRenameModal(true); }}
                                style={{ fontSize: 11, color: 'var(--t3)', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                                Rename
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ MAP ══ */}
          {tab === 'map' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.4s ease' }}>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '18px 20px', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>RU Map — {mapRu}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace", marginBottom: 14 }}>Interactive physical positioning</div>
                <DeviceMap devices={apiDevices} ruId={mapRu} selectedDevice={selectedDevice} onDeviceSelect={setSelectedDevice} warningThreshold={sysSettings?.warningThreshold} criticalThreshold={sysSettings?.criticalThreshold} onDeviceUpdate={() => loadDevices(activeRU)} />
              </div>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '18px 20px', boxShadow: 'var(--shadow-card)' }}><UnitLayoutMap devices={apiDevices} onNodeClick={d => setSelectedDevice(d)} /></div>
            </div>
          )}

          {/* ══ LAYOUT ══ */}
          {tab === 'layout' && (
            <div style={{ animation: 'fadeUp 0.4s ease' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SensorListPanel devices={filteredDevices} />
                <UnitLayoutMap devices={apiDevices} onNodeClick={d => { setSelectedDevice(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </div>
            </div>
          )}

          {/* ══ ALERTS ══ */}
          {tab === 'alerts' && (
            <div style={{ animation: 'fadeUp 0.4s ease', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)' }}>Alarm Console</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>Active: {localAlerts.filter(a => a.status !== 'RESOLVED').length}</div>
                </div>
              </div>
              {filteredAlerts.map(a => (
                <div key={a.id} style={{ background: 'var(--card-bg)', border: `1px solid ${severityColor(a.severity)}20`, borderRadius: 14, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${severityColor(a.severity)}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={15} color={severityColor(a.severity)} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{a.ru} — {a.device}</span>
                        <span style={{ fontSize: 10, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', padding: '1px 6px', borderRadius: 4, fontFamily: "'Geist Mono', monospace" }}>{a.type}</span>
                        <span style={{ fontSize: 11, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace", display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={10} />
                          {(() => { const m = Math.floor((Date.now() - new Date(a.time).getTime()) / 60000); if (m < 0 || isNaN(m)) return 'Just now'; if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); return h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`; })()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--t3)' }}>{a.message}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {a.status === 'ACTIVE' && <button onClick={() => handleUpdateAlertStatus(a.id, 'ACKNOWLEDGED')} style={{ background: 'rgba(37,99,235,0.08)', color: '#38bdf8', padding: '5px 12px', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Acknowledge</button>}
                    <button onClick={() => handleUpdateAlertStatus(a.id, 'RESOLVED')} style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--green)', padding: '5px 12px', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Resolve</button>
                  </div>
                </div>
              ))}
              {filteredAlerts.length === 0 && (
                <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, boxShadow: 'var(--shadow-card)' }}>
                  <Shield size={36} color="var(--green)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <div style={{ fontSize: 14, color: 'var(--t3)', fontFamily: "'Geist Mono', monospace" }}>SYSTEM CLEAR — NO ACTIVE ALERTS</div>
                </div>
              )}
            </div>
          )}

          {/* ══ EVENTS ══ */}
          {tab === 'events' && currentUser && (
            <EventsTab currentUser={currentUser} activeRU={activeRU} />
          )}

          {/* ══ ANALYTICS ══ */}
          {tab === 'analytics' && (
            <AnalyticsTab
              activeRU={activeRU}
              warningThreshold={sysSettings?.warningThreshold ?? 50}
              criticalThreshold={sysSettings?.criticalThreshold ?? 80}
            />
          )}

          {/* ══ SETTINGS ══ */}
          {tab === 'settings' && (
            <div style={{ maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeUp 0.4s ease' }}>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '24px 26px', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>System Configuration</div>
                <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 24 }}>Global parameters for sensors and alerting logic.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} color="var(--yellow)" /> Gas Alert Thresholds</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {[
                        { label: 'MIDDLE Risk Threshold', key: 'warningThreshold' as keyof SystemSettings, color: 'var(--yellow)', desc: 'confidence ≥ this → MIDDLE' },
                        { label: 'HIGH Risk Threshold',   key: 'criticalThreshold' as keyof SystemSettings, color: 'var(--red)',    desc: 'confidence ≥ this → HIGH' },
                      ].map(({ label, key, color, desc }) => (
                        <div key={key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, color: 'var(--t3)' }}>{label}</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'Geist Mono', monospace" }}>{((sysSettings?.[key] as number) ?? 0).toFixed(2)}</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--t4)', marginBottom: 10, fontFamily: "'Geist Mono', monospace" }}>{desc}</div>
                          <input type="range" min="0.50" max="0.99" step="0.01" value={(sysSettings?.[key] as number) ?? 0}
                            onChange={e => setSysSettings(s => s ? { ...s, [key]: parseFloat(e.target.value) } : null)}
                            style={{ width: '100%', accentColor: color }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} color="var(--green)" /> Data Refresh Rate</div>
                    <select value={sysSettings?.refreshInterval || 10} onChange={e => setSysSettings(s => s ? { ...s, refreshInterval: parseInt(e.target.value) } : null)}
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '9px 14px', color: 'var(--t1)', fontSize: 13, maxWidth: 280 }}>
                      <option value={5}>Every 5 seconds (Real-time)</option>
                      <option value={10}>Every 10 seconds (Balanced)</option>
                      <option value={30}>Every 30 seconds (Power Save)</option>
                      <option value={60}>Every 1 minute (Low Data)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--divider)' }}>
                    <button onClick={() => handleUpdateSettings({ warningThreshold: sysSettings?.warningThreshold, criticalThreshold: sysSettings?.criticalThreshold, refreshInterval: sysSettings?.refreshInterval })}
                      disabled={isSaving} style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 600, cursor: 'pointer', opacity: isSaving ? 0.7 : 1, fontSize: 14 }}>
                      {isSaving ? 'Saving…' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
              </div>

              {/* User Management */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '22px 24px', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>User Management</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Administrators and RU-specific operators</div>
                  </div>
                  <button onClick={() => setShowAddUser(true)} style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add User</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['User','RU Access','Role','Created','Actions'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: 'var(--t4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'Geist Mono', monospace", borderBottom: '1px solid var(--divider)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.ruId === RU_ID).map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--divider)' }}>
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>{u.email[0].toUpperCase()}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{u.name || 'No Name'}</div>
                              <div style={{ fontSize: 11, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 10px' }}><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'rgba(56,189,248,0.1)', padding: '2px 8px', borderRadius: 6, fontFamily: "'Geist Mono', monospace" }}>{u.ruId}</span></td>
                        <td style={{ padding: '12px 10px', fontSize: 13, color: 'var(--t3)' }}>{u.role}</td>
                        <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <button onClick={() => handleDeleteUser(u.id)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--divider)', marginTop: 'auto' }}>
            <PulseDot color="var(--green)" />
            <span style={{ fontSize: 11, color: 'var(--t4)', fontFamily: "'Geist Mono', monospace" }}>System Live — v2.1 Stable</span>
          </div>
        </div>
      </main>

      {/* ── MODALS ── */}
      {showAddUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--card-border)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 400 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Add New Administrator</h3>
            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[{p:'Email',t:'email',k:'email'},{p:'Full Name',t:'text',k:'name'}].map(({p,t,k}) => (
                <input key={k} placeholder={p} type={t} value={newUser[k as 'email'|'name']} onChange={e => setNewUser({...newUser,[k]:e.target.value})}
                  style={{ background:'var(--input-bg)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 14px',color:'var(--t1)',fontSize:13 }} />
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select value={RU_ID} disabled style={{ background:'var(--input-bg)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px',color:'var(--t3)',fontSize:13,opacity:0.7,cursor:'not-allowed' }}>
                  <option value={RU_ID}>{RU_ID}</option>
                </select>
                <select value={newUser.role} onChange={e => setNewUser({...newUser,role:e.target.value})} style={{ background:'var(--input-bg)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px',color:'var(--t1)',fontSize:13 }}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OPERATOR">OPERATOR</option>
                </select>
              </div>
              <div style={{ display:'flex',gap:10,marginTop:8 }}>
                <button type="button" onClick={() => setShowAddUser(false)} style={{ flex:1,background:'transparent',border:'1px solid var(--card-border)',color:'var(--t3)',borderRadius:10,padding:'10px',fontSize:13,cursor:'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSaving} style={{ flex:1,background:'linear-gradient(135deg,#1d4ed8,#2563eb)',border:'none',color:'#fff',borderRadius:10,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:isSaving?0.7:1 }}>
                  {isSaving ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRenameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--card-border)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 380 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>Rename Device</h3>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20, fontFamily: "'Geist Mono', monospace" }}>{deviceToRename?.macAddress}</p>
            <form onSubmit={handleUpdateDeviceName} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input autoFocus placeholder="Display name" required value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)}
                style={{ background:'var(--input-bg)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 14px',color:'var(--t1)',fontSize:14 }} />
              <div style={{ display:'flex',gap:10 }}>
                <button type="button" onClick={() => setShowRenameModal(false)} style={{ flex:1,background:'transparent',border:'1px solid var(--card-border)',color:'var(--t3)',borderRadius:10,padding:'10px',fontSize:13,cursor:'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSaving} style={{ flex:1,background:'linear-gradient(135deg,#1d4ed8,#2563eb)',border:'none',color:'#fff',borderRadius:10,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:isSaving?0.7:1 }}>
                  {isSaving ? 'Saving…' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
