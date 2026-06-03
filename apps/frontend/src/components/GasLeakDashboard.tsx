'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BellRing,
  ChevronLeft,
  Clock,
  Cpu,
  Flame,
  HardDrive,
  LayoutDashboard,
  Map,
  Moon,
  Search,
  Server,
  Settings,
  Shield,
  Sun,
  Thermometer,
  TrendingUp,
  Users,
  Wifi,
  Network,
  Radio,
  Camera,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { fetchDevices, fetchDashboardStats, fetchSettings, updateSettings, fetchUsers, createUser, deleteUser, login, fetchAnalytics, updateDeviceName, type Device, type DashboardStats, type RuStats, type TimelineEntry, type Alert, type BatteryDistEntry, type NetworkQualityEntry, type SystemSettings, type User, type AnalyticsStats } from '@/lib/graphql';

const DeviceMap = dynamic(() => import('./DeviceMap').then((m) => m.DeviceMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', color: 'var(--t4)', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
      <RefreshCw size={20} className="animate-spin" style={{ marginRight: 10 }} />
      INITIALIZING GEOSPATIAL ENGINE...
    </div>
  ),
});

import { SensorListPanel } from './SensorListPanel';
import { UnitLayoutMap } from './UnitLayoutMap';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

const RU_LIST = ['ALL', 'RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];

const RU_LIST_QUERY = `
  query GetRUSites {
    ruSites {
      id
    }
  }
`;

const MONTHLY_EVENTS = [
  { month: 'Sep', leaks: 2, falseAlarms: 5, maintenance: 8 },
  { month: 'Oct', leaks: 1, falseAlarms: 3, maintenance: 12 },
  { month: 'Nov', leaks: 3, falseAlarms: 4, maintenance: 6 },
  { month: 'Dec', leaks: 0, falseAlarms: 2, maintenance: 15 },
  { month: 'Jan', leaks: 1, falseAlarms: 6, maintenance: 9 },
  { month: 'Feb', leaks: 2, falseAlarms: 3, maintenance: 11 },
  { month: 'Mar', leaks: 1, falseAlarms: 1, maintenance: 7 },
];

const RADAR_DATA = [
  { metric: 'Uptime', RU2: 94, RU3: 91, RU7: 89 },
  { metric: 'Battery', RU2: 88, RU3: 82, RU7: 76 },
  { metric: 'Signal', RU2: 90, RU3: 85, RU7: 78 },
  { metric: 'Health', RU2: 94, RU3: 91, RU7: 89 },
  { metric: 'Response', RU2: 96, RU3: 93, RU7: 85 },
  { metric: 'Coverage', RU2: 92, RU3: 88, RU7: 90 },
];

function statusColor(s: string) {
  return s === 'ONLINE' ? '#22d3ee' : s === 'OFFLINE' ? '#ef4444' : '#f59e0b';
}
function healthColor(h: number) {
  return h >= 80 ? '#22d3ee' : h >= 50 ? '#f59e0b' : '#ef4444';
}
function batteryColor(b: number | null) {
  return b === null ? '#64748b' : b >= 60 ? '#22d3ee' : b >= 30 ? '#f59e0b' : '#ef4444';
}
function severityColor(s: string) {
  return s === 'CRITICAL' ? '#ef4444' : s === 'WARNING' ? '#f59e0b' : '#3b82f6';
}
function typeIcon(t: string) {
  switch (t.toUpperCase()) {
    case 'GATEWAY': return Wifi;
    case 'CLUSTER': return Network;
    case 'SENSOR': return Radio;
    default: return Activity;
  }
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '8px 12px', backdropFilter: 'blur(12px)' }}>
      <p style={{ color: 'var(--t3)', fontSize: 11, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#22d3ee', fontSize: 12, margin: '2px 0', fontFamily: "'JetBrains Mono', monospace" }}>
          {p.name}: <span style={{ fontWeight: 700 }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function AnimNum({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.floor(value / 30));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else setDisplay(start);
    }, 25);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}{suffix}</>;
}

function LiveClock() {
  const [timeText, setTimeText] = useState('—:—:—');
  useEffect(() => {
    const update = () => setTimeText(new Date().toLocaleTimeString('en-GB'));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span suppressHydrationWarning style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--t3)', letterSpacing: 0.5 }}>
      {timeText} WIB
    </span>
  );
}

function Sparkline({ data, color = '#22d3ee', h = 24 }: { data: number[]; color?: string; h?: number }) {
  if (!data || data.length < 2) return null;
  const w = 70;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulseDot({ color = '#22d3ee', size = 6 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, animation: 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite', opacity: 0.4 }} />
      <span style={{ position: 'absolute', inset: 1, borderRadius: '50%', background: color }} />
    </span>
  );
}

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Overview', key: 'overview' },
  { icon: HardDrive, label: 'Devices', key: 'devices' },
  { icon: Network, label: 'Unit Layout', key: 'layout' },
  { icon: Map, label: 'Map View', key: 'map' },
  { icon: AlertTriangle, label: 'Alerts', key: 'alerts' },
  { icon: TrendingUp, label: 'Analytics', key: 'analytics' },
  { icon: Settings, label: 'Settings', key: 'settings' },
];

