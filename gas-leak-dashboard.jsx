import { useState, useEffect, useRef } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from "recharts";
import { Activity, AlertTriangle, Battery, BatteryLow, BellRing, ChevronDown, ChevronRight, Circle, Clock, Cpu, Database, Flame, Globe, HardDrive, Layers, LayoutDashboard, Map, MapPin, MoreHorizontal, Radio, RefreshCw, Search, Server, Settings, Shield, Signal, Thermometer, TrendingUp, Users, Wifi, Zap } from "lucide-react";

// ─── DATA ────────────────────────────────────────────────────────────────────
const RU_DATA = [
  { ru: "RU2", clusterHead: 3, gateway: 1, nodeSensor: 10, thermalCam: 1, total: 15, online: 14, alerts: 2, health: 94 },
  { ru: "RU3", clusterHead: 3, gateway: 1, nodeSensor: 4, thermalCam: 1, total: 9, online: 8, alerts: 1, health: 91 },
  { ru: "RU4", clusterHead: 2, gateway: 1, nodeSensor: 3, thermalCam: 1, total: 7, online: 7, alerts: 0, health: 98 },
  { ru: "RU5", clusterHead: 3, gateway: 1, nodeSensor: 2, thermalCam: 1, total: 7, online: 6, alerts: 1, health: 87 },
  { ru: "RU6", clusterHead: 2, gateway: 2, nodeSensor: 4, thermalCam: 1, total: 9, online: 9, alerts: 0, health: 96 },
  { ru: "RU7", clusterHead: 11, gateway: 1, nodeSensor: 5, thermalCam: 1, total: 18, online: 16, alerts: 3, health: 89 },
];

const TIMELINE_DATA = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  ppm: Math.floor(Math.random() * 40 + 5),
  threshold: 50,
  alerts: i >= 6 && i <= 18 ? Math.floor(Math.random() * 4) : Math.floor(Math.random() * 2),
  temperature: Math.floor(Math.random() * 8 + 28),
}));

const BATTERY_DIST = [
  { range: "0-20%", count: 3, fill: "#ef4444" },
  { range: "21-40%", count: 5, fill: "#f97316" },
  { range: "41-60%", count: 12, fill: "#eab308" },
  { range: "61-80%", count: 22, fill: "#3b82f6" },
  { range: "81-100%", count: 23, fill: "#22d3ee" },
];

const NETWORK_QUALITY = [
  { grade: "A", count: 28, fill: "#22d3ee" },
  { grade: "B", count: 18, fill: "#3b82f6" },
  { grade: "C", count: 12, fill: "#6366f1" },
  { grade: "D", count: 5, fill: "#f97316" },
  { grade: "F", count: 2, fill: "#ef4444" },
];

const RADAR_DATA = [
  { metric: "Uptime", RU2: 94, RU3: 91, RU7: 89 },
  { metric: "Battery", RU2: 88, RU3: 82, RU7: 76 },
  { metric: "Signal", RU2: 90, RU3: 85, RU7: 78 },
  { metric: "Health", RU2: 94, RU3: 91, RU7: 89 },
  { metric: "Response", RU2: 96, RU3: 93, RU7: 85 },
  { metric: "Coverage", RU2: 92, RU3: 88, RU7: 90 },
];

