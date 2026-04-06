'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Map, { Marker, Popup, MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X } from 'lucide-react';
import type { Device } from '@/lib/graphql';
import { updateDeviceLocation } from '@/lib/graphql';
import { DevicePin } from './DevicePin';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

interface DeviceMapProps {
  devices: Device[];
  ruId: string;
  selectedDevice?: Device | null;
  onDeviceSelect?: (device: Device | null) => void;
  warningThreshold?: number;
  criticalThreshold?: number;
  onDeviceUpdate?: () => void;
}

export function DeviceMap({ 
  devices, 
  ruId, 
  selectedDevice, 
  onDeviceSelect, 
  warningThreshold, 
  criticalThreshold, 
  onDeviceUpdate 
}: DeviceMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const lastCenteredRu = useRef<string | null>(null);

  // Center map on RU when ruId changes and devices for it are loaded
  useEffect(() => {
    if (devices.length > 0 && mapRef.current) {
      const targetDevice = devices.find(d => d.ruId === ruId);
      if (targetDevice && lastCenteredRu.current !== ruId) {
        lastCenteredRu.current = ruId;
        mapRef.current.flyTo({
          center: [targetDevice.location.lng, targetDevice.location.lat],
          zoom: 14,
          duration: 1500,
          essential: true
        });
      }
    }
  }, [ruId, devices]);

  // Sync parent selection to map focus and ZOOM IN
  useEffect(() => {
    if (selectedDevice && mapRef.current) {
      mapRef.current.flyTo({
        center: [selectedDevice.location.lng, selectedDevice.location.lat],
        zoom: 17,
        duration: 2000,
        essential: true
      });
    }
  }, [selectedDevice]);

  // Sync parent selection to map focus
  const popupDevice = selectedDevice;
  const setPopupDevice = onDeviceSelect;

  const handleDragEnd = useCallback(
    async (device: Device, lngLat: { lng: number; lat: number }) => {
      setUpdating(device.id);
      try {
        await updateDeviceLocation(device.id, { lat: lngLat.lat, lng: lngLat.lng });
        onDeviceUpdate?.();
      } finally {
        setUpdating(null);
      }
    },
    [onDeviceUpdate]
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--muted-foreground)]">
        Set <code className="rounded bg-[var(--muted)] px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> in .env to show the map.
      </div>
    );
  }

  const defaultView = {
    longitude: 131.26,
    latitude: -0.85,
    zoom: 12,
  };

  // Center map on the RU's gateway or first device if available
  const ruCenter = devices.length > 0 
    ? { longitude: devices[0].location.lng, latitude: devices[0].location.lat, zoom: 14 }
    : defaultView;

  return (
    <div className="h-[500px] w-full overflow-hidden rounded-lg border border-[var(--border)]">
      <style>{`
        /* Hide Mapbox default styling */
        .mapboxgl-popup-content {
          background: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .mapboxgl-popup-tip {
          display: none !important;
        }
        
        /* Custom Arrow for our glassy box (on Top) */
        .glass-popup::after {
          content: '';
          position: absolute;
          top: -8px; 
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 8px solid rgba(15, 23, 42, 0.85);
          filter: drop-shadow(0 -2px 2px rgba(0,0,0,0.2));
        }
      `}</style>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={ruCenter}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/navigation-night-v1"
      >
        {devices.map((device) => (
          <Marker
            key={device.id}
            longitude={device.location.lng}
            latitude={device.location.lat}
            anchor="bottom"
            draggable
            onDragEnd={(e) => handleDragEnd(device, e.lngLat)}
            onClick={() => setPopupDevice?.(device)}
          >
            <div style={{ marginBottom: 14 }}>
              <DevicePin 
                type={device.type}
                healthScore={device.healthScore} 
                ppm={device.latestPpm}
                warningThreshold={warningThreshold}
                criticalThreshold={criticalThreshold}
              />
            </div>
          </Marker>
        ))}

        {popupDevice && (
          <Popup
            longitude={popupDevice.location.lng}
            latitude={popupDevice.location.lat}
            anchor="top"
            offset={10}
            onClose={() => setPopupDevice?.(null)}
            closeButton={false}
            closeOnClick={false}
          >
            <div 
              className="glass-popup"
              style={{ 
                position: 'relative',
                minWidth: '220px', 
                background: 'var(--header-bg)', 
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--card-border)',
                borderRadius: '12px',
                padding: '14px',
                color: 'var(--t1)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPopupDevice?.(null);
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                <X size={14} />
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ 
                    width: 8, height: 8, borderRadius: '50%', 
                    background: popupDevice.status === 'ONLINE' ? '#22c55e' : '#ef4444',
                    boxShadow: popupDevice.status === 'ONLINE' ? '0 0 8px #22c55e' : 'none',
                    flexShrink: 0
                  }} />
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    color: '#38bdf8', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px',
                    fontFamily: "'JetBrains Mono', monospace" 
                  }}>
                    {popupDevice.type}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>
                {popupDevice.name}
              </div>

              {popupDevice.type === 'SENSOR' && (
                <div style={{ marginBottom: 12, padding: '10px', borderRadius: '8px', background: (popupDevice.latestPpm || 0) > (warningThreshold || 50) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 211, 238, 0.05)', border: `1px solid ${(popupDevice.latestPpm || 0) > (warningThreshold || 50) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 211, 238, 0.1)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gas Status (CH4)</div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: (popupDevice.latestPpm || 0) > (warningThreshold || 50) ? '#ef4444' : '#22c55e', textTransform: 'uppercase' }}>
                      {(popupDevice.latestPpm || 0) > (warningThreshold || 50) ? '● LEAK DETECTED' : '● SAFE'}
                    </div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: (popupDevice.latestPpm || 0) > (warningThreshold || 50) ? '#ef4444' : '#22d3ee', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                    {popupDevice.latestPpm?.toFixed(1) || '0.0'} <span style={{ fontSize: '10px', opacity: 0.6 }}>PPM</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: 2 }}>BATTERY</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: popupDevice.battery.soc > 20 ? '#f8fafc' : '#ef4444', fontFamily: "'JetBrains Mono', monospace" }}>
                    {popupDevice.battery.soc}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: 2 }}>SIGNAL</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace" }}>
                    {popupDevice.network.rssi} dBm
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                  ID: {popupDevice.id.slice(-6).toUpperCase()}
                </span>
                <div style={{ 
                  fontSize: '10px', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  background: 'rgba(56, 189, 248, 0.1)', 
                  color: '#22d3ee',
                  fontWeight: 600
                }}>
                  HEALTH: {popupDevice.healthScore}%
                </div>
              </div>

              {updating === popupDevice.id && (
                <div style={{ 
                  marginTop: '10px', 
                  fontSize: '10px', 
                  color: '#38bdf8', 
                  textAlign: 'center',
                  fontFamily: "'JetBrains Mono', monospace",
                  animation: 'pulse 1.5s infinite'
                }}>
                  ● Syncing Location...
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
