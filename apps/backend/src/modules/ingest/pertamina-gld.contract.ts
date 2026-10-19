// Contract for the MQTT topics published by the PertaminaGLD Node-RED flow
// (fadlurrahmanf/PertaminaGLD, server/nodered/functions/pertamina-gld-decode.js).
// Node-RED publishes the event objects as JSON, MQTT 3.1.1, QoS 0.

export const TOPICS = {
  decoded: 'gld/server/decoded',     // authenticated GLD record, alarm flag clear
  alarm: 'gld/server/alarm',         // authenticated GLD record, alarm flag set
  topology: 'gld/server/topology',   // CH topology / discovery report
  gatewayStatus: 'gld/gateway/status',
  integrity: 'gld/server/integrity', // record failed authentication / validation
  replay: 'gld/server/replay',       // replayed record or AES-GCM nonce reuse
  gatewayError: 'gld/gateway/error', // bridge / decode failure
  test: 'gld/server/test',           // test-vector or manual traffic, never production
} as const;

export const SUBSCRIBED_TOPICS = Object.values(TOPICS);

const HEX_ID = /^0x[0-9A-F]{4}$/;
const GATEWAY_RANGE: [number, number] = [0x0001, 0x000f];
const CH_RANGE: [number, number] = [0x0010, 0x0fff];
const GLD_RANGE: [number, number] = [0x1001, 0xfeff];