const DEVICES = [
  { id: "SNS-001", name: "Sensor-001", ru: "RU2", type: "SENSOR", location: "Tank Farm A", battery: 87, rssi: -62, health: 98, status: "ONLINE", peers: 4, hops: 1, uptime: "124h", fw: "2.4.1" },
  { id: "SNS-002", name: "Sensor-002", ru: "RU2", type: "SENSOR", location: "Pipe Corridor B", battery: 23, rssi: -78, health: 64, status: "ONLINE", peers: 3, hops: 2, uptime: "89h", fw: "2.4.1" },
  { id: "CLH-001", name: "Cluster-001", ru: "RU7", type: "CLUSTER", location: "Control Room", battery: 95, rssi: -45, health: 100, status: "ONLINE", peers: 6, hops: 1, uptime: "312h", fw: "3.1.0" },
  { id: "GTW-001", name: "Gateway-001", ru: "RU2", type: "GATEWAY", location: "Main Building", battery: null, rssi: -30, health: 100, status: "ONLINE", peers: 12, hops: 0, uptime: "720h", fw: "4.0.2" },
  { id: "THR-001", name: "Thermal-001", ru: "RU7", type: "THERMAL", location: "Flare Stack", battery: 72, rssi: -55, health: 91, status: "ONLINE", peers: 5, hops: 1, uptime: "206h", fw: "1.8.3" },
  { id: "SNS-003", name: "Sensor-003", ru: "RU3", type: "SENSOR", location: "Loading Dock C", battery: 45, rssi: -82, health: 76, status: "ONLINE", peers: 2, hops: 3, uptime: "67h", fw: "2.3.9" },
  { id: "SNS-004", name: "Sensor-004", ru: "RU6", type: "SENSOR", location: "Compressor Area", battery: 91, rssi: -51, health: 97, status: "ONLINE", peers: 5, hops: 1, uptime: "156h", fw: "2.4.1" },
  { id: "CLH-002", name: "Cluster-002", ru: "RU5", type: "CLUSTER", location: "Pump Station D", battery: 15, rssi: -88, health: 42, status: "MAINTENANCE", peers: 1, hops: 4, uptime: "12h", fw: "3.0.8" },
  { id: "SNS-005", name: "Sensor-005", ru: "RU4", type: "SENSOR", location: "Storage Tank E", battery: 68, rssi: -67, health: 85, status: "ONLINE", peers: 4, hops: 2, uptime: "203h", fw: "2.4.0" },
  { id: "THR-002", name: "Thermal-002", ru: "RU3", type: "THERMAL", location: "Reactor Zone", battery: 56, rssi: -71, health: 80, status: "OFFLINE", peers: 0, hops: 0, uptime: "0h", fw: "1.8.3" },
];

const ALERTS_RECENT = [
  { id: 1, severity: "CRITICAL", message: "H₂S concentration exceeded 50 ppm at Tank Farm A", ru: "RU2", time: "2 min ago", device: "SNS-001" },
  { id: 2, severity: "WARNING", message: "Battery critically low on Cluster-002 (15%)", ru: "RU5", time: "8 min ago", device: "CLH-002" },
  { id: 3, severity: "CRITICAL", message: "Thermal anomaly detected near Flare Stack", ru: "RU7", time: "15 min ago", device: "THR-001" },
  { id: 4, severity: "INFO", message: "Device Thermal-002 went offline", ru: "RU3", time: "23 min ago", device: "THR-002" },
  { id: 5, severity: "WARNING", message: "Weak mesh signal on Sensor-003 (RSSI: -82dBm)", ru: "RU3", time: "31 min ago", device: "SNS-003" },
];

const MONTHLY_EVENTS = [
  { month: "Sep", leaks: 2, falseAlarms: 5, maintenance: 8 },
  { month: "Oct", leaks: 1, falseAlarms: 3, maintenance: 12 },
  { month: "Nov", leaks: 3, falseAlarms: 4, maintenance: 6 },
  { month: "Dec", leaks: 0, falseAlarms: 2, maintenance: 15 },
  { month: "Jan", leaks: 1, falseAlarms: 6, maintenance: 9 },
  { month: "Feb", leaks: 2, falseAlarms: 3, maintenance: 11 },
  { month: "Mar", leaks: 1, falseAlarms: 1, maintenance: 7 },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const statusColor = (s) => s === "ONLINE" ? "#22d3ee" : s === "OFFLINE" ? "#ef4444" : "#f59e0b";
const healthColor = (h) => h >= 80 ? "#22d3ee" : h >= 50 ? "#f59e0b" : "#ef4444";
const batteryColor = (b) => b === null ? "#64748b" : b >= 60 ? "#22d3ee" : b >= 30 ? "#f59e0b" : "#ef4444";
const severityColor = (s) => s === "CRITICAL" ? "#ef4444" : s === "WARNING" ? "#f59e0b" : "#3b82f6";
const typeIcon = (t) => t === "SENSOR" ? Radio : t === "CLUSTER" ? Cpu : t === "GATEWAY" ? Server : Thermometer;

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, padding: "10px 14px", backdropFilter: "blur(12px)" }}>
      <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#22d3ee", fontSize: 12, margin: "2px 0", fontFamily: "'JetBrains Mono', monospace" }}>
          {p.name}: <span style={{ fontWeight: 700 }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ─── ANIMATED NUMBER ─────────────────────────────────────────────────────────
function AnimNum({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.floor(value / 30));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 25);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}{suffix}</>;
}

