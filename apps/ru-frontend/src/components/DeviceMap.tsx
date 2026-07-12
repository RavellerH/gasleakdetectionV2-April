'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Marker, MapRef, Source, Layer } from 'react-map-gl';
import type { SkyLayerSpecification } from 'mapbox-gl';
import useSupercluster from 'use-supercluster';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, Compass, Mountain, Share2, BatteryMedium, Wifi, Activity, MapPin, Network, Flame } from 'lucide-react';
import type { Device, SensorTimeline } from '@/lib/graphql';
import { updateDeviceLocation } from '@/lib/graphql';
import { DevicePin } from './DevicePin';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

interface DeviceMapProps {
  devices: Device[];
  ruId: string;
  /* known site coordinates — lets the map open zoomed on the RU before devices load */
  ruCenter?: { lat: number; lng: number };
  sensorTimeline?: SensorTimeline[];
  selectedDevice?: Device | null;
  onDeviceSelect?: (device: Device | null) => void;
  warningThreshold?: number;
  criticalThreshold?: number;
  onDeviceUpdate?: () => void;
}

/* same scale as the Overview heatmap */
function heatmapColor(conf: number | null, warning: number, critical: number): string {
  if (conf === null) return 'rgba(37,99,235,0.06)';
  if (conf >= critical) return 'rgba(239,68,68,0.75)';
  if (conf >= warning) return 'rgba(245,158,11,0.65)';
  const r = Math.min(conf / Math.max(warning, 0.01), 1);
  return `rgba(37,99,235,${0.08 + r * 0.50})`;
}

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
  ruCenter,
  sensorTimeline = [],
  selectedDevice,
  onDeviceSelect,
  warningThreshold  = 0.70,
  criticalThreshold = 0.80,
  onDeviceUpdate,
}: DeviceMapProps) {
  /* open directly on the RU site when its coordinates are known */
  const initialZoom = ruCenter ? 14 : 4.5;

  const mapRef         = useRef<MapRef>(null);
  const animFrameRef   = useRef<number>(0);
  /* start at the RU site; the fly-to-devices effect still refines onto real device positions */
  const lastCenteredRu = useRef<string | null>('ALL');
  const zoomRef        = useRef(initialZoom);
  const boundsRef      = useRef<[number, number, number, number]>([95, -11, 141, 6]);

  const [updating,     setUpdating]     = useState<string | null>(null);
  const [is3D,         setIs3D]         = useState(true);
  const [showTopology, setShowTopology] = useState(true);
  const [showTrend,    setShowTrend]    = useState(true);

  /* viewport state — synced from refs via interval to avoid render loops */
  const [zoom,   setZoom]   = useState(initialZoom);
  const [bounds, setBounds] = useState<[number, number, number, number]>([95, -11, 141, 6]);

  useEffect(() => {
    const id = setInterval(() => {
      setZoom(z => { if (Math.abs(z - zoomRef.current) > 0.01) return zoomRef.current; return z; });
      setBounds(boundsRef.current);
    }, 200);
    return () => clearInterval(id);
  }, []);

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
      latestConfidence: d.latestConfidence ?? 0,
      status:           d.status,
      hasCritical:      (d.latestConfidence ?? 0) >= criticalThreshold,
      hasWarning:       (d.latestConfidence ?? 0) >= warningThreshold,
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
    zoomRef.current = evt.viewState.zoom;
    const b = evt.target.getBounds();
    if (b) boundsRef.current = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ height:500, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, color:'var(--t3)', fontSize:13, fontFamily:"'Geist Mono', monospace", gap:8 }}>
        Set <code style={{ background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:4 }}>NEXT_PUBLIC_MAPBOX_TOKEN</code> in .env to show the map.
      </div>
    );
  }

  if (!isWebGLSupported()) {
    return (
      <div style={{ height:500, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, color:'var(--t3)', fontSize:14, fontFamily:'inherit', gap:8, padding:24 }}>
        <strong style={{ color:'var(--t1)' }}>Map view isn&apos;t available in this browser</strong>
        <span>The interactive map needs a browser feature called WebGL, which appears to be disabled or unsupported here.</span>
        <span>Try updating your browser, enabling hardware acceleration in its settings, or switching to a recent version of Chrome, Edge, or Firefox.</span>
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
    <div style={{ position:'relative', height:'clamp(520px, calc(100vh - 330px), 880px)', width:'100%', borderRadius:14, overflow:'hidden', border:'1px solid var(--card-border)' }}>
      <style>{`
        @keyframes gw-ring { 0% { transform:scale(1); opacity:.7; } 100% { transform:scale(2.2); opacity:0; } }
        @keyframes overlay-in { from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes overlay-in-r { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
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
        initialViewState={ruCenter
          ? { longitude: ruCenter.lng, latitude: ruCenter.lat, zoom: initialZoom, pitch: 55, bearing: -17 }
          : { longitude: 118.0, latitude: -2.5, zoom: initialZoom, pitch: 0, bearing: 0 }}
        style={{ width:'100%', height:'100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        antialias
        onMove={handleMove}
        onLoad={(e) => {
          // Remove built-in 3D buildings from the style to avoid
          // mapbox-gl v3 fill-extrusion shader crash on some GPUs.
          const m = e.target;
          const layers = ['3d-buildings', 'building', 'building-extrusion'];
          for (const id of layers) {
            if (m.getLayer(id)) m.removeLayer(id);
          }
          // Sync initial viewport state
          zoomRef.current = m.getZoom();
          const b = m.getBounds();
          if (b) boundsRef.current = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
          setZoom(zoomRef.current);
          setBounds(boundsRef.current);
        }}
      >
        <Layer {...skyLayer} />

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
                  confidence={device.latestConfidence}
                  warningThreshold={warningThreshold}
                  criticalThreshold={criticalThreshold}
                />
              </div>
            </Marker>
          );
        })}

      </MapGL>

      {/* ── Detail overlay — full device breakdown, slides in over the map ── */}
      {selectedDevice && (() => {
        const d = selectedDevice;
        const conf   = d.latestConfidence ?? 0;
        const isHigh = conf >= criticalThreshold;
        const isMid  = !isHigh && conf >= warningThreshold;
        const riskLabel = isHigh ? 'HIGH RISK' : isMid ? 'MIDDLE RISK' : 'SAFE';
        const riskColor = isHigh ? '#ef4444' : isMid ? '#f59e0b' : '#38bdf8';
        const statusCol = d.status === 'ONLINE' ? '#38bdf8' : d.status === 'OFFLINE' ? '#ef4444' : '#f59e0b';
        const battCol   = d.battery.soc >= 60 ? '#38bdf8' : d.battery.soc >= 30 ? '#f59e0b' : '#ef4444';
        const healthCol = d.healthScore >= 80 ? '#38bdf8' : d.healthScore >= 50 ? '#f59e0b' : '#ef4444';
        const rssiCol   = d.network.rssi > -60 ? '#38bdf8' : d.network.rssi > -75 ? '#f59e0b' : '#ef4444';
        const sectionLabel: React.CSSProperties = { fontSize:9, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:1.2, fontFamily:"'Geist Mono', monospace", display:'flex', alignItems:'center', gap:5 };
        const row = (label: string, value: React.ReactNode) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize:11, color:'var(--t4)' }}>{label}</span>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--t2)', fontFamily:"'Geist Mono', monospace" }}>{value}</span>
          </div>
        );
        return (
          <div style={{ position:'absolute', top:14, left:14, bottom:14, width:310, zIndex:20, background:'rgba(7,9,14,0.92)', backdropFilter:'blur(20px)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:14, padding:'16px 18px', color:'var(--t1)', boxShadow:'0 16px 40px -8px rgba(0,0,0,0.65)', overflowY:'auto', display:'flex', flexDirection:'column', gap:14, animation:'overlay-in 0.25s ease' }}>
            {/* header */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:statusCol, boxShadow:`0 0 6px ${statusCol}`, flexShrink:0 }} />
                  <span style={{ fontSize:10, fontWeight:700, color:'#38bdf8', textTransform:'uppercase', letterSpacing:1, fontFamily:"'Geist Mono', monospace" }}>{d.type}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:statusCol, fontFamily:"'Geist Mono', monospace", marginLeft:'auto' }}>{d.status}</span>
                </div>
                <div style={{ fontSize:16, fontWeight:700, color:'#eef2f8', lineHeight:1.2 }}>{d.name}</div>
                <div style={{ fontSize:10, color:'var(--t4)', fontFamily:"'Geist Mono', monospace", marginTop:3 }}>{d.macAddress}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDeviceSelect?.(null); }}
                style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:6, padding:5, cursor:'pointer', color:'#94a3b8', display:'flex', flexShrink:0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(239,68,68,0.18)'; (e.currentTarget as HTMLButtonElement).style.color='#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color='#94a3b8'; }}
              >
                <X size={14} />
              </button>
            </div>

            {/* AI risk (sensors only) */}
            {d.type === 'SENSOR' && (
              <div style={{ padding:12, borderRadius:10, background:isHigh?'rgba(239,68,68,0.1)':isMid?'rgba(245,158,11,0.1)':'rgba(56,189,248,0.05)', border:`1px solid ${isHigh?'rgba(239,68,68,0.25)':isMid?'rgba(245,158,11,0.25)':'rgba(56,189,248,0.12)'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:9, color:'var(--t4)', textTransform:'uppercase', letterSpacing:.5 }}>AI Gas Detection Confidence</span>
                  <span style={{ fontSize:9, fontWeight:800, color:riskColor, textTransform:'uppercase' }}>{isHigh || isMid ? '⚠ ' : '● '}{riskLabel}</span>
                </div>
                <div style={{ fontSize:24, fontWeight:800, color:riskColor, fontFamily:"'Geist Mono', monospace", marginBottom:8 }}>
                  {(conf * 100).toFixed(1)}<span style={{ fontSize:11, opacity:.6 }}>%</span>
                </div>
                <div style={{ position:'relative', height:5, background:'rgba(255,255,255,0.08)', borderRadius:3 }}>
                  <div style={{ height:'100%', width:`${Math.min(conf * 100, 100)}%`, background:riskColor, borderRadius:3, transition:'width 0.6s ease' }} />
                  <div style={{ position:'absolute', top:-2, bottom:-2, left:`${warningThreshold * 100}%`, width:1.5, background:'#f59e0b' }} title={`MIDDLE ≥ ${warningThreshold}`} />
                  <div style={{ position:'absolute', top:-2, bottom:-2, left:`${criticalThreshold * 100}%`, width:1.5, background:'#ef4444' }} title={`HIGH ≥ ${criticalThreshold}`} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:5, fontSize:8.5, color:'var(--t4)', fontFamily:"'Geist Mono', monospace" }}>
                  <span>0</span><span style={{ color:'#f59e0b' }}>MID {warningThreshold}</span><span style={{ color:'#ef4444' }}>HIGH {criticalThreshold}</span>
                </div>
              </div>
            )}

            {/* vitals */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[
                { icon:BatteryMedium, label:'Battery', value:`${d.battery.soc}%`,      color:battCol },
                { icon:Wifi,          label:'Signal',  value:`${d.network.rssi}dBm`,   color:rssiCol },
                { icon:Activity,      label:'Health',  value:`${d.healthScore}%`,      color:healthCol },
              ].map(({ icon:Icon, label, value, color }) => (
                <div key={label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:9, padding:'9px 8px', textAlign:'center' }}>
                  <Icon size={13} color={color} style={{ margin:'0 auto 4px', display:'block' }} />
                  <div style={{ fontSize:12, fontWeight:700, color, fontFamily:"'Geist Mono', monospace" }}>{value}</div>
                  <div style={{ fontSize:8.5, color:'var(--t4)', textTransform:'uppercase', letterSpacing:.5, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* power */}
            <div>
              <div style={{ ...sectionLabel, marginBottom:4 }}><BatteryMedium size={10} /> Power</div>
              {row('Voltage', `${d.battery.voltage.toFixed(2)} V`)}
              {d.battery.cycles != null && row('Charge cycles', d.battery.cycles)}
              {d.battery.estimatedHours != null && row('Est. runtime', `${d.battery.estimatedHours} h`)}
            </div>

            {/* network */}
            <div>
              <div style={{ ...sectionLabel, marginBottom:4 }}><Network size={10} /> Mesh Network</div>
              {row('Parent node', (d.parentMac ?? d.network.parentMac) || '— (root)')}
              {d.network.hopsToGateway != null && row('Hops to gateway', d.network.hopsToGateway)}
              {d.network.peersCount != null && row('Peers', d.network.peersCount)}
              {d.network.qualityScore != null && row('Link quality', d.network.qualityScore)}
              {d.network.rssiMesh != null && row('RSSI (mesh)', `${d.network.rssiMesh} dBm`)}
              {d.network.rssiStar != null && row('RSSI (star)', `${d.network.rssiStar} dBm`)}
            </div>

            {/* location */}
            <div>
              <div style={{ ...sectionLabel, marginBottom:4 }}><MapPin size={10} /> Location</div>
              {row('Site', d.ruId)}
              {row('Latitude', d.location.lat.toFixed(6))}
              {row('Longitude', d.location.lng.toFixed(6))}
            </div>

            {updating === d.id && (
              <div style={{ fontSize:10, color:'#38bdf8', textAlign:'center', fontFamily:"'Geist Mono', monospace" }}>● Syncing location…</div>
            )}
          </div>
        );
      })()}

      {/* ── Gas / Environment Trend overlay — 24h per-sensor heatmap ── */}
      {showTrend && (
        <div style={{ position:'absolute', top:14, right:14, bottom:14, width:320, zIndex:15, background:'rgba(7,9,14,0.9)', backdropFilter:'blur(20px)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:14, padding:'14px 16px', color:'var(--t1)', boxShadow:'0 16px 40px -8px rgba(0,0,0,0.65)', display:'flex', flexDirection:'column', gap:10, animation:'overlay-in-r 0.25s ease' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#eef2f8' }}>Gas / Environment Trend</div>
              <div style={{ fontSize:9.5, color:'var(--t4)', fontFamily:"'Geist Mono', monospace", marginTop:2 }}>
                24H · PER SENSOR · {sensorTimeline.length} SENSOR{sensorTimeline.length !== 1 ? 'S' : ''}
              </div>
            </div>
            <button
              onClick={() => setShowTrend(false)}
              style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:6, padding:5, cursor:'pointer', color:'#94a3b8', display:'flex', flexShrink:0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(239,68,68,0.18)'; (e.currentTarget as HTMLButtonElement).style.color='#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color='#94a3b8'; }}
            >
              <X size={14} />
            </button>
          </div>

          {sensorTimeline.length > 0 ? (
            <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
              {/* hour axis — label every 6h to fit the narrow panel */}
              <div style={{ display:'grid', gridTemplateColumns:'76px repeat(24, 1fr)', gap:1.5, position:'sticky', top:0, background:'rgba(7,9,14,0.95)', zIndex:2, paddingBottom:3 }}>
                <div style={{ fontSize:8, color:'var(--t4)', fontFamily:"'Geist Mono', monospace", display:'flex', alignItems:'flex-end', paddingLeft:2 }}>SENSOR</div>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ fontSize:8, color:'var(--t4)', fontFamily:"'Geist Mono', monospace", textAlign:'left', overflow:'visible', whiteSpace:'nowrap' }}>
                    {h % 6 === 0 ? String(h).padStart(2, '0') : ''}
                  </div>
                ))}
              </div>
              {sensorTimeline.map(s => {
                const hourMap = new Map(s.data.map(pt => [pt.hour, pt.confidence]));
                const isSel = selectedDevice?.id === s.deviceId;
                const dev = devices.find(dd => dd.id === s.deviceId);
                return (
                  <div
                    key={s.deviceId}
                    onClick={() => { if (dev) onDeviceSelect?.(isSel ? null : dev); }}
                    title={dev ? `Click to ${isSel ? 'deselect' : 'locate'} ${s.deviceName}` : s.deviceName}
                    style={{ display:'grid', gridTemplateColumns:'76px repeat(24, 1fr)', gap:1.5, marginBottom:2, cursor:dev?'pointer':'default', background:isSel?'rgba(56,189,248,0.08)':'transparent', borderRadius:4, padding:'1px 0' }}
                  >
                    <div style={{ fontSize:9, color:isSel?'#38bdf8':'var(--t2)', fontWeight:isSel?700:400, fontFamily:"'Geist Mono', monospace", display:'flex', alignItems:'center', paddingLeft:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {s.deviceName}
                    </div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const hourKey = `${String(h).padStart(2, '0')}:00`;
                      const conf = hourMap.get(hourKey) ?? null;
                      return (
                        <div key={h}
                          title={`${s.deviceName} @ ${hourKey}: ${conf !== null ? (conf * 100).toFixed(1) + '%' : '—'}`}
                          style={{ height:15, borderRadius:2, background:heatmapColor(conf, warningThreshold, criticalThreshold), border:'1px solid rgba(255,255,255,0.04)' }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)', fontSize:11, fontFamily:"'Geist Mono', monospace", textAlign:'center' }}>
              NO SENSOR READINGS<br />IN LAST 24H
            </div>
          )}

          {/* legend */}
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:9, color:'var(--t4)', fontFamily:"'Geist Mono', monospace", borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:8, flexWrap:'wrap' }}>
            <span>Low</span>
            <div style={{ display:'flex', gap:2 }}>
              {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((r, i) => (
                <div key={i} style={{ width:14, height:8, borderRadius:2, background:heatmapColor(r, 0.999, 1) }} />
              ))}
            </div>
            <span>High</span>
            <span style={{ color:'#f59e0b', marginLeft:6 }}>▪ MID ≥{warningThreshold}</span>
            <span style={{ color:'#ef4444' }}>▪ HIGH ≥{criticalThreshold}</span>
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ position:'absolute', top:14, right: showTrend ? 342 : 14, display:'flex', flexDirection:'column', gap:8, zIndex:10, transition:'right 0.25s ease' }}>
        <button onClick={() => setShowTrend(v => !v)} title={showTrend?'Hide gas trend':'Show gas trend'} style={ctrlBtn(showTrend)}>
          <Flame size={13} /> TREND
        </button>
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