export function idHex(value: unknown): string | null {
  if (typeof value === 'string' && HEX_ID.test(value.toUpperCase().replace(/^0X/, '0x'))) {
    return value.toUpperCase().replace(/^0X/, '0x');
  }
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) return null;
  return `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
}

function inRange(hex: string | null, [min, max]: [number, number]): hex is string {
  if (!hex) return false;
  const n = parseInt(hex, 16);
  return n >= min && n <= max;
}

export const isGatewayId = (hex: string | null): hex is string => inRange(hex, GATEWAY_RANGE);
export const isClusterHeadId = (hex: string | null): hex is string => inRange(hex, CH_RANGE);
export const isGldId = (hex: string | null): hex is string => inRange(hex, GLD_RANGE);

function validDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface GldReadingEvent {
  nodeIdHex: string;
  sourceKey: string;       // keyId:nonceHex — unique per authenticated record
  receivedAt: Date;
  gasClass: number;        // 0..7, see devices/gas-class.ts
  confidence: number;      // 0.0..1.0 (Node-RED sends 0..100)
  alarm: boolean;
  seq: number;
  batteryMv: number | null;
  externalPower: boolean;
  gatewayIdHex: string | null;
  clusterHeadIdHex: string | null;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/** gld/server/decoded and gld/server/alarm payloads. */
export function parseGldReading(p: any): ParseResult<GldReadingEvent> {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'payload is not an object' };
  if (p.ok !== true || p.decryptOk !== true) return { ok: false, reason: 'record not authenticated (ok/decryptOk not true)' };
  if (p.ingressClass !== 'production') return { ok: false, reason: `ingressClass ${p.ingressClass} is not production` };
  const nodeIdHex = idHex(p.nodeIdHex ?? p.nodeId);
  if (!isGldId(nodeIdHex)) return { ok: false, reason: `node ID ${p.nodeIdHex ?? p.nodeId} is not a GLD ID` };
  if (!Number.isInteger(p.gasClass) || p.gasClass < 0 || p.gasClass > 7) return { ok: false, reason: `invalid gasClass ${p.gasClass}` };
  if (!Number.isInteger(p.confidence) || p.confidence < 0 || p.confidence > 100) return { ok: false, reason: `invalid confidence ${p.confidence}` };
  if (typeof p.nonceHex !== 'string' || !/^[0-9A-F]{24}$/i.test(p.nonceHex)) return { ok: false, reason: 'missing AES-GCM nonce' };
  const receivedAt = validDate(p.receivedAt);
  if (!receivedAt) return { ok: false, reason: 'missing receivedAt' };

  const outer = p.outer && typeof p.outer === 'object' ? p.outer : {};
  const gw = idHex(outer.gatewayIdHex ?? outer.gatewayId);
  const src = idHex(outer.srcIdHex);
  const batteryValid = p.batteryValid !== false && Number.isInteger(p.batteryMv) && p.batteryMv !== 0xffff;
  return {
    ok: true,
    value: {
      nodeIdHex,
      sourceKey: `${p.keyId ?? 0}:${p.nonceHex.toUpperCase()}`,
      receivedAt,
      gasClass: p.gasClass,
      confidence: p.confidence / 100,
      alarm: p.alarm === true,
      seq: Number(p.seq) & 0xff,
      batteryMv: batteryValid ? p.batteryMv : null,
      externalPower: p.externalPower === true,
      gatewayIdHex: isGatewayId(gw) ? gw : null,
      clusterHeadIdHex: isClusterHeadId(src) ? src : null,
    },
  };
}

export interface ChTopologyEvent {
  clusterIdHex: string;
  parentIdHex: string | null; // gateway or CH; null when unknown (0x0000)
  gatewayIdHex: string | null;
  receivedAt: Date;
  batteryMv: number | null;
  meshDepth: number | null;
  rssi: number | null;
  discoveryOnly: boolean;
}

/** gld/server/topology payloads (kind "ch-topology"). */
export function parseChTopology(p: any): ParseResult<ChTopologyEvent> {
  if (!p || typeof p !== 'object' || p.ok !== true) return { ok: false, reason: 'not an ok topology event' };
  const clusterIdHex = idHex(p.clusterIdHex ?? p.clusterId);
  if (!isClusterHeadId(clusterIdHex)) return { ok: false, reason: `cluster ID ${p.clusterIdHex ?? p.clusterId} is not a CH ID` };
  const parent = idHex(p.parentIdHex ?? p.parentId);
  const gw = idHex(p.gatewayIdHex ?? p.gatewayId);
  const rssiRaw = p.parentLinkMetricValid ? p.parentRxRssiDbm : (p.gatewayIngressRssiDbm ?? p.rssi);
  const rssi = Number(rssiRaw);
  const batteryMv = Number(p.batteryMv);
  return {
    ok: true,
    value: {
      clusterIdHex,
      parentIdHex: isGatewayId(parent) || isClusterHeadId(parent) ? parent : null,
      gatewayIdHex: isGatewayId(gw) ? gw : null,
      receivedAt: validDate(p.receivedAt) ?? new Date(),
      batteryMv: Number.isInteger(batteryMv) && batteryMv > 0 && batteryMv !== 0xffff ? batteryMv : null,
      meshDepth: Number.isInteger(p.meshDepth) ? p.meshDepth : null,
      rssi: rssiRaw !== undefined && rssiRaw !== null && Number.isFinite(rssi) ? Math.round(rssi) : null,
      discoveryOnly: p.discoveryOnly === true,
    },
  };
}

/**
 * gld/gateway/status: both the gateway's own status object (gateway_id) and the
 * Node-RED re-publication (kind "gateway-status", gatewayIdHex) use this topic.
 */
export function parseGatewayStatus(p: any): ParseResult<{ gatewayIdHex: string; receivedAt: Date }> {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'payload is not an object' };
  const gw = idHex(p.gatewayIdHex ?? p.gatewayId ?? p.gateway_id);
  if (!isGatewayId(gw)) return { ok: false, reason: `gateway ID ${p.gatewayIdHex ?? p.gatewayId ?? p.gateway_id} out of range` };
  return { ok: true, value: { gatewayIdHex: gw, receivedAt: validDate(p.receivedAt) ?? new Date() } };
}

/** Rough Li-ion state of charge for display only (3.30 V = 0 %, 4.20 V = 100 %). */
export function socFromMv(mv: number): number {
  return Math.max(0, Math.min(100, Math.round(((mv - 3300) / 900) * 100)));
}