// ─── LIVE CLOCK ──────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#94a3b8", letterSpacing: 1 }}>
      {time.toLocaleTimeString("en-GB")} WIB
    </span>
  );
}

// ─── SPARKLINE ───────────────────────────────────────────────────────────────
function Sparkline({ data, color = "#22d3ee", h = 28 }) {
  const w = 80;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── PULSE DOT ───────────────────────────────────────────────────────────────
function PulseDot({ color = "#22d3ee", size = 8 }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%", background: color,
        animation: "pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite", opacity: 0.4,
      }} />
      <span style={{ position: "absolute", inset: 1, borderRadius: "50%", background: color }} />
    </span>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────
export default function GasLeakDashboard() {
  const [activeRU, setActiveRU] = useState("ALL");
  const [tab, setTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState("health");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const filteredDevices = DEVICES
    .filter(d => activeRU === "ALL" || d.ru === activeRU)
    .filter(d => !searchTerm || d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.location.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const v = sortDir === "asc" ? 1 : -1;
      if (sortCol === "health") return (a.health - b.health) * v;
      if (sortCol === "battery") return ((a.battery || 0) - (b.battery || 0)) * v;
      if (sortCol === "rssi") return (a.rssi - b.rssi) * v;
      return 0;
    });

  const totalDevices = 65;
  const onlineDevices = RU_DATA.reduce((s, r) => s + r.online, 0);
  const totalAlerts = RU_DATA.reduce((s, r) => s + r.alerts, 0);
  const avgHealth = Math.round(RU_DATA.reduce((s, r) => s + r.health, 0) / RU_DATA.length);

  const sidebarItems = [
    { icon: LayoutDashboard, label: "Overview", key: "overview" },
    { icon: HardDrive, label: "Devices", key: "devices" },
    { icon: Map, label: "Map View", key: "map" },
    { icon: AlertTriangle, label: "Alerts", key: "alerts" },
    { icon: TrendingUp, label: "Analytics", key: "analytics" },
    { icon: Users, label: "Users", key: "users" },
    { icon: Settings, label: "Settings", key: "settings" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #020617 0%, #0a1628 40%, #0c1a30 70%, #020617 100%)",
      color: "#e2e8f0",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      display: "flex",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        @keyframes pulse-ring { 0%,100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(2.2); opacity: 0; } }
        @keyframes scanline { 0% { top: -100%; } 100% { top: 200%; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 8px rgba(34,211,238,0.15); } 50% { box-shadow: 0 0 20px rgba(34,211,238,0.3); } }
        @keyframes borderGlow { 0%,100% { border-color: rgba(34,211,238,0.15); } 50% { border-color: rgba(34,211,238,0.35); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.2); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(56,189,248,0.4); }
      `}</style>

      {/* ── BACKGROUND FX ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", left: "20%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,116,144,0.08) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }} />
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.03 }}>
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#38bdf8" strokeWidth="0.5" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* ── SIDEBAR ── */}
      <nav style={{
        width: sidebarCollapsed ? 64 : 220,
        minHeight: "100vh",
        background: "rgba(8,15,30,0.85)",
        borderRight: "1px solid rgba(56,189,248,0.08)",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 0",
        transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
        zIndex: 20,
        position: "relative",
        flexShrink: 0,
      }}>
        {/* LOGO */}
        <div
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", marginBottom: 24, cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #0e7490, #0284c7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(14,116,144,0.3)",
            flexShrink: 0,
          }}>
            <Flame size={18} color="#fff" />
          </div>
          {!sidebarCollapsed && (
            <div style={{ animation: "slideRight 0.3s ease" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: "#f0f9ff", letterSpacing: -0.5 }}>GASGUARD</div>
              <div style={{ fontSize: 9, color: "#38bdf8", letterSpacing: 2, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>MULTI-RU v2.1</div>
            </div>
          )}
        </div>

        {/* NAV ITEMS */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {sidebarItems.map(item => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <div
                key={item.key}
                onClick={() => setTab(item.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: sidebarCollapsed ? "11px 0" : "11px 16px",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  margin: "0 8px", borderRadius: 8, cursor: "pointer",
                  background: active ? "rgba(14,116,144,0.15)" : "transparent",
                  borderLeft: active ? "2px solid #22d3ee" : "2px solid transparent",
                  color: active ? "#22d3ee" : "#64748b",
                  transition: "all 0.2s",
                  position: "relative",
                }}
              >
                <Icon size={18} />
                {!sidebarCollapsed && (
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: "'Outfit', sans-serif" }}>{item.label}</span>
                )}
                {item.key === "alerts" && totalAlerts > 0 && (
                  <span style={{
                    position: sidebarCollapsed ? "absolute" : "relative",
                    top: sidebarCollapsed ? 6 : "auto",
                    right: sidebarCollapsed ? 10 : "auto",
                    marginLeft: sidebarCollapsed ? 0 : "auto",
                    background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700,
                    padding: "1px 5px", borderRadius: 10, fontFamily: "'JetBrains Mono', monospace",
                  }}>{totalAlerts}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* SIDEBAR FOOTER */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(56,189,248,0.08)" }}>
          {!sidebarCollapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a5f, #0e7490)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={13} color="#22d3ee" />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#cbd5e1", fontFamily: "'Outfit', sans-serif" }}>Admin</div>
                <div style={{ fontSize: 9, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>Global_Admin</div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, zIndex: 10, position: "relative" }}>

        {/* ── TOP BAR ── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 28px",
          background: "rgba(8,15,30,0.6)",
          borderBottom: "1px solid rgba(56,189,248,0.06)",
          backdropFilter: "blur(12px)",
        }}>
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 22, color: "#f0f9ff", letterSpacing: -0.5 }}>
              {tab === "overview" ? "Command Center" : tab === "devices" ? "Device Fleet" : tab === "alerts" ? "Alert Console" : tab === "analytics" ? "Analytics" : "Dashboard"}
            </h1>
            <p style={{ fontSize: 12, color: "#475569", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
              RU VII Kasim — Gas Leak Detection Monitoring System
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LiveClock />
            <div style={{ display: "flex", gap: 4, background: "rgba(15,23,42,0.8)", borderRadius: 8, padding: 3, border: "1px solid rgba(56,189,248,0.08)" }}>
              {["ALL", "RU2", "RU3", "RU4", "RU5", "RU6", "RU7"].map(ru => (
                <button
                  key={ru}
                  onClick={() => setActiveRU(ru)}
                  style={{
                    padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                    background: activeRU === ru ? "linear-gradient(135deg, #0e7490, #0284c7)" : "transparent",
                    color: activeRU === ru ? "#fff" : "#64748b",
                    transition: "all 0.2s",
                  }}
                >{ru}</button>
              ))}
            </div>
            <div style={{ position: "relative" }}>
              <BellRing size={18} color="#64748b" style={{ cursor: "pointer" }} />
              {totalAlerts > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #020617" }} />}
            </div>
          </div>
        </header>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── KPI ROW ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, animation: "fadeIn 0.5s ease" }}>
            {[
              { label: "Total Devices", value: totalDevices, icon: HardDrive, color: "#22d3ee", sub: "Across 6 RU sites", spark: [40,50,55,60,58,62,65] },
              { label: "Online", value: onlineDevices, icon: Wifi, color: "#34d399", sub: `${Math.round(onlineDevices/totalDevices*100)}% connectivity`, spark: [55,57,56,58,59,58,60] },
              { label: "Active Alerts", value: totalAlerts, icon: AlertTriangle, color: "#f59e0b", sub: "2 critical, 5 warning", spark: [12,8,10,6,9,5,7] },
              { label: "Avg Health", value: avgHealth, icon: Activity, color: "#38bdf8", sub: "System performance index", spark: [88,90,89,92,91,93,92], suffix: "%" },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} style={{
                  background: "rgba(15,23,42,0.5)",
                  border: "1px solid rgba(56,189,248,0.08)",
                  borderRadius: 14, padding: "20px 22px",
                  backdropFilter: "blur(12px)",
                  position: "relative",
                  overflow: "hidden",
                  animation: `fadeIn 0.5s ease ${i * 0.1}s both`,
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${kpi.color}40, transparent)` }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Outfit', sans-serif" }}>{kpi.label}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700, color: kpi.color, lineHeight: 1 }}>
                        <AnimNum value={kpi.value} suffix={kpi.suffix || ""} />
                      </div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>{kpi.sub}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${kpi.color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={18} color={kpi.color} />
                      </div>
                      <Sparkline data={kpi.spark} color={kpi.color} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── ROW 2: TIMELINE + ALERTS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, animation: "fadeIn 0.6s ease 0.2s both" }}>

            {/* GAS CONCENTRATION TIMELINE */}
            <div style={{
              background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,189,248,0.08)",
              borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(12px)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: "#f0f9ff" }}>Gas Concentration Timeline</div>
                  <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>24h rolling window — ppm levels</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <PulseDot color="#22d3ee" />
                  <span style={{ fontSize: 10, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>LIVE</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={TIMELINE_DATA}>
                  <defs>
                    <linearGradient id="ppmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" />
                  <XAxis dataKey="time" tick={{ fill: "#475569", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: "rgba(56,189,248,0.1)" }} tickLine={false} interval={3} />
                  <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="ppm" stroke="#22d3ee" strokeWidth={2} fill="url(#ppmGrad)" name="PPM" />
                  <Line type="monotone" dataKey="threshold" stroke="#ef4444" strokeWidth={1} strokeDasharray="6 3" dot={false} name="Threshold" />
                  <Area type="monotone" dataKey="alerts" stroke="#f59e0b" strokeWidth={1.5} fill="url(#alertGrad)" name="Alerts" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* RECENT ALERTS */}
            <div style={{
              background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,189,248,0.08)",
              borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(12px)",
              display: "flex", flexDirection: "column",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: "#f0f9ff" }}>Recent Alerts</div>
                <span style={{ fontSize: 10, color: "#64748b", fontFamily: "'JetBrains Mono', monospace", background: "rgba(239,68,68,0.1)", padding: "3px 8px", borderRadius: 6, color: "#ef4444" }}>{totalAlerts} active</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {ALERTS_RECENT.map((a, i) => (
                  <div key={a.id} style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: `${severityColor(a.severity)}08`,
                    border: `1px solid ${severityColor(a.severity)}18`,
                    animation: `fadeIn 0.4s ease ${i * 0.08}s both`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: severityColor(a.severity), flexShrink: 0 }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: severityColor(a.severity), fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{a.severity}</span>
                      <span style={{ marginLeft: "auto", fontSize: 9, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{a.time}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>{a.message}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 9, color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace" }}>{a.ru}</span>
                      <span style={{ fontSize: 9, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{a.device}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── ROW 3: RU DISTRIBUTION TABLE + RADAR + PIE ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px 280px", gap: 16, animation: "fadeIn 0.6s ease 0.3s both" }}>

            {/* RU TABLE */}
            <div style={{
              background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,189,248,0.08)",
              borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(12px)", overflow: "hidden",
            }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: "#f0f9ff", marginBottom: 14 }}>Hardware Distribution by RU</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                  <thead>
                    <tr>
                      {["RU", "Cluster Head", "Gateway", "Sensors", "Thermal", "Total", "Online", "Health"].map(h => (
                        <th key={h} style={{
                          textAlign: "left", padding: "8px 10px", fontSize: 10,
                          color: "#475569", fontWeight: 600, textTransform: "uppercase",
                          letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace",
                          borderBottom: "1px solid rgba(56,189,248,0.06)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RU_DATA.map((r, i) => (
                      <tr key={r.ru} style={{
                        background: i % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent",
                        transition: "background 0.2s",
                      }}>
                        <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>{r.ru}</td>
                        <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3b8" }}>{r.clusterHead}</td>
                        <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3b8" }}>{r.gateway}</td>
                        <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3b8" }}>{r.nodeSensor}</td>
                        <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3b8" }}>{r.thermalCam}</td>
                        <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{r.total}</td>
                        <td style={{ padding: "10px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 50, height: 5, borderRadius: 10, background: "rgba(56,189,248,0.1)", overflow: "hidden" }}>
                              <div style={{ width: `${(r.online / r.total) * 100}%`, height: "100%", borderRadius: 10, background: "linear-gradient(90deg, #22d3ee, #0284c7)", transition: "width 1s ease" }} />
                            </div>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#22d3ee" }}>{r.online}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
                            color: healthColor(r.health),
                            background: `${healthColor(r.health)}15`,
                            padding: "3px 8px", borderRadius: 6,
                          }}>{r.health}%</span>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "1px solid rgba(56,189,248,0.15)" }}>
                      <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#22d3ee" }}>TOTAL</td>
                      <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>24</td>
                      <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>8</td>
                      <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>28</td>
                      <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>7</td>
                      <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#22d3ee" }}>65</td>
                      <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#22d3ee" }}>{onlineDevices}</td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "#22d3ee", background: "rgba(34,211,238,0.1)", padding: "3px 8px", borderRadius: 6 }}>{avgHealth}%</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* RADAR CHART */}
            <div style={{
              background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,189,248,0.08)",
              borderRadius: 14, padding: "20px 18px", backdropFilter: "blur(12px)",
            }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: "#f0f9ff", marginBottom: 6 }}>RU Performance</div>
              <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>Comparative metrics</div>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={RADAR_DATA}>
                  <PolarGrid stroke="rgba(56,189,248,0.1)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#64748b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar name="RU2" dataKey="RU2" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} strokeWidth={1.5} />
                  <Radar name="RU3" dataKey="RU3" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={1.5} />
                  <Radar name="RU7" dataKey="RU7" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.08} strokeWidth={1.5} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* BATTERY DISTRIBUTION PIE */}
            <div style={{
              background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,189,248,0.08)",
              borderRadius: 14, padding: "20px 18px", backdropFilter: "blur(12px)",
            }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: "#f0f9ff", marginBottom: 6 }}>Battery Distribution</div>
              <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>Fleet charge levels</div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={BATTERY_DIST} dataKey="count" nameKey="range" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} strokeWidth={0}>
                    {BATTERY_DIST.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {BATTERY_DIST.map(b => (
                  <div key={b.range} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: b.fill, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>{b.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── ROW 4: DEVICE TABLE + MONTHLY ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, animation: "fadeIn 0.6s ease 0.4s both" }}>

            {/* DEVICE TABLE */}
            <div style={{
              background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,189,248,0.08)",
              borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(12px)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: "#f0f9ff" }}>Device Fleet Status</div>
                  <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>Real-time monitoring — {filteredDevices.length} devices</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative" }}>
                    <Search size={14} color="#475569" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search devices..."
                      style={{
                        background: "rgba(15,23,42,0.8)", border: "1px solid rgba(56,189,248,0.1)",
                        borderRadius: 8, padding: "6px 10px 6px 28px", color: "#e2e8f0",
                        fontSize: 11, fontFamily: "'JetBrains Mono', monospace", outline: "none", width: 180,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px" }}>
                  <thead>
                    <tr>
                      {[
                        { key: "name", label: "DEVICE" },
                        { key: "type", label: "TYPE" },
                        { key: "ru", label: "RU" },
                        { key: "location", label: "LOCATION" },
                        { key: "battery", label: "BATTERY" },
                        { key: "rssi", label: "RSSI" },
                        { key: "health", label: "HEALTH" },
                        { key: "status", label: "STATUS" },
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => { setSortCol(col.key); setSortDir(d => d === "asc" ? "desc" : "asc"); }}
                          style={{
                            textAlign: "left", padding: "8px 8px", fontSize: 9,
                            color: sortCol === col.key ? "#38bdf8" : "#475569",
                            fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2,
                            fontFamily: "'JetBrains Mono', monospace", cursor: "pointer",
                            borderBottom: "1px solid rgba(56,189,248,0.06)", whiteSpace: "nowrap",
                          }}
                        >
                          {col.label} {sortCol === col.key && (sortDir === "asc" ? "↑" : "↓")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map((d, i) => {
                      const TIcon = typeIcon(d.type);
                      return (
                        <tr
                          key={d.id}
                          onClick={() => setSelectedDevice(selectedDevice?.id === d.id ? null : d)}
                          style={{
                            background: selectedDevice?.id === d.id ? "rgba(14,116,144,0.1)" : i % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          <td style={{ padding: "9px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 26, height: 26, borderRadius: 6, background: `${statusColor(d.status)}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <TIcon size={13} color={statusColor(d.status)} />
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", fontFamily: "'Outfit', sans-serif" }}>{d.name}</div>
                                <div style={{ fontSize: 9, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{d.id}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "9px 8px", fontSize: 10, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>{d.type}</td>
                          <td style={{ padding: "9px 8px", fontSize: 11, fontWeight: 600, color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace" }}>{d.ru}</td>
                          <td style={{ padding: "9px 8px", fontSize: 11, color: "#94a3b8" }}>{d.location}</td>
                          <td style={{ padding: "9px 8px" }}>
                            {d.battery !== null ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 36, height: 6, borderRadius: 10, background: "rgba(56,189,248,0.08)", overflow: "hidden" }}>
                                  <div style={{ width: `${d.battery}%`, height: "100%", borderRadius: 10, background: batteryColor(d.battery), transition: "width 0.5s" }} />
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, color: batteryColor(d.battery), fontFamily: "'JetBrains Mono', monospace" }}>{d.battery}%</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>AC</span>
                            )}
                          </td>
                          <td style={{ padding: "9px 8px", fontSize: 10, color: d.rssi > -60 ? "#22d3ee" : d.rssi > -80 ? "#f59e0b" : "#ef4444", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{d.rssi} dBm</td>
                          <td style={{ padding: "9px 8px" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                              color: healthColor(d.health),
                              background: `${healthColor(d.health)}12`,
                              padding: "2px 7px", borderRadius: 5,
                            }}>{d.health}%</span>
                          </td>
                          <td style={{ padding: "9px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <PulseDot color={statusColor(d.status)} size={6} />
                              <span style={{ fontSize: 10, color: statusColor(d.status), fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{d.status}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* EXPANDED DEVICE DETAIL */}
              {selectedDevice && (
                <div style={{
                  marginTop: 12, padding: 16, borderRadius: 10,
                  background: "rgba(14,116,144,0.06)", border: "1px solid rgba(34,211,238,0.12)",
                  animation: "fadeIn 0.3s ease",
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {[
                      { label: "Firmware", value: selectedDevice.fw, icon: Cpu },
                      { label: "Uptime", value: selectedDevice.uptime, icon: Clock },
                      { label: "Peers", value: `${selectedDevice.peers} connected`, icon: Users },
                      { label: "Hops to GW", value: selectedDevice.hops, icon: Layers },
                    ].map((m, i) => {
                      const MIcon = m.icon;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <MIcon size={14} color="#38bdf8" />
                          <div>
                            <div style={{ fontSize: 9, color: "#475569", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 1 }}>{m.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* MONTHLY EVENTS BAR + NETWORK QUALITY */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{
                background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,189,248,0.08)",
                borderRadius: 14, padding: "20px 18px", backdropFilter: "blur(12px)", flex: 1,
              }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: "#f0f9ff", marginBottom: 4 }}>Monthly Events</div>
                <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>Leak / False Alarm / Maintenance</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={MONTHLY_EVENTS} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="leaks" fill="#ef4444" name="Leaks" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="falseAlarms" fill="#f59e0b" name="False Alarms" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="maintenance" fill="#3b82f6" name="Maintenance" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* NETWORK QUALITY */}
              <div style={{
                background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,189,248,0.08)",
                borderRadius: 14, padding: "16px 18px", backdropFilter: "blur(12px)",
              }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 14, color: "#f0f9ff", marginBottom: 10 }}>Network Quality</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {NETWORK_QUALITY.map(n => (
                    <div key={n.grade} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{
                        height: 50, borderRadius: 6, display: "flex", flexDirection: "column", justifyContent: "flex-end",
                        background: "rgba(15,23,42,0.5)", overflow: "hidden", marginBottom: 6,
                      }}>
                        <div style={{
                          height: `${(n.count / 30) * 100}%`,
                          background: `linear-gradient(180deg, ${n.fill}, ${n.fill}60)`,
                          borderRadius: "4px 4px 0 0",
                          transition: "height 1s ease",
                        }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: n.fill, fontFamily: "'JetBrains Mono', monospace" }}>{n.grade}</div>
                      <div style={{ fontSize: 9, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{n.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0", borderTop: "1px solid rgba(56,189,248,0.06)",
            marginTop: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PulseDot color="#22d3ee" />
                <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>System Operational</span>
              </div>
              <span style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>|</span>
              <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>MQTT: <span style={{ color: "#22d3ee" }}>Connected</span></span>
              <span style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>|</span>
              <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>Kafka: <span style={{ color: "#22d3ee" }}>Streaming</span></span>
              <span style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>|</span>
              <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>DB: <span style={{ color: "#22d3ee" }}>TimescaleDB</span></span>
            </div>
            <div style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>
              GASGUARD v2.1 — RU VII Kasim
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
