'use client';

import { CheckCircle2, Link, Network } from 'lucide-react';
import type { Device } from '@/lib/graphql';

interface SensorListPanelProps {
  devices: Device[];
}

export function SensorListPanel({ devices }: SensorListPanelProps) {
  // Find all Cluster Heads first
  const clusterHeads = devices.filter(d => d.type === 'CLUSTER');
  
  // Group sensors by their parent cluster head
  const groups = clusterHeads.map(ch => {
    const children = devices.filter(d => d.parentMac === ch.name && d.type === 'SENSOR');
    return {
      ch,
      sensors: children
    };
  });

  // Handle sensors that might not have a parent or parent is a gateway directly
  const orphanedSensors = devices.filter(d => 
    d.type === 'SENSOR' && 
    !clusterHeads.some(ch => ch.name === d.parentMac)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--card-foreground)] flex items-center gap-2">
          <span className="text-lg">Unit Topology — {devices.filter(d => d.type === 'SENSOR').length} Active Sensors</span>
        </h2>
      </div>
      
      <div className="grid gap-6">
        {groups.map((group) => (
          <div key={group.ch.id} className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <Network size={16} className="text-blue-400" />
              <span className="text-sm font-bold text-blue-400 font-mono tracking-wider uppercase">CLUSTER: {group.ch.name}</span>
              <div className="h-px flex-1 bg-blue-500/10" />
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.sensors.map((sensor) => (
                <SensorCard key={sensor.id} sensor={sensor} />
              ))}
            </div>
          </div>
        ))}

        {orphanedSensors.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <Link size={14} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-400 font-mono tracking-wider uppercase">DIRECT CONNECT / GATEWAY</span>
              <div className="h-px flex-1 bg-slate-500/10" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orphanedSensors.map((sensor) => (
                <SensorCard key={sensor.id} sensor={sensor} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SensorCard({ sensor }: { sensor: Device }) {
  const isAlert = sensor.latestPpm && sensor.latestPpm > 50;
  
  return (
    <div 
      className="flex flex-col gap-3 p-4 rounded-xl border border-[var(--border)] transition-all hover:bg-[rgba(255,255,255,0.05)] hover:border-blue-500/30 group"
      style={{ background: 'var(--card)' }}
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[var(--t3)] font-mono">
          <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">ID: {sensor.name.split('-').pop()}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[var(--t4)] font-mono">
          <div 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ 
              background: sensor.status === 'ONLINE' ? 'var(--success)' : 'var(--danger)',
              boxShadow: sensor.status === 'ONLINE' ? '0 0 8px var(--success)' : 'none'
            }}
          />
          <span className={sensor.status === 'ONLINE' ? 'text-[var(--t3)]' : 'text-[var(--danger)]'}>
            {sensor.status}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: !isAlert ? 'var(--t1)' : 'var(--danger)' }}>
          <CheckCircle2 size={16} className={!isAlert ? 'text-emerald-500' : 'text-rose-500'} />
          <span>{!isAlert ? 'Safe' : 'Leak Detected'}</span>
        </div>
        <div className="text-right">
           <div className="text-[10px] text-[var(--t4)] font-mono leading-none mb-1">PPM</div>
           <div className="text-base font-bold font-mono text-[var(--t2)]">{sensor.latestPpm?.toFixed(1) || '0.0'}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-1">
        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-[var(--t4)] font-mono mb-1 uppercase">
             <span>Battery</span>
             <span>{sensor.battery.soc}%</span>
          </div>
          <div className="h-1 w-full bg-[var(--divider)] rounded-full overflow-hidden">
             <div 
              className="h-full transition-all duration-500" 
              style={{ 
                width: `${sensor.battery.soc}%`, 
                background: sensor.battery.soc > 30 ? 'var(--success)' : 'var(--danger)' 
              }} 
             />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-[var(--t4)] font-mono mb-1 uppercase">
             <span>Signal</span>
             <span>{sensor.network.rssi}dBm</span>
          </div>
          <div className="h-1 w-full bg-[var(--divider)] rounded-full overflow-hidden">
             <div 
              className="h-full transition-all duration-500 bg-blue-500" 
              style={{ width: `${Math.max(0, 100 + sensor.network.rssi)}%` }} 
             />
          </div>
        </div>
      </div>
    </div>
  );
}
