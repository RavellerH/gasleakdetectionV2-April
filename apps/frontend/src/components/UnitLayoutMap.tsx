'use client';

import { Device } from '@/lib/graphql';
import { Network, Radio, Zap } from 'lucide-react';

interface UnitLayoutMapProps {
  devices: Device[];
  onNodeClick?: (device: Device) => void;
}

export function UnitLayoutMap({ devices, onNodeClick }: UnitLayoutMapProps) {
  const gateways = devices.filter(d => d.type === 'GATEWAY');
  const clusterHeads = devices.filter(d => d.type === 'CLUSTER');
  const sensors = devices.filter(d => d.type === 'SENSOR');

  return (
    <div className="space-y-4">
       <h2 className="text-sm font-medium text-[var(--card-foreground)] flex items-center gap-2">
        <span className="text-lg">Network Topology Map</span>
        {onNodeClick && <span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded ml-2">INTERACTIVE</span>}
      </h2>
      
      <div 
        className="relative w-full rounded-xl border border-[var(--border)] overflow-hidden p-12 min-h-[700px] flex flex-col items-center justify-center"
        style={{ 
          background: 'var(--card)',
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(56, 189, 248, 0.05) 1px, transparent 0)',
          backgroundSize: '32px 32px' 
        }}
      >
        {/* 1. GATEWAY LAYER (The Core) */}
        <div className="relative mb-32 z-20">
          {gateways.map(gw => (
            <div 
              key={gw.id} 
              className="flex flex-col items-center group cursor-pointer"
              onClick={() => onNodeClick?.(gw)}
            >
              <div className="absolute -inset-12 bg-emerald-500/10 rounded-full blur-3xl animate-pulse group-hover:bg-emerald-500/20 transition-all" />
              <div 
                className="relative w-24 h-24 rounded-3xl border-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)] flex items-center justify-center transition-all group-hover:scale-105 group-hover:border-white" 
                style={{ background: 'var(--input-bg)' }}
              >
                <Zap size={40} className="text-emerald-400" />
              </div>
              <div className="mt-3 font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest group-hover:bg-emerald-500/20 transition-colors">
                GATEWAY SERVER: {gw.name}
              </div>
            </div>
          ))}
        </div>

        {/* 2. MESH CONNECTIONS SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
           <circle cx="50%" cy="30%" r="200" fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="1" strokeDasharray="10 10" />
           <circle cx="50%" cy="30%" r="350" fill="none" stroke="rgba(56, 189, 248, 0.05)" strokeWidth="1" strokeDasharray="5 5" />
        </svg>

        {/* 3. CLUSTER LAYER */}
        <div className="relative z-10 flex flex-wrap justify-center gap-24 items-center w-full max-w-6xl">
          {clusterHeads.map((ch, idx) => {
            const children = sensors.filter(s => s.parentMac === ch.name);
            
            return (
              <div key={ch.id} className="flex flex-col items-center gap-12" style={{ margin: '40px' }}>
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => onNodeClick?.(ch)}
                >
                  <div className="absolute bottom-full left-1/2 w-px h-24 bg-gradient-to-t from-blue-500/50 to-transparent -translate-x-1/2 pointer-events-none" />
                  
                  <div className="absolute -inset-6 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                  <div className="relative flex flex-col items-center">
                    <div 
                      className="w-16 h-16 rounded-2xl border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center mb-2 transition-all group-hover:scale-110 group-hover:border-white" 
                      style={{ background: 'var(--input-bg)' }}
                    >
                      <Network size={28} className="text-blue-400" />
                    </div>
                    <div className="font-mono text-[11px] font-bold text-blue-400 tracking-tighter bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                      {ch.name}
                    </div>
                  </div>

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    {children.map((s, sIdx) => {
                      const angle = (sIdx / children.length) * 2 * Math.PI;
                      const radius = 140;
                      const x = Math.cos(angle) * radius;
                      const y = Math.sin(angle) * radius;
                      
                      const isAlert = s.latestPpm && s.latestPpm > 50;
                      
                      return (
                        <div 
                          key={s.id}
                          className="absolute flex flex-col items-center transition-all duration-700"
                          style={{ 
                            transform: `translate(${x}px, ${y}px)`,
                          }}
                        >
                          <div 
                            className="relative group/sensor cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNodeClick?.(s);
                            }}
                          >
                            {isAlert && (
                              <div className="absolute -inset-2 bg-rose-500/20 rounded-full blur-md animate-pulse" />
                            )}
                            <div 
                              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all group-hover/sensor:scale-110 group-hover/sensor:border-white ${
                                isAlert ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]' :
                                s.status === 'ONLINE' ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 
                                'border-rose-500'
                              }`}
                              style={{ background: 'var(--input-bg)' }}
                            >
                              <Radio size={16} className={isAlert ? 'text-rose-400' : s.status === 'ONLINE' ? 'text-emerald-400' : 'text-rose-400'} />
                              
                              <div 
                                className={`absolute top-1/2 left-1/2 h-px bg-gradient-to-r pointer-events-none origin-left ${
                                  isAlert ? 'from-rose-500/60 to-transparent' : 'from-blue-500/40 to-transparent'
                                }`}
                                style={{ 
                                  width: radius,
                                  transform: `rotate(${angle + Math.PI}rad)`,
                                  zIndex: -1
                                }}
                              />
                            </div>
                            
                            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 scale-0 group-hover/sensor:scale-100 transition-transform z-20">
                               <div className="border border-white/10 p-2 rounded-lg shadow-2xl min-w-[100px] text-center backdrop-blur-xl" style={{ background: 'var(--page-bg)' }}>
                                  <div className="text-[11px] font-bold text-[var(--t1)] mb-1 uppercase">{s.name.split('-').pop()}</div>
                                  <div className={`text-base font-mono font-bold ${isAlert ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {s.latestPpm?.toFixed(1)} <span className="text-[10px] opacity-40">PPM</span>
                                  </div>
                               </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div 
          className="absolute bottom-6 left-6 backdrop-blur border border-white/5 p-4 rounded-xl space-y-3 font-mono text-xs"
          style={{ background: 'var(--card-bg-alt)' }}
        >
           <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="text-[var(--t3)] uppercase tracking-wider">Cluster Head Node</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[var(--t3)] uppercase tracking-wider">Active Star Node (Sensor)</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
              <span className="text-[var(--t3)] uppercase tracking-wider">Connection Terminated</span>
           </div>
        </div>
      </div>
    </div>
  );
}
