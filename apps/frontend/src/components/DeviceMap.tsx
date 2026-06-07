'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Marker, Popup, MapRef, Source, Layer } from 'react-map-gl';
import type { FillExtrusionLayerSpecification, SkyLayerSpecification } from 'mapbox-gl';
import useSupercluster from 'use-supercluster';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, Compass, Mountain, Share2 } from 'lucide-react';
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

/* ── 3D buildings layer ─────────────────────────────────────── */
const buildingsLayer: FillExtrusionLayerSpecification = {
  id: '3d-buildings',
  source: 'composite',
  'source-layer': 'building',
  filter: ['==', 'extrude', 'true'],
  type: 'fill-extrusion',
  minzoom: 14,
  paint: {
    'fill-extrusion-color': '#0a1628',
    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']],
    'fill-extrusion-base':   ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'min_height']],
    'fill-extrusion-opacity': 0.75,
  },
};

/* ── Sky atmosphere layer ───────────────────────────────────── */
const skyLayer: SkyLayerSpecification = {
  id: 'sky',
  type: 'sky',
  paint: {
    'sky-type': 'atmosphere',
    'sky-atmosphere-sun': [0.0, 90.0],
    'sky-atmosphere-sun-intensity': 15,
    'sky-atmosphere-color': 'rgba(14, 30, 60, 1)',
    'sky-atmosphere-halo-color': 'rgba(56, 189, 248, 0.3)',
  },
};

/* ── Flowing dash animation frames ─────────────────────────── */
const DASH_STEPS = [
  [0,4,3],[0.5,4,2.5],[1,4,2],[1.5,4,1.5],[2,4,1],[2.5,4,0.5],[3,4,0],
  [0,0.5,3,3.5],[0,1,3,3],[0,1.5,3,2.5],[0,2,3,2],[0,2.5,3,1.5],[0,3,3,1],[0,3.5,3,0.5],
];