export default function GasLeakDashboard() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('gld_user');
    if (storedUser) { try { setCurrentUser(JSON.parse(storedUser)); } catch (err) { localStorage.removeItem('gld_user'); } }
    setIsCheckingAuth(false);
  }, []);

  const [activeRU, setActiveRU] = useState('ALL');
  const [activeType, setActiveType] = useState('ALL');
  const [tab, setTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState('health');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [apiDevices, setApiDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', ruId: 'ALL', role: 'ADMIN' });
  const [localAlerts, setLocalAlerts] = useState<Alert[]>([]);
  const [alarmLocationFilter, setAlarmLocationFilter] = useState('ALL');
  const [alarmTypeFilter, setAlarmTypeFilter] = useState('ALL');
  const [alarmScenarioFilter, setAlarmScenarioFilter] = useState('ALL');
  const [alarmStatusFilter, setAlarmStatusFilter] = useState('ALL');

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [deviceToRename, setDeviceToRename] = useState<Device | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');

  const loadDashboardData = useCallback(async () => {
    try {
      const [s, settings, uList, aStats] = await Promise.all([fetchDashboardStats(), fetchSettings(), fetchUsers(), fetchAnalytics()]);
      setStats(s); setSysSettings(settings); setUsers(uList); setAnalytics(aStats);
      if (s.recentAlerts) setLocalAlerts(s.recentAlerts);
    } catch (err) { console.error('[Dashboard] Failed to fetch data:', err); }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoggingIn(true); setLoginError('');
    try {
      const res = await login(loginEmail, loginPassword);
      if (res.user) { setCurrentUser(res.user); localStorage.setItem('gld_user', JSON.stringify(res.user)); }
      else { setLoginError(res.error || 'Invalid credentials'); }
    } catch (err) { setLoginError('Server connection failed'); }
    finally { setIsLoggingIn(false); }
  };

  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('gld_user'); setLoginEmail(''); setLoginPassword(''); };

  const loadDevices = useCallback(async (ruId: string) => {
    setDevicesLoading(true);
    try {
      if (ruId === 'ALL') {
        const all: Device[] = [];
        const rus = ['RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];
        const results = await Promise.allSettled(rus.map(ru => fetchDevices(ru)));
        results.forEach((result) => {
          if (result.status === 'fulfilled') all.push(...result.value);
        });
        setApiDevices(all);
      } else {
        const d = await fetchDevices(ruId);
        setApiDevices(d);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to load devices:', err);
      setApiDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const handleUpdateSettings = async (updates: Partial<SystemSettings>) => {
    setIsSaving(true); try { const updated = await updateSettings(updates); setSysSettings(updated); loadDashboardData(); }
    catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true);
    try { await createUser(newUser, currentUser!.id); setShowAddUser(false); setNewUser({ email: '', name: '', password: '', ruId: 'ALL', role: 'ADMIN' }); loadDashboardData(); }
    catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try { await deleteUser(id); loadDashboardData(); } catch (err) { console.error(err); }
  };

  const handleUpdateDeviceName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceToRename || !newDeviceName.trim()) return;
    setIsSaving(true);
    try {
      await updateDeviceName(deviceToRename.id, newDeviceName.trim());
      setShowRenameModal(false);
      setDeviceToRename(null);
      setNewDeviceName('');
      loadDevices(activeRU);
    } catch (err) {
      console.error('[Dashboard] Failed to rename device:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAlertStatus = (alertId: string, status: string) => {
    setLocalAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status } : a));
  };

  useEffect(() => { if (currentUser) { loadDashboardData(); const interval = setInterval(loadDashboardData, 10000); return () => clearInterval(interval); } }, [loadDashboardData, currentUser]);
  useEffect(() => { if (currentUser) { loadDevices(activeRU); } }, [activeRU, loadDevices, currentUser]);

  const filteredDevices = apiDevices
    .filter((d) => {
      if (activeType !== 'ALL' && d.type !== activeType) return false;
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return d.name.toLowerCase().includes(s) || d.id.toLowerCase().includes(s) || d.ruId.toLowerCase().includes(s);
    })
    .sort((a, b) => {
      const v = sortDir === 'asc' ? 1 : -1;
      if (sortCol === 'health') return (a.healthScore - b.healthScore) * v;
      if (sortCol === 'battery') return (a.battery.soc - b.battery.soc) * v;
      if (sortCol === 'rssi') return (a.network.rssi - b.network.rssi) * v;
      return 0;
    });

  const ruData = stats?.ruData || [];
  const timelineData = stats?.timelineData || [];
  const recentAlerts = stats?.recentAlerts || [];
  const batteryDist = stats?.batteryDist || [];
  const networkQuality = stats?.networkQuality || [];
  const totalDevices = stats?.totalDevices || 0;
  const onlineDevices = stats?.onlineDevices || 0;
  const totalAlerts = stats?.totalAlerts || 0;
  const avgHealth = stats?.avgHealth || 0;
  const mapRu = activeRU === 'ALL' ? 'RU2' : activeRU;
  const mapDevices = apiDevices;

  if (isCheckingAuth) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw className="animate-spin" style={{ color: '#38bdf8', marginBottom: 16 }} size={28} />
          <div style={{ color: 'var(--t3)', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>RESTORING SESSION...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit', sans-serif" }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '20%', left: '30%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,116,144,0.15) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '20%', right: '30%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)' }} />
        </div>
        <div style={{ width: '100%', maxWidth: '380px', padding: 36, background: 'var(--header-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--card-border)', borderRadius: 24, zIndex: 10, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #0e7490, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Flame size={24} color="#fff" />
            </div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>GASGUARD v2.1</h1>
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>OPERATIONAL CONTROL PORTAL</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {loginError && <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{loginError}</div>}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Email Address</label>
              <input type="email" placeholder="admin@gld.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 14px', color: 'var(--t1)', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Password</label>
              <input type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 14px', color: 'var(--t1)', fontSize: 13, outline: 'none' }} />
            </div>
            <button type="submit" disabled={isLoggingIn} style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'linear-gradient(135deg, #0e7490, #0284c7)', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 8, boxShadow: '0 8px 12px -3px rgba(14, 116, 144, 0.3)', opacity: isLoggingIn ? 0.7 : 1 }}>
              {isLoggingIn ? 'AUTHENTICATING...' : 'ACCESS CONTROL PANEL'}
            </button>
          </form>
          <div style={{ marginTop: 28, textAlign: 'center', fontSize: 11, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>RESTRICTED ACCESS — SYSTEM LOGS ACTIVE</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', color: 'var(--t2)', fontFamily: "'Outfit', system-ui, sans-serif", display: 'flex', position: 'relative', overflow: 'hidden', WebkitFontSmoothing: 'antialiased' }}>
      <style>{`
        ${darkMode ? `:root { --page-bg: #0B0B0B; --sidebar-bg: #111111; --header-bg: rgba(11, 11, 11, 0.85); --card-bg: rgba(255, 255, 255, 0.03); --card-bg-alt: rgba(255, 255, 255, 0.01); --card-border: rgba(255, 255, 255, 0.06); --input-bg: rgba(25, 25, 25, 0.80); --sidebar-border: rgba(255, 255, 255, 0.08); --divider: rgba(255, 255, 255, 0.06); --t1: #FAFAFA; --t2: #e2e8f0; --t3: #9ca3af; --t4: #6b7280; --panel-green: #102B1D; --panel-navy: #101831; --panel-purple: #26143A; }` : `:root { --page-bg: #f8fafc; --sidebar-bg: rgba(255, 255, 255, 0.90); --header-bg: rgba(255, 255, 255, 0.85); --card-bg: #ffffff; --card-bg-alt: #f1f5f9; --card-border: rgba(15, 23, 42, 0.1); --input-bg: #f1f5f9; --sidebar-border: rgba(15, 23, 42, 0.08); --divider: rgba(15, 23, 42, 0.06); --t1: #0f172a; --t2: #334155; --t3: #475569; --t4: #64748b; --panel-green: #e0f2e9; --panel-navy: #e0e7ff; --panel-purple: #f3e8ff; }`}
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.2); border-radius: 10px; }
        * { transition: background-color 0.3s ease, border-color 0.3s ease, color 0.2s ease; }
      `}</style>

      <nav style={{ width: sidebarCollapsed ? 70 : 240, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)', display: 'flex', flexDirection: 'column', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 50, backdropFilter: 'blur(20px)', position: 'relative' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #0e7490, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Flame size={16} color="#fff" /></div>
          {!sidebarCollapsed && <div><div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)', letterSpacing: -0.5 }}>GLD System</div><div style={{ fontSize: 9, color: '#38bdf8', letterSpacing: 1.5, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>MULTI-RU</div></div>}
        </div>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ position: 'absolute', right: -12, top: 60, width: 24, height: 24, borderRadius: '50%', background: 'var(--card-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 60, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'transform 0.3s', transform: sidebarCollapsed ? 'rotate(180deg)' : 'none' }}>
          <ChevronLeft size={14} color="var(--t3)" />
        </button>
        <div style={{ flex: 1, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon; const active = tab === item.key;
            return (
              <div key={item.key} onClick={() => setTab(item.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', background: active ? 'rgba(56, 189, 248, 0.08)' : 'transparent', color: active ? '#22d3ee' : 'var(--t4)', position: 'relative' }}>
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{item.label}</span>}
                {item.key === 'alerts' && totalAlerts > 0 && <span style={{ position: sidebarCollapsed ? 'absolute' : 'relative', top: sidebarCollapsed ? 4 : 'auto', right: sidebarCollapsed ? 8 : 'auto', marginLeft: sidebarCollapsed ? 0 : 'auto', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace" }}>{totalAlerts}</span>}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '16px 10px', borderTop: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a5f, #0e7490)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={11} color="#22d3ee" /></div>
            {!sidebarCollapsed && <div style={{ overflow: 'hidden' }}><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>Admin</div><div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>{currentUser.name || 'Global'}</div></div>}
          </div>
          <div onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginTop: 4, borderRadius: 8, cursor: 'pointer', color: '#ef4444' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <LogOut size={16} />{!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 600 }}>Sign Out</span>}
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, zIndex: 10, position: 'relative' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: 'var(--header-bg)', borderBottom: '1px solid var(--divider)', backdropFilter: 'blur(12px)' }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 20, color: 'var(--t1)', letterSpacing: -0.5 }}>{tab === 'overview' ? 'Command Center' : tab === 'devices' ? 'Device Fleet' : tab === 'map' ? 'Map View' : tab === 'alerts' ? 'Alert Console' : tab === 'analytics' ? 'Analytics' : 'Dashboard'}</h1>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>Gas Leak Detection Monitoring</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <LiveClock />
            <div style={{ display: 'flex', gap: 2, background: darkMode ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.6)', borderRadius: '10px', padding: '3px', border: '1px solid var(--card-border)', backdropFilter: 'blur(8px)' }}>
              {RU_LIST.map((ru) => (
                <button key={ru} onClick={() => setActiveRU(ru)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: activeRU === ru ? 700 : 500, padding: '5px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: activeRU === ru ? 'linear-gradient(135deg, #0e7490, #0284c7)' : 'transparent', color: activeRU === ru ? '#fff' : 'var(--t3)', textTransform: 'uppercase' }}>{ru}</button>
              ))}
            </div>
            <button onClick={() => setDarkMode(!darkMode)} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: 'var(--t3)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
              {darkMode ? <Sun size={12} /> : <Moon size={12} />}{darkMode ? 'Light' : 'Dark'}
            </button>
            <button
              onClick={() => setTab('alerts')}
              style={{
                position: 'relative',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                color: tab === 'alerts' ? '#ef4444' : 'var(--t4)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = tab === 'alerts' ? '#ef4444' : 'var(--t4)')}
            >
              <BellRing size={18} />
              {totalAlerts > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '2px solid var(--header-bg)',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)'
                }} />
              )}
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {tab === 'layout' && (
            <div style={{ animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {activeRU === 'ALL' ? (
                <div style={{ padding: '50px 20px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14 }}>
                  <Network size={40} color="var(--t4)" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--t1)' }}>Unit Layout View</h3>
                  <p style={{ color: 'var(--t3)', fontSize: 13, marginTop: 6 }}>Select an RU from the top menu to view its topology.</p>
                </div>
              ) : (
                <><SensorListPanel devices={filteredDevices} /><UnitLayoutMap devices={apiDevices} onNodeClick={(d) => { setSelectedDevice(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></>
              )}
            </div>
          )}

          {tab === 'map' && (
            <div style={{ animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--t1)' }}>RU Map — {mapRu}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>Interactive physical positioning</div>
                </div>
                <DeviceMap devices={mapDevices} ruId={mapRu} selectedDevice={selectedDevice} onDeviceSelect={setSelectedDevice} warningThreshold={sysSettings?.warningThreshold} criticalThreshold={sysSettings?.criticalThreshold} onDeviceUpdate={() => loadDevices(activeRU === 'ALL' ? 'RU2' : activeRU)} />
              </div>
              {activeRU !== 'ALL' && <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 20 }}><UnitLayoutMap devices={apiDevices} onNodeClick={(d) => { setSelectedDevice(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></div>}
            </div>
          )}

          {tab === 'overview' && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Devices', value: totalDevices, icon: HardDrive, color: '#00D48A', sub: 'Across all RU sites', spark: [40, 50, 55, 60, 58, 62, 65], bg: 'bg-panel-green/20' },
                  { label: 'Online', value: onlineDevices, icon: Wifi, color: '#00D48A', sub: `${totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0}% active`, spark: [55, 57, 56, 58, 59, 58, 60], bg: 'bg-panel-navy/20' },
                  { label: 'Active Alerts', value: totalAlerts, icon: AlertTriangle, color: '#FF4D4D', sub: 'Require attention', spark: [12, 8, 10, 6, 9, 5, 7], bg: 'bg-panel-purple/20' },
                  { label: 'Avg Health', value: avgHealth, icon: Activity, color: '#38bdf8', sub: 'System index', spark: [88, 90, 89, 92, 91, 93, 92], suffix: '%', bg: 'bg-card-bg' },
                ].map((kpi, i) => {
                  const Icon = kpi.icon;
                  return (
                    <div 
                      key={i} 
                      className={`border border-card-border rounded-xl p-4 backdrop-blur-xl transition-all hover:scale-[1.02] duration-300 ${kpi.bg}`}
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[11px] text-t4 font-bold uppercase tracking-wider mb-1.5">{kpi.label}</div>
                          <div className="text-3xl font-bold leading-none" style={{ color: kpi.color }}>
                            <AnimNum value={kpi.value} suffix={kpi.suffix || ''} />
                          </div>
                          <div className="text-[11px] text-t3 mt-2 font-medium">{kpi.sub}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                            style={{ background: `${kpi.color}15` }}
                          >
                            <Icon size={16} style={{ color: kpi.color }} />
                          </div>
                          <Sparkline data={kpi.spark} color={kpi.color} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Timeline + Alerts */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
                <div className="bg-card-bg border border-card-border rounded-xl p-5 backdrop-blur-xl h-[300px] flex flex-col">
                  <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                      <div className="font-bold text-[15px] text-t1 tracking-tight">Gas Concentration Timeline</div>
                      <div className="text-[11px] text-t3 font-mono">24h rolling window (PPM)</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PulseDot color="#22d3ee" />
                      <span className="text-[11px] text-t4 font-mono font-bold uppercase tracking-wider">Live</span>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData}>
                        <defs>
                          <linearGradient id="ppmGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.04)" vertical={false} />
                        <XAxis dataKey="time" tick={{ fill: 'var(--t4)', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval={3} />
                        <YAxis tick={{ fill: 'var(--t4)', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="ppm" stroke="#22d3ee" strokeWidth={2} fill="url(#ppmGrad)" />
                        <Line type="monotone" dataKey="threshold" stroke="#ef4444" strokeWidth={1} strokeDasharray="6 3" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-card-bg border border-card-border rounded-xl p-5 backdrop-blur-xl flex flex-col h-[300px]">
                  <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div className="font-bold text-[15px] text-t1 tracking-tight">Recent Alerts</div>
                    <span className="text-[10px] font-bold text-status-offline bg-status-offline/10 px-2 py-0.5 rounded-md font-mono border border-status-offline/20 uppercase tracking-wider">
                      {totalAlerts} active
                    </span>
                  </div>
                  <div className="custom-scrollbar flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
                    {recentAlerts.map((a, i) => (
                      <div 
                        key={a.id} 
                        className="p-3 rounded-lg border transition-colors duration-200"
                        style={{ 
                          backgroundColor: `${severityColor(a.severity)}08`, 
                          borderColor: `${severityColor(a.severity)}15`,
                          animation: `fadeIn 0.4s ease ${i * 0.08}s both`
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: severityColor(a.severity) }} />
                          <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: severityColor(a.severity) }}>
                            {a.severity}
                          </span>
                          <span className="ml-auto text-[10px] text-t4 font-mono font-medium">{a.time}</span>
                        </div>
                        <div className="text-[12.5px] text-t2 font-medium leading-relaxed mb-2">{a.message}</div>
                        <div className="flex gap-3 items-center">
                          <span className="text-[10px] text-brand-cyan font-bold font-mono tracking-tight">{a.ru}</span>
                          <span className="text-[10px] text-t4 font-mono uppercase font-semibold">{a.device}</span>
                        </div>
                      </div>
                    ))}
                    {recentAlerts.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center text-t4 opacity-40">
                        <Shield size={32} className="mb-2" />
                        <div className="text-xs font-mono uppercase tracking-widest font-bold">System Clear</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-card-bg border border-card-border rounded-xl p-5 backdrop-blur-xl flex flex-col h-[260px]">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <div className="font-bold text-[15px] text-t1 tracking-tight">Hardware Distribution by RU</div>
                  <div className="text-[10px] text-t4 font-mono font-bold uppercase tracking-widest bg-card-bg-alt px-2 py-0.5 rounded border border-divider">
                    Multi-Site Index
                  </div>
                </div>
                <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-sidebar-bg/95 backdrop-blur-sm shadow-[0_1px_0_var(--divider)]">
                      <tr>
                        {['RU', 'Cluster Head', 'Gateway', 'Sensors', 'Total', 'Online', 'Health'].map((h) => (
                          <th key={h} className="text-left py-2.5 px-3 text-[10px] text-t4 font-bold uppercase tracking-widest font-mono border-b border-divider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/50">
                      {ruData.map((r, i) => (
                        <tr key={r.ru} className="hover:bg-card-bg-alt/50 transition-colors group">
                          <td className="py-3 px-3 font-mono text-[13px] font-bold text-brand-cyan group-hover:text-t1 transition-colors">{r.ru}</td>
                          <td className="py-3 px-3 font-mono text-[12px] text-t3">{r.clusterHead}</td>
                          <td className="py-3 px-3 font-mono text-[12px] text-t3">{r.gateway}</td>
                          <td className="py-3 px-3 font-mono text-[12px] text-t3">{r.nodeSensor}</td>
                          <td className="py-3 px-3 font-mono text-[13px] font-bold text-t2">{r.total}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3 w-[100px]">
                              <div className="flex-1 h-1.5 bg-card-bg-alt rounded-full overflow-hidden border border-white/5">
                                <div 
                                  className="h-full bg-gradient-to-r from-brand-navy to-brand-blue rounded-full transition-all duration-1000" 
                                  style={{ width: `${(r.online / r.total) * 100}%` }} 
                                />
                              </div>
                              <span className="font-mono text-[11px] font-bold text-brand-cyan">{r.online}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="health" value={r.health} className="text-[10px]" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'devices' && (
            <div className="flex flex-col gap-5 animate-fadeIn">
              <div className="flex justify-between items-center bg-card-bg border border-card-border p-4 rounded-xl backdrop-blur-md">
                <div>
                  <div className="font-bold text-lg text-t1 tracking-tight">Device Fleet Status</div>
                  <div className="text-[11px] text-t3 font-mono font-medium uppercase tracking-wider">
                    {filteredDevices.length} nodes active in <span className="text-brand-cyan">{activeRU}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1 bg-input-bg p-1 rounded-lg border border-card-border">
                    {['ALL', 'GATEWAY', 'CLUSTER', 'SENSOR'].map(type => (
                      <button 
                        key={type} 
                        onClick={() => setActiveType(type)} 
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold font-mono transition-all ${activeType === type ? 'bg-gradient-to-br from-brand-navy to-brand-blue text-white shadow-sm' : 'text-t4 hover:text-t2'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="relative group">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-t4 group-focus-within:text-brand-cyan transition-colors" />
                    <input 
                      placeholder="Search fleet..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      className="bg-input-bg border border-card-border rounded-lg py-2 pl-9 pr-4 text-t1 text-xs w-56 outline-none focus:border-brand-cyan/50 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden backdrop-blur-xl">
                <div className="overflow-x-auto max-h-[600px] custom-scrollbar overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-sidebar-bg/95 backdrop-blur-sm shadow-[0_1px_0_var(--divider)]">
                      <tr>
                        {[
                          { label: 'Entity', key: 'id' }, 
                          { label: 'Type', key: 'type' }, 
                          { label: 'Site', key: 'ru' }, 
                          { label: 'Battery', key: 'battery' }, 
                          { label: 'Signal', key: 'rssi' }, 
                          { label: 'Health', key: 'health' }, 
                          { label: 'Status', key: 'status' }, 
                          { label: 'Actions', key: 'actions' }
                        ].map((col) => (
                          <th 
                            key={col.key} 
                            onClick={() => { if (col.key !== 'actions') { if (sortCol === col.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortCol(col.key); setSortDir('asc'); } } }} 
                            className={`text-left py-3.5 px-4 text-[10px] text-t4 font-bold uppercase tracking-widest font-mono border-b border-divider ${col.key !== 'actions' ? 'cursor-pointer group hover:text-t2' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              {col.label}
                              {sortCol === col.key && <TrendingUp size={10} className={`text-brand-cyan transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} />}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/50">
                      {filteredDevices.map((d, i) => {
                        const Icon = typeIcon(d.type); 
                        const isAlert = d.latestPpm && d.latestPpm > (sysSettings?.warningThreshold || 50);
                        return (
                          <tr 
                            key={d.id} 
                            onClick={() => setSelectedDevice(d)} 
                            className={`hover:bg-card-bg-alt/50 transition-all cursor-pointer group ${selectedDevice?.id === d.id ? 'bg-brand-cyan/5 ring-1 ring-inset ring-brand-cyan/20' : ''}`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isAlert ? 'bg-status-offline/10 text-status-offline' : 'bg-brand-cyan/10 text-brand-cyan group-hover:bg-brand-cyan/20'}`}>
                                  <Icon size={16} />
                                </div>
                                <div>
                                  <div className="text-[13px] font-bold text-t1">{d.name}</div>
                                  <div className="text-[10px] text-t4 font-mono font-medium uppercase tracking-tight">{d.id.slice(-8).toUpperCase()}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-[11px] font-bold text-t2 font-mono uppercase">{d.type}</div>
                              <div className="text-[9px] text-t4 font-medium uppercase tracking-tighter">{d.type === 'CLUSTER' ? 'Mesh Hub' : d.type === 'GATEWAY' ? 'Root' : 'End Node'}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[11px] font-bold text-brand-cyan font-mono">{d.ruId}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-1.5 bg-card-bg-alt rounded-full overflow-hidden border border-white/5">
                                  <div className="h-full transition-all duration-1000" style={{ width: `${d.battery.soc}%`, backgroundColor: batteryColor(d.battery.soc) }} />
                                </div>
                                <span className="text-[11px] font-bold font-mono" style={{ color: batteryColor(d.battery.soc) }}>{d.battery.soc}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[11px] font-mono font-medium">
                              <span className={d.network.rssi > -60 ? 'text-brand-cyan' : 'text-status-warning'}>{d.network.rssi} dBm</span>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="health" value={d.healthScore} className="text-[9px]" />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <PulseDot color={statusColor(d.status)} size={5} />
                                <span className="text-[10px] font-bold font-mono tracking-wide" style={{ color: statusColor(d.status) }}>{d.status}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="text-[9px] h-7 px-3 font-bold tracking-widest"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeviceToRename(d);
                                  setNewDeviceName(d.name);
                                  setShowRenameModal(true);
                                }}
                              >
                                RENAME
                              </Button>
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

          {tab === 'alerts' && (
            <div style={{ animation: 'fadeIn 0.5s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                <div><h2 style={{ fontWeight: 600, fontSize: 20, color: 'var(--t1)' }}>Alarm Console</h2><p style={{ fontSize: 13, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>Active: {localAlerts.filter(a => a.status !== 'RESOLVED').length}</p></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {localAlerts.filter(a => activeRU === 'ALL' || a.ru === activeRU).map((a) => (
                  <div key={a.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: a.severity === 'CRITICAL' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={16} color={a.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'} /></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{a.ru} - {a.device}</span>
                          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#60a5fa', background: 'rgba(96,165,250,0.1)', padding: '1px 6px', borderRadius: 4 }}>{a.type}</span>
                          <span style={{ fontSize: 11, color: 'var(--t4)', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={10} />
                            {(() => {
                              const mins = Math.floor((Date.now() - new Date(a.time).getTime()) / 60000);
                              if (mins < 0 || isNaN(mins)) return 'Just now';
                              if (mins < 60) return `${mins}m ago`;
                              const hours = Math.floor(mins / 60);
                              if (hours < 24) return `${hours}h ${mins % 60}m ago`;
                              return `${Math.floor(hours / 24)}d ago`;
                            })()}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--t3)' }}>{a.message}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                       {a.status === 'ACTIVE' && <button onClick={() => handleUpdateAlertStatus(a.id, 'ACKNOWLEDGED')} style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '5px 12px', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Acknowledge</button>}
                       <button onClick={() => handleUpdateAlertStatus(a.id, 'RESOLVED')} style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '5px 12px', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Resolve</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'analytics' && (
            <div style={{ animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '18px 20px', backdropFilter: 'blur(12px)' }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--t1)' }}>Weekly Concentration Trend</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>Average gas levels (PPM) over 7 days</div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={analytics?.weeklyTrends || []}>
                      <defs>
                        <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.04)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: 'var(--t4)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--t4)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="avgPpm" stroke="#38bdf8" strokeWidth={2} fill="url(#colorTrend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '18px 20px', backdropFilter: 'blur(12px)' }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--t1)' }}>Weekly Incident Distribution</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>Threshold breaches per day</div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics?.weeklyTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.04)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: 'var(--t4)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--t4)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="alertCount" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '18px 20px', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', height: 240 }}>
                  <div style={{ marginBottom: 12, flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--t1)' }}>Site Performance Ranking</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>Efficiency & Safety Index</div>
                  </div>
                  <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr style={{ background: darkMode ? '#111' : '#fff' }}>
                          {['Site', 'Uptime', 'Events', 'Safety'].map((h) => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px', fontSize: 11, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: "'JetBrains Mono', monospace", borderBottom: '1px solid var(--divider)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analytics?.siteRankings.map((s, i) => (
                          <tr key={s.ru} style={{ background: i % 2 === 0 ? 'var(--card-bg-alt)' : 'transparent' }}>
                            <td style={{ padding: '8px', fontWeight: 700, color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{s.ru}</td>
                            <td style={{ padding: '8px', fontSize: 12, fontWeight: 600, color: 'var(--t2)', fontFamily: "'JetBrains Mono', monospace" }}>{s.uptime.toFixed(1)}%</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: s.incidents > 5 ? '#ef4444' : '#22c55e', background: s.incidents > 5 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 4 }}>{s.incidents} E</span>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', minWidth: 40 }}>
                                  <div style={{ width: `${Math.max(0, 100 - (s.incidents * 5))}%`, height: '100%', background: s.incidents > 5 ? '#ef4444' : '#22d3ee' }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)' }}>{Math.max(0, 100 - (s.incidents * 5))}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '18px 20px', backdropFilter: 'blur(12px)', height: 240 }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--t1)' }}>Connectivity Grade</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>Network quality distribution</div>
                  </div>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={networkQuality} layout="vertical" margin={{ left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.04)" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="grade" type="category" tick={{ fill: 'var(--t4)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {networkQuality.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div style={{ animation: 'fadeIn 0.5s ease', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: 24, margin: '0 auto', width: '100%' }}>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '24px 28px', backdropFilter: 'blur(12px)' }}>
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 24, color: 'var(--t1)' }}>System Configuration</h2>
                  <p style={{ fontSize: 14, color: 'var(--t3)', marginTop: 4 }}>Global parameters for sensors and alerting logic.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <AlertTriangle size={18} color="#f59e0b" />
                      <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--t2)' }}>Gas Alert Thresholds</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                      <div style={{ background: 'var(--card-bg-alt)', padding: 16, borderRadius: 12, border: '1px solid var(--divider)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontSize: 14, color: 'var(--t3)' }}>Warning Level</span>
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>{sysSettings?.warningThreshold} PPM</span>
                        </div>
                        <input 
                          type="range" min="10" max="100" step="1"
                          value={sysSettings?.warningThreshold || 50}
                          onChange={(e) => setSysSettings(s => s ? {...s, warningThreshold: parseInt(e.target.value)} : null)}
                          style={{ width: '100%', accentColor: '#f59e0b' }}
                        />
                        <p style={{ fontSize: 12, color: 'var(--t4)', marginTop: 8 }}>Triggers yellow status and warning alerts.</p>
                      </div>

                      <div style={{ background: 'var(--card-bg-alt)', padding: 16, borderRadius: 12, border: '1px solid var(--divider)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontSize: 14, color: 'var(--t3)' }}>Critical Level</span>
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', fontFamily: "'JetBrains Mono', monospace" }}>{sysSettings?.criticalThreshold} PPM</span>
                        </div>
                        <input 
                          type="range" min="10" max="200" step="1"
                          value={sysSettings?.criticalThreshold || 80}
                          onChange={(e) => setSysSettings(s => s ? {...s, criticalThreshold: parseInt(e.target.value)} : null)}
                          style={{ width: '100%', accentColor: '#ef4444' }}
                        />
                        <p style={{ fontSize: 12, color: 'var(--t4)', marginTop: 8 }}>Triggers red status and critical alarms.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <RefreshCw size={18} color="#22d3ee" />
                      <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--t2)' }}>Data Refresh Rate</span>
                    </div>
                    <div style={{ background: 'var(--card-bg-alt)', padding: 16, borderRadius: 12, border: '1px solid var(--divider)', maxWidth: '300px' }}>
                      <select 
                        value={sysSettings?.refreshInterval || 10}
                        onChange={(e) => setSysSettings(s => s ? {...s, refreshInterval: parseInt(e.target.value)} : null)}
                        style={{ width: '100%', background: 'var(--input-bg)', color: 'var(--t2)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '8px 12px', fontSize: 14 }}
                      >
                        <option value={5}>Every 5 seconds (Real-time)</option>
                        <option value={10}>Every 10 seconds (Balanced)</option>
                        <option value={30}>Every 30 seconds (Power Save)</option>
                        <option value={60}>Every 1 minute (Low Data)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--divider)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleUpdateSettings({
                        warningThreshold: sysSettings?.warningThreshold,
                        criticalThreshold: sysSettings?.criticalThreshold,
                        refreshInterval: sysSettings?.refreshInterval
                      })}
                      disabled={isSaving}
                      style={{
                        background: 'linear-gradient(135deg, #0e7490, #0284c7)',
                        color: '#fff', border: 'none', borderRadius: 8,
                        padding: '10px 24px', fontWeight: 600, cursor: 'pointer',
                        opacity: isSaving ? 0.7 : 1, transition: 'all 0.2s', fontSize: 14
                      }}
                    >
                      {isSaving ? 'Saving Changes...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '20px 22px', backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 24, color: 'var(--t1)' }}>User Management</div>
                    <div style={{ fontSize: 14, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      System administrators and RU-specific operators.
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddUser(true)}
                    style={{
                      background: 'linear-gradient(135deg, #0e7490, #0284c7)',
                      color: '#fff', border: 'none', borderRadius: 8,
                      padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    + Add Administrator
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                    <thead>
                      <tr>
                        {['User', 'RU Access', 'Role', 'Created', 'Actions'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px', fontSize: 12, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace", borderBottom: '1px solid var(--divider)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} style={{ background: 'var(--card-bg-alt)' }}>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a5f, #0e7490)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                                {u.email[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)' }}>{u.name || 'No Name'}</div>
                                <div style={{ fontSize: 12, color: 'var(--t4)', fontFamily: "'JetBrains Mono', monospace" }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>{u.ruId}</span>
                          </td>
                          <td style={{ padding: '12px 10px', fontSize: 13, color: 'var(--t3)' }}>{u.role}</td>
                          <td style={{ padding: '12px 10px', fontSize: 13, color: 'var(--t4)', fontFamily: "'JetBrains Mono', monospace" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {showAddUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: '400px', animation: 'fadeIn 0.3s ease' }}>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 20, color: 'var(--t1)', marginBottom: 20 }}>Add New Administrator</h3>
                    <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <input
                        placeholder="Email Address"
                        required
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--t1)', fontSize: 14 }}
                      />
                      <input
                        placeholder="Full Name"
                        value={newUser.name}
                        onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--t1)', fontSize: 14 }}
                      />
                      <input
                        placeholder="Password"
                        required
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--t1)', fontSize: 14 }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <select
                          value={newUser.ruId}
                          onChange={(e) => setNewUser({...newUser, ruId: e.target.value})}
                          style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--t1)', fontSize: 14 }}
                        >
                          {RU_LIST.map(ru => <option key={ru} value={ru}>{ru}</option>)}
                        </select>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                          style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--t1)', fontSize: 14 }}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="OPERATOR">OPERATOR</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                        <button type="button" onClick={() => setShowAddUser(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--t3)', borderRadius: 8, padding: '10px', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={isSaving} style={{ flex: 1, background: 'linear-gradient(135deg, #0e7490, #0284c7)', border: 'none', color: '#fff', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                          {isSaving ? 'Creating...' : 'Create User'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--divider)', marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><PulseDot color="#22d3ee" size={5} /><span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>System Live</span></div>
              <span style={{ fontSize: 11, color: 'var(--t4)', fontFamily: "'JetBrains Mono', monospace" }}>|</span>
              <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'JetBrains Mono', monospace" }}>v.2.1 Stable</span>
            </div>
          </div>
        </div>
      </main>

      {showRenameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: '400px', animation: 'fadeIn 0.3s ease' }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 20, color: 'var(--t1)', marginBottom: 8 }}>Rename Device</h3>
            <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>Modify display name for <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8' }}>{deviceToRename?.macAddress}</span></p>
            <form onSubmit={handleUpdateDeviceName} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--t4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Display Name</label>
                <input
                  autoFocus
                  placeholder="Kitchen Node 1"
                  required
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--t1)', fontSize: 14, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <button type="button" onClick={() => setShowRenameModal(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--t3)', borderRadius: 8, padding: '10px', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSaving} style={{ flex: 1, background: 'linear-gradient(135deg, #0e7490, #0284c7)', border: 'none', color: '#fff', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                  {isSaving ? 'Updating...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
