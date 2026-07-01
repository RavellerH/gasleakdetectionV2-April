'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@/lib/graphql';

const NAV = [
  { href: '/admin/users', label: 'User Management', icon: '👤' },
  { href: '/admin/devices', label: 'Device Management', icon: '📡' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('gld_user');
      if (stored) {
        const u: User = JSON.parse(stored);
        if (u.role !== 'ADMIN') {
          router.replace('/');
          return;
        }
        setUser(u);
      } else {
        router.replace('/');
      }
    } catch {
      router.replace('/');
    }
  }, [router]);

  if (!user) return null;

  const isSuperAdmin = user.ruId === 'ALL';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--card-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        flexShrink: 0,
      }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            Admin Panel
          </div>
          <div style={{ fontSize: 14, color: 'var(--t1)', fontWeight: 600 }}>
            GLD System v.2
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
            {isSuperAdmin ? 'Super Admin • All RUs' : `Admin • ${user.ruId}`}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {NAV.map(item => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 4,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--accent)' : 'var(--t2)',
                background: active ? 'rgba(56,189,248,0.08)' : 'transparent',
                border: active ? '1px solid rgba(56,189,248,0.18)' : '1px solid transparent',
                transition: 'all 0.15s',
              }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--divider)' }}>
          <Link href="/" style={{
            display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
            fontSize: 12, color: 'var(--t3)',
          }}>
            ← Back to Dashboard
          </Link>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--t4)' }}>
            {user.email}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {children}
      </main>
    </div>
  );
}