/* ── Cluster bubble marker ──────────────────────────────────── */
function ClusterPin({ count, hasCritical, hasWarning, onClick }: {
  count: number; hasCritical: boolean; hasWarning: boolean; onClick: () => void;
}) {
  const color  = hasCritical ? '#ef4444' : hasWarning ? '#f59e0b' : '#38bdf8';
  const size   = Math.min(20 + Math.log2(count) * 8, 56);
  return (
    <div
      onClick={onClick}
      style={{ width:size, height:size, borderRadius:'50%', background:`${color}22`, border:`2px solid ${color}`, boxShadow:`0 0 16px ${color}55`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative' }}
    >
      <span style={{ fontSize:Math.round(size * 0.35), fontWeight:800, color, fontFamily:"'Geist Mono', monospace", lineHeight:1 }}>{count}</span>
      {/* outer ping */}
      <div style={{ position:'absolute', inset:-4, borderRadius:'50%', border:`1.5px solid ${color}`, opacity:.4, animation:'gw-ring 2.4s ease-out infinite', pointerEvents:'none' }} />
    </div>
  );
}

export function DeviceMap({
  devices,
  ruId,
  selectedDevice,
  onDeviceSelect,
  warningThreshold  = 50,
  criticalThreshold = 80,
  onDeviceUpdate,
}: DeviceMapProps) {
  const mapRef         = useRef<MapRef>(null);
  const animFrameRef   = useRef<number>(0);
  const lastCenteredRu = useRef<string | null>('ALL');

  const [updating,     setUpdating]     = useState<string | null>(null);
  const [is3D,         setIs3D]         = useState(true);
  const [showTopology, setShowTopology] = useState(true);

  /* viewport state — needed by supercluster */
  const [zoom,   setZoom]   = useState(4.5);
  const [bounds, setBounds] = useState<[number, number, number, number]>([95, -11, 141, 6]);

  /* ── supercluster points ── */
  const points = useMemo(() => devices.map(d => ({
    type:       'Feature'  as const,
    properties: {
      cluster:      false,
      deviceId:     d.id,
      deviceType:   d.type,
      macAddress:   d.macAddress,
      name:         d.name,
      ruId:         d.ruId,
      parentMac:    d.parentMac,
      healthScore:  d.healthScore,
      latestPpm:    d.latestPpm ?? 0,
      status:       d.status,
      hasCritical:  (d.latestPpm ?? 0) >= criticalThreshold,
      hasWarning:   (d.latestPpm ?? 0) >= warningThreshold,
    },
    geometry: { type: 'Point' as const, coordinates: [d.location.lng, d.location.lat] },
  })), [devices, criticalThreshold, warningThreshold]);

  // Memoized — inline object literal would be a new reference every render,
  // causing useSupercluster to recompute → setClusters → re-render → infinite loop.
  const clusterOptions = useMemo(() => ({
    radius:  60,
    maxZoom: 14,
    map:    (p: Record<string, unknown>) => ({
      hasCritical: p.hasCritical as boolean,
      hasWarning:  p.hasWarning  as boolean,
    }),
    reduce: (acc: Record<string, boolean>, p: Record<string, boolean>) => {
      acc.hasCritical = acc.hasCritical || p.hasCritical;
      acc.hasWarning  = acc.hasWarning  || p.hasWarning;
    },
  }), []);

  const { clusters, supercluster } = useSupercluster({ points, bounds, zoom, options: clusterOptions });

  /* ── topology GeoJSON ── */
  const topologyGeoJSON = useMemo(() => {
    const byMac = new globalThis.Map<string, Device>(devices.map(d => [d.macAddress, d] as [string, Device]));
    const features: object[] = [];
    for (const device of devices) {
      const pMac = device.parentMac ?? device.network.parentMac;
      if (!pMac) continue;
      const parent = byMac.get(pMac);
      if (!parent) continue;
      features.push({
        type: 'Feature',
        properties: {
          health:   Math.min(device.healthScore, parent.healthScore),
          lineType: parent.type === 'GATEWAY' ? 'gw-ch' : 'ch-sns',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [parent.location.lng, parent.location.lat],
            [device.location.lng,  device.location.lat],
          ],
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [devices]);

  /* ── flowing dash animation ── */
  useEffect(() => {
    let step = 0, last = 0;
    const tick = (ts: number) => {
      if (ts - last > 50) {
        last = ts;
        step = (step + 1) % DASH_STEPS.length;
        const map = mapRef.current?.getMap();
        if (map) {
          if (map.getLayer('topo-gw-ch'))  map.setPaintProperty('topo-gw-ch',  'line-dasharray', DASH_STEPS[step]);
          if (map.getLayer('topo-ch-sns')) map.setPaintProperty('topo-ch-sns', 'line-dasharray', DASH_STEPS[step]);
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  /* ── fly to RU on change ── */
  useEffect(() => {
    if (!mapRef.current) return;
    if (ruId === 'ALL') {
      if (lastCenteredRu.current !== 'ALL') {
        lastCenteredRu.current = 'ALL';
        mapRef.current.flyTo({ center:[118.0,-2.5], zoom:4.5, pitch:0, bearing:0, duration:1800, essential:true });
      }
      return;
    }
    if (devices.length > 0) {
      const target = devices.find(d => d.ruId === ruId);
      if (target && lastCenteredRu.current !== ruId) {
        lastCenteredRu.current = ruId;
        mapRef.current.flyTo({
          center:[target.location.lng, target.location.lat],
          zoom:14, pitch:is3D?55:0, bearing:is3D?-17:0, duration:1800, essential:true,
        });
      }
    }
  }, [ruId, devices, is3D]);

  /* ── fly to selected device ── */
  useEffect(() => {
    if (selectedDevice && mapRef.current) {
      mapRef.current.flyTo({
        center:[selectedDevice.location.lng, selectedDevice.location.lat],
        zoom:17, pitch:is3D?60:0, bearing:is3D?-20:0, duration:2000, essential:true,
      });
    }
  }, [selectedDevice, is3D]);

  const toggle3D = () => {
    const next = !is3D;
    setIs3D(next);
    mapRef.current?.easeTo({ pitch:next?55:0, bearing:next?-17:0, duration:800 });
  };

  const resetNorth = () => mapRef.current?.easeTo({ bearing:0, pitch:is3D?55:0, duration:600 });

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

  const handleMove = useCallback((evt: { viewState: { zoom: number }; target: mapboxgl.Map }) => {
    setZoom(evt.viewState.zoom);
    const b = evt.target.getBounds();
    if (b) setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ height:500, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, color:'var(--t3)', fontSize:13, fontFamily:"'Geist Mono', monospace", gap:8 }}>
        Set <code style={{ background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:4 }}>NEXT_PUBLIC_MAPBOX_TOKEN</code> in .env to show the map.
      </div>
    );
  }

  const topoVisible = showTopology && zoom >= 11;
  const ctrlBtn = (active?: boolean): React.CSSProperties => ({
    display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
    background: active ? 'rgba(56,189,248,0.15)' : 'rgba(11,13,20,0.85)',
    border:`1px solid ${active ? 'rgba(56,189,248,0.4)' : 'rgba(56,189,248,0.15)'}`,
    borderRadius:8, cursor:'pointer', color:active?'#38bdf8':'var(--t3)',
    fontSize:12, fontWeight:700, backdropFilter:'blur(12px)',
    fontFamily:"'Geist Mono', monospace",
  });

  return (
    <div style={{ position:'relative', height:520, width:'100%', borderRadius:14, overflow:'hidden', border:'1px solid var(--card-border)' }}>
      <style>{`
        @keyframes gw-ring { 0% { transform:scale(1); opacity:.7; } 100% { transform:scale(2.2); opacity:0; } }
        .mapboxgl-popup-content { background:none !important; box-shadow:none !important; padding:0 !important; }
        .mapboxgl-popup-tip { display:none !important; }
        .mapboxgl-ctrl-group { background:rgba(11,13,20,0.85) !important; border:1px solid rgba(56,189,248,0.15) !important; backdrop-filter:blur(12px); }
        .mapboxgl-ctrl-group button { background:transparent !important; border-bottom:1px solid rgba(56,189,248,0.1) !important; }
        .mapboxgl-ctrl-group button:last-child { border-bottom:none !important; }
        .mapboxgl-ctrl-icon { filter:invert(1) brightness(0.7); }
        .mapboxgl-ctrl-attrib { display:none !important; }
        .mapboxgl-ctrl-logo { display:none !important; }
      `}</style>

      <MapGL
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude:118.0, latitude:-2.5, zoom:4.5, pitch:0, bearing:0 }}
        style={{ width:'100%', height:'100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        antialias
        onMove={handleMove}
      >
        <Layer {...skyLayer} />
        {is3D && <Layer {...buildingsLayer} />}

        {/* ── Topology lines (hidden below zoom 11) ── */}
        <Source id="topology" type="geojson" data={topologyGeoJSON as any}>
          <Layer
            id="topo-gw-ch"
            source="topology"
            type="line"
            filter={['==', ['get', 'lineType'], 'gw-ch']}
            layout={{ 'line-cap':'round', 'line-join':'round' }}
            paint={{
              'line-color':   ['step', ['get', 'health'], '#64748b', 40, '#f59e0b', 70, '#22c55e'],
              'line-width':   2.5,
              'line-opacity': topoVisible ? 0.85 : 0,
              'line-blur':    0.5,
            }}
          />
          <Layer
            id="topo-ch-sns"
            source="topology"
            type="line"
            filter={['==', ['get', 'lineType'], 'ch-sns']}
            layout={{ 'line-cap':'round', 'line-join':'round' }}
            paint={{
              'line-color':   ['step', ['get', 'health'], '#64748b', 40, '#f59e0b', 70, '#22c55e'],
              'line-width':   1.5,
              'line-opacity': topoVisible ? 0.65 : 0,
              'line-blur':    0.3,
            }}
          />
        </Source>

        {/* ── Clustered markers ── */}
        {clusters.map((cluster) => {
          const [lng, lat] = cluster.geometry.coordinates;
          const props = cluster.properties as any;

          /* cluster bubble */
          if (props.cluster) {
            return (
              <Marker key={`cluster-${cluster.id}`} longitude={lng} latitude={lat} anchor="center">
                <ClusterPin
                  count={props.point_count}
                  hasCritical={!!props.hasCritical}
                  hasWarning={!!props.hasWarning}
                  onClick={() => {
                    const expansionZoom = Math.min(
                      supercluster?.getClusterExpansionZoom(cluster.id as number) ?? 14,
                      20
                    );
                    mapRef.current?.flyTo({ center:[lng, lat], zoom:expansionZoom, duration:800, essential:true });
                  }}
                />
              </Marker>
            );
          }

          /* individual device pin — look up the full Device object */
          const device = devices.find(d => d.id === props.deviceId);
          if (!device) return null;

          return (
            <Marker
              key={device.id}
              longitude={device.location.lng}
              latitude={device.location.lat}
              anchor="bottom"
              draggable
              onDragEnd={(e) => handleDragEnd(device, e.lngLat)}
              onClick={() => onDeviceSelect?.(device)}
            >
              <div style={{ marginBottom:14, cursor:'pointer' }}>
                <DevicePin
                  type={device.type}
                  healthScore={device.healthScore}
                  ppm={device.latestPpm}
                  warningThreshold={warningThreshold}
                  criticalThreshold={criticalThreshold}
                />
              </div>
            </Marker>
          );
        })}

        {/* ── Popup ── */}
        {selectedDevice && (
          <Popup
            longitude={selectedDevice.location.lng}
            latitude={selectedDevice.location.lat}
            anchor="top"
            offset={14}
            onClose={() => onDeviceSelect?.(null)}
            closeButton={false}
            closeOnClick={false}
          >
            <div style={{ position:'relative', minWidth:230, background:'rgba(7,9,14,0.92)', backdropFilter:'blur(20px)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:14, padding:'14px 16px', color:'var(--t1)', boxShadow:'0 16px 32px -8px rgba(0,0,0,0.6)' }}>
              <button
                onClick={e => { e.stopPropagation(); onDeviceSelect?.(null); }}
                style={{ position:'absolute', top:8, right:8, background:'rgba(255,255,255,0.06)', border:'none', borderRadius:6, padding:4, cursor:'pointer', color:'#94a3b8', display:'flex' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(239,68,68,0.18)'; (e.currentTarget as HTMLButtonElement).style.color='#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color='#94a3b8'; }}
              >
                <X size={13} />
              </button>

              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:selectedDevice.status==='ONLINE'?'#38bdf8':'#ef4444', boxShadow:selectedDevice.status==='ONLINE'?'0 0 6px #38bdf8':'none' }} />
                <span style={{ fontSize:10, fontWeight:700, color:'#38bdf8', textTransform:'uppercase', letterSpacing:1, fontFamily:"'Geist Mono', monospace" }}>{selectedDevice.type}</span>
                <span style={{ fontSize:10, color:'var(--t4)', fontFamily:"'Geist Mono', monospace", marginLeft:'auto' }}>{selectedDevice.ruId}</span>
              </div>

              <div style={{ fontSize:15, fontWeight:600, color:'var(--t1)', marginBottom:12 }}>{selectedDevice.name}</div>

              {selectedDevice.type === 'SENSOR' && (
                <div style={{ marginBottom:12, padding:10, borderRadius:9, background:(selectedDevice.latestPpm||0)>warningThreshold?'rgba(239,68,68,0.1)':'rgba(56,189,248,0.05)', border:`1px solid ${(selectedDevice.latestPpm||0)>warningThreshold?'rgba(239,68,68,0.2)':'rgba(56,189,248,0.1)'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:9, color:'var(--t4)', textTransform:'uppercase', letterSpacing:.5 }}>Gas CH4</span>
                    <span style={{ fontSize:9, fontWeight:700, color:(selectedDevice.latestPpm||0)>warningThreshold?'#ef4444':'#38bdf8', textTransform:'uppercase' }}>
                      {(selectedDevice.latestPpm||0)>warningThreshold?'⚠ LEAK DETECTED':'● SAFE'}
                    </span>
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color:(selectedDevice.latestPpm||0)>warningThreshold?'#ef4444':'#38bdf8', fontFamily:"'Geist Mono', monospace" }}>
                    {selectedDevice.latestPpm?.toFixed(1)||'0.0'} <span style={{ fontSize:10, opacity:.6 }}>PPM</span>
                  </div>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { label:'Battery', value:`${selectedDevice.battery.soc}%`,     color:selectedDevice.battery.soc>20?'#eef2f8':'#ef4444' },
                  { label:'Signal',  value:`${selectedDevice.network.rssi} dBm`, color:'#38bdf8' },
                  { label:'Health',  value:`${selectedDevice.healthScore}%`,     color:selectedDevice.healthScore>=80?'#38bdf8':selectedDevice.healthScore>=50?'#f59e0b':'#ef4444' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize:9, color:'var(--t4)', marginBottom:2, textTransform:'uppercase' }}>{label}</div>
                    <div style={{ fontSize:13, fontWeight:700, color, fontFamily:"'Geist Mono', monospace" }}>{value}</div>
                  </div>
                ))}
              </div>

              {updating === selectedDevice.id && (
                <div style={{ marginTop:10, fontSize:10, color:'#38bdf8', textAlign:'center', fontFamily:"'Geist Mono', monospace" }}>● Syncing location…</div>
              )}
            </div>
          </Popup>
        )}
      </MapGL>

      {/* ── Controls ── */}
      <div style={{ position:'absolute', top:14, right:14, display:'flex', flexDirection:'column', gap:8, zIndex:10 }}>
        <button onClick={() => setShowTopology(v => !v)} title={showTopology?'Hide topology':'Show topology'} style={ctrlBtn(showTopology)}>
          <Share2 size={13} /> TOPO
        </button>
        <button onClick={toggle3D} title={is3D?'Switch to 2D':'Switch to 3D'} style={ctrlBtn(is3D)}>
          <Mountain size={13} /> {is3D?'3D':'2D'}
        </button>
        <button onClick={resetNorth} title="Reset north" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, background:'rgba(11,13,20,0.85)', border:'1px solid rgba(56,189,248,0.15)', borderRadius:8, cursor:'pointer', color:'var(--t3)', backdropFilter:'blur(12px)' }}>
          <Compass size={15} />
        </button>
      </div>

      {/* ── Legend ── */}
      <div style={{ position:'absolute', bottom:14, left:14, background:'rgba(11,13,20,0.88)', backdropFilter:'blur(12px)', border:'1px solid rgba(56,189,248,0.15)', borderRadius:8, padding:'6px 12px', zIndex:10, display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ fontSize:11, color:'var(--t3)', fontFamily:"'Geist Mono', monospace" }}>{devices.length} NODES · {ruId}</span>
        {topoVisible && (
          <>
            <span style={{ width:1, height:14, background:'rgba(255,255,255,0.1)' }} />
            {([['#22c55e','Good'],['#f59e0b','Warn'],['#64748b','Poor']] as [string,string][]).map(([c,l]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:16, height:2.5, background:c, borderRadius:2, display:'block' }} />
                <span style={{ fontSize:10, color:'var(--t4)', fontFamily:"'Geist Mono', monospace" }}>{l}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
