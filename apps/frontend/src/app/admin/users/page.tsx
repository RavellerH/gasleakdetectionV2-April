'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchUsers, createUser, updateUser, deleteUser, fetchRuSites, type User, type RuSite } from '@/lib/graphql';

const ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'];
const RU_OPTIONS = ['ALL', 'RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#ef4444',
  OPERATOR: '#f59e0b',
  VIEWER: '#38bdf8',
};

type ModalMode = 'create' | 'edit' | null;

interface FormState {
  email: string;
  name: string;
  password: string;
  ruId: string;
  role: string;
}

const EMPTY_FORM: FormState = { email: '', name: '', password: '', ruId: 'ALL', role: 'VIEWER' };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRu, setFilterRu] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');
  const [modal, setModal] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ruSites, setRuSites] = useState<RuSite[]>([]);

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
      const [u, sites] = await Promise.all([fetchUsers(), fetchRuSites()]);
      setUsers(u);
      setRuSites(sites);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isSuperAdmin = currentUser?.ruId === 'ALL';

  const visibleRuOptions = isSuperAdmin
    ? RU_OPTIONS
    : currentUser ? [currentUser.ruId] : [];

  const filtered = users.filter(u => {
    if (!isSuperAdmin && u.ruId !== currentUser?.ruId) return false;
    if (filterRu !== 'ALL' && u.ruId !== filterRu) return false;
    if (filterRole !== 'ALL' && u.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  function openCreate() {
    setForm({ ...EMPTY_FORM, ruId: isSuperAdmin ? 'ALL' : (currentUser?.ruId ?? 'RU2') });
    setEditTarget(null);
    setModal('create');
  }

  function openEdit(u: User) {
    setForm({ email: u.email, name: u.name ?? '', password: '', ruId: u.ruId, role: u.role });
    setEditTarget(u);
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) return;
    setSubmitting(true);
    try {
      if (modal === 'create') {
        await createUser({
          email: form.email,
          name: form.name || undefined,
          password: form.password || 'changeme',
          ruId: form.ruId,
          role: form.role,
        }, currentUser?.id ?? '');
      } else if (modal === 'edit' && editTarget) {
        const input: Record<string, string> = { email: form.email, ruId: form.ruId, role: form.role };
        if (form.name) input.name = form.name;
        if (form.password) input.password = form.password;
        await updateUser(editTarget.id, input);
      }
      closeModal();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(u: User) {
    if (u.id === currentUser?.id) return;
    if (!confirm(`Delete user ${u.email}?`)) return;
    try {
      await deleteUser(u.id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>User Management</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>
            {isSuperAdmin ? 'All RUs' : `Scoped to ${currentUser?.ruId}`} · {filtered.length} user{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openCreate} style={btnStyle('#2563eb')}>
          + Add User
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle({ width: 240 })}
        />
        {isSuperAdmin && (
          <select value={filterRu} onChange={e => setFilterRu(e.target.value)} style={inputStyle({})}>
            <option value="ALL">All RUs</option>
            {RU_OPTIONS.filter(r => r !== 'ALL').map(r => <option key={r}>{r}</option>)}
          </select>
        )}
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={inputStyle({})}>
          <option value="ALL">All roles</option>
          {ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)' }}>No users found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--divider)' }}>
                {['Name / Email', 'Role', 'RU', 'Created', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--divider)' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500, color: 'var(--t1)', fontSize: 13 }}>{u.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{u.email}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                      background: `${ROLE_COLORS[u.role] ?? '#888'}22`,
                      color: ROLE_COLORS[u.role] ?? '#888',
                      border: `1px solid ${ROLE_COLORS[u.role] ?? '#888'}44`,
                    }}>{u.role}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: 'var(--t2)' }}>{u.ruId}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(u)} style={btnSmall('#2563eb')}>Edit</button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={u.id === currentUser?.id}
                        style={btnSmall('#ef4444', u.id === currentUser?.id)}
                      >
                        Delete
                      </button>
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
                {modal === 'create' ? 'Add User' : 'Edit User'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <Field label="Email *">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={inputStyle({})}
                  placeholder="user@example.com"
                />
              </Field>
              <Field label="Full Name">
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={inputStyle({})}
                  placeholder="John Doe"
                />
              </Field>
              <Field label={modal === 'create' ? 'Password *' : 'New Password (leave blank to keep)'}>
                <input
                  type="password"
                  required={modal === 'create'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={inputStyle({})}
                  placeholder={modal === 'create' ? 'Set password' : 'Leave blank to keep current'}
                />
              </Field>
              <Field label="Role">
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle({})}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Refinery Unit">
                <select value={form.ruId} onChange={e => setForm(f => ({ ...f, ruId: e.target.value }))} style={inputStyle({})}>
                  {visibleRuOptions.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} style={btnStyle('transparent', true)}>Cancel</button>
                <button type="submit" disabled={submitting} style={btnStyle('#2563eb')}>
                  {submitting ? 'Saving…' : modal === 'create' ? 'Create User' : 'Save Changes'}
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
  maxWidth: 480,
  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
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
