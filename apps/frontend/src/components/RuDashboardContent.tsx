'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchDevices, type Device } from '@/lib/graphql';
import { SensorListPanel } from './SensorListPanel';
import { UnitLayoutMap } from './UnitLayoutMap';

const DeviceMap = dynamic(() => import('./DeviceMap').then((m) => m.DeviceMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--muted-foreground)]">
      Loading map…
    </div>
  ),
});

interface RuDashboardContentProps {
  ruId: string;
}

export function RuDashboardContent({ ruId }: RuDashboardContentProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDevices(ruId);
      setDevices(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [ruId]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  if (loading && devices.length === 0) {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              {ruId} Dashboard
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Loading…
            </p>
          </div>
          <Link href="/" className="text-sm text-[var(--primary)] hover:underline">
            ← Back to RU list
          </Link>
        </header>
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]">
          Loading devices…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {ruId} Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Detailed sensor monitoring, unit layout, and map view for {ruId}.
          </p>
        </div>
        <Link href="/" className="text-sm text-[var(--primary)] hover:underline">
          ← Back to RU list
        </Link>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}. Ensure the backend is running at{' '}
          <code className="rounded bg-[var(--muted)] px-1">
            {process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:3001/graphql'}
          </code>
        </div>
      )}

      {/* New UI Panels */}
      <section className="space-y-8">
        <SensorListPanel devices={devices} />
        <UnitLayoutMap devices={devices} />
      </section>

      {/* Existing UI Panels */}
      <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--card-foreground)] flex items-center gap-2">
            <span className="text-lg">Geospatial RU Map</span>
          </h2>
          <DeviceMap
            devices={devices}
            ruId={ruId}
            onDeviceUpdate={loadDevices}
          />
        </div>

        <div className="card space-y-2">
          <h2 className="text-sm font-medium text-[var(--card-foreground)]">
            Raw Devices Summary
          </h2>
          {devices.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              No devices for {ruId} yet.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--foreground)]">
                      {device.name}
                    </span>
                    <span className="badge badge-success">{device.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[var(--muted-foreground)]">
                    <span>Battery: {device.battery.soc}%</span>
                    <span>RSSI: {device.network.rssi} dBm</span>
                    <span>Health: {device.healthScore}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
