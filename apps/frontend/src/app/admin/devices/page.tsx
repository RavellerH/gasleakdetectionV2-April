'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchAllDevices, fetchUsers, createDevice, updateDevice, deleteDevice, type Device, type User } from '@/lib/graphql';

const DEVICE_TYPES = ['SENSOR', 'ROUTING_NODE', 'CLUSTER_HEAD', 'GATEWAY'];
const STATUS_OPTIONS = ['ONLINE', 'OFFLINE', 'WARNING'];
const RU_OPTIONS = ['RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];

const TYPE_COLORS: Record<string, string> = {
  SENSOR: '#38bdf8',
  ROUTING_NODE: '#a78bfa',
  CLUSTER_HEAD: '#f59e0b',
  GATEWAY: '#22c55e',
};

const STATUS_COLORS: Record<string, string> = {
  ONLINE: '#22c55e',
  OFFLINE: '#ef4444',
  WARNING: '#f59e0b',
};

type ModalMode = 'create' | 'edit' | null;

interface FormState {
  macAddress: string;
  name: string;
  deviceType: string;
  ruId: string;
  status: string;
  lat: string;
  lng: string;
}

const EMPTY_FORM: FormState = {
  macAddress: '', name: '', deviceType: 'SENSOR',
  ruId: 'RU2', status: 'ONLINE', lat: '0', lng: '0',
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRu, setFilterRu] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [modal, setModal] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<Device | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('gld_user');
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const devs = await fetchAllDevices();
      setDevices(devs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isSuperAdmin = currentUser?.ruId === 'ALL';

  const visibleRuOptions = isSuperAdmin ? RU_OPTIONS : currentUser ? [currentUser.ruId] : [];

  const filtered = devices.filter(d => {
    if (!isSuperAdmin && d.ruId !== currentUser?.ruId) return false;
    if (filterRu !== 'ALL' && d.ruId !== filterRu) return false;
    if (filterType !== 'ALL' && d.type !== filterType) return false;
    if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.macAddress.toLowerCase().includes(q);
    }
    return true;
  });

  function openCreate() {
    setForm({ ...EMPTY_FORM, ruId: isSuperAdmin ? 'RU2' : (currentUser?.ruId ?? 'RU2') });
    setEditTarget(null);
    setModal('create');
  }

  function openEdit(d: Device) {
    setForm({
      macAddress: d.macAddress,
      name: d.name,
      deviceType: d.type,
      ruId: d.ruId,
      status: d.status,
      lat: String(d.location.lat),
      lng: String(d.location.lng),
    });
    setEditTarget(d);
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setSubmitting(true);
    try {
      if (modal === 'create') {
        await createDevice({
          macAddress: form.macAddress || `AUTO-${Date.now()}`,
          name: form.name,
          deviceType: form.deviceType,
          ruId: form.ruId,
          location: { lat: parseFloat(form.lat) || 0, lng: parseFloat(form.lng) || 0 },
          registeredBy: currentUser?.id ?? '',
        });
      } else if (modal === 'edit' && editTarget) {
        await updateDevice(editTarget.id, {
          name: form.name,
          deviceType: form.deviceType,
          ruId: isSuperAdmin ? form.ruId : undefined,
          status: form.status,
        });
      }
      closeModal();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(d: Device) {
    if (!confirm(`Delete device "${d.name}" (${d.macAddress})?`)) return;
    try {
      await deleteDevice(d.id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const healthColor = (h: number) => h >= 80 ? '#22c55e' : h >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>Device Management</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>
            {isSuperAdmin ? 'All RUs' : `Scoped to ${currentUser?.ruId}`} · {filtered.length} device{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openCreate} style={btnStyle('#2563eb')}>
          + Register Device
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total', value: filtered.length, color: 'var(--accent)' },
          { label: 'Online', value: filtered.filter(d => d.status === 'ONLINE').length, color: '#22c55e' },
          { label: 'Offline', value: filtered.filter(d => d.status === 'OFFLINE').length, color: '#ef4444' },
          { label: 'Sensors', value: filtered.filter(d => d.type === 'SENSOR').length, color: '#38bdf8' },
          { label: 'Gateways', value: filtered.filter(d => d.type === 'GATEWAY').length, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name or MAC…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle({ width: 240 })}
        />
        {isSuperAdmin && (
          <select value={filterRu} onChange={e => setFilterRu(e.target.value)} style={inputStyle({})}>
            <option value="ALL">All RUs</option>
            {RU_OPTIONS.map(r => <option key={r}>{r}</option>)}
          </select>
        )}
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inputStyle({})}>
          <option value="ALL">All types</option>
          {DEVICE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle({})}>
          <option value="ALL">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)' }}>No devices found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--divider)' }}>
                {['Name / MAC', 'Type', 'RU', 'Status', 'Health', 'Location', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500, color: 'var(--t1)', fontSize: 13 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2, fontFamily: 'monospace' }}>{d.macAddress}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                      background: `${TYPE_COLORS[d.type] ?? '#888'}22`,
                      color: TYPE_COLORS[d.type] ?? '#888',
                      border: `1px solid ${TYPE_COLORS[d.type] ?? '#888'}44`,
                    }}>{d.type}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: 'var(--t2)' }}>{d.ruId}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                      background: `${STATUS_COLORS[d.status] ?? '#888'}22`,
                      color: STATUS_COLORS[d.status] ?? '#888',
                      border: `1px solid ${STATUS_COLORS[d.status] ?? '#888'}44`,
                    }}>{d.status}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 60, height: 6, borderRadius: 3,
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${d.healthScore}%`, height: '100%',
                          background: healthColor(d.healthScore),
                          borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: healthColor(d.healthScore) }}>{d.healthScore}%</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'monospace' }}>
                      {d.location.lat.toFixed(4)}, {d.location.lng.toFixed(4)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(d)} style={btnSmall('#2563eb')}>Edit</button>
                      <button onClick={() => handleDelete(d)} style={btnSmall('#ef4444')}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={overlayStyle} onClick={closeModal}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>
                {modal === 'create' ? 'Register Device' : 'Edit Device'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              {modal === 'create' && (
                <Field label="MAC Address (leave blank to auto-generate)">
                  <input
                    value={form.macAddress}
                    onChange={e => setForm(f => ({ ...f, macAddress: e.target.value }))}
                    style={inputStyle({})}
                    placeholder="AA:BB:CC:DD:EE:FF"
                  />
                </Field>
              )}
              <Field label="Device Name *">
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={inputStyle({})}
                  placeholder="Sensor A1"
                />
              </Field>
              <Field label="Device Type">
                <select value={form.deviceType} onChange={e => setForm(f => ({ ...f, deviceType: e.target.value }))} style={inputStyle({})}>
                  {DEVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Refinery Unit">
                <select
                  value={form.ruId}
                  onChange={e => setForm(f => ({ ...f, ruId: e.target.value }))}
                  style={inputStyle({})}
                  disabled={!isSuperAdmin && modal === 'edit'}
                >
                  {visibleRuOptions.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              {modal === 'edit' && (
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle({})}>
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              )}
              {modal === 'create' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Latitude">
                    <input
                      type="number"
                      step="any"
                      value={form.lat}
                      onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                      style={inputStyle({})}
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      type="number"
                      step="any"
                      value={form.lng}
                      onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                      style={inputStyle({})}
                    />
                  </Field>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} style={btnStyle('transparent', true)}>Cancel</button>
                <button type="submit" disabled={submitting} style={btnStyle('#2563eb')}>
                  {submitting ? 'Saving…' : modal === 'create' ? 'Register Device' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 6, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--t3)',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1,
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px', verticalAlign: 'middle',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  background: '#0f1118',
  border: '1px solid var(--card-border)',
  borderRadius: 16,
  padding: 28,
  width: '100%',
  maxWidth: 500,
  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

function inputStyle(extra: React.CSSProperties): React.CSSProperties {
  return {
    background: 'var(--input-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--t1)',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    ...extra,
  };
}

function btnStyle(bg: string, outline = false): React.CSSProperties {
  return {
    background: outline ? 'transparent' : bg,
    border: `1px solid ${outline ? 'var(--card-border)' : bg}`,
    color: outline ? 'var(--t2)' : '#fff',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

function btnSmall(color: string, disabled = false): React.CSSProperties {
  return {
    background: `${color}18`,
    border: `1px solid ${color}44`,
    color: disabled ? 'var(--t4)' : color,
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
