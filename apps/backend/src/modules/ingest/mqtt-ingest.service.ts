import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { PrismaService } from '../prisma/prisma.service';
import { gasClassName, riskLevelFor } from '../devices/gas-class';
import {
  ChTopologyEvent, GldReadingEvent, SUBSCRIBED_TOPICS, TOPICS,
  parseChTopology, parseGatewayStatus, parseGldReading, socFromMv,
} from './pertamina-gld.contract';

const EVENT_SUPPRESS_MS = 15 * 60 * 1000;

/**
 * Subscribes to the normalized topics of the PertaminaGLD Node-RED flow and
 * writes readings, alarms, topology and device health into the RU database.
 * Disabled unless MQTT_URL is set.
 */
@Injectable()
export class MqttIngestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MqttIngest');
  private client?: MqttClient;
  private sweepTimer?: NodeJS.Timeout;
  private queue: Promise<void> = Promise.resolve();
  private readonly lastDiagnostic = new Map<string, number>();
  private readonly offlineAfterMs = Number(process.env.DEVICE_OFFLINE_AFTER_SEC || 900) * 1000;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const url = process.env.MQTT_URL;
    if (!url) {
      this.logger.log('MQTT ingest disabled (MQTT_URL not set)');
      return;
    }
    this.client = connect(url, {
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      clientId: process.env.MQTT_CLIENT_ID || 'gasguard-ru-backend',
      protocolVersion: 4,
      reconnectPeriod: 5000,
    });
    this.client.on('connect', () => {
      this.logger.log(`connected to ${url}`);
      this.client!.subscribe(SUBSCRIBED_TOPICS, { qos: 0 }, err => {
        if (err) this.logger.error(`subscribe failed: ${err.message}`);
      });
    });
    this.client.on('error', err => this.logger.warn(`MQTT error: ${err.message}`));
    // Handle messages one at a time so duplicate checks and device updates do not race.
    this.client.on('message', (topic, payload) => {
      this.queue = this.queue
        .then(() => this.handleMessage(topic, payload))
        .catch(err => this.logger.error(`${topic}: ${err?.message ?? err}`));
    });
    this.sweepTimer = setInterval(() => {
      this.markStaleOffline().catch(err => this.logger.error(`offline sweep: ${err.message}`));
    }, 60 * 1000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    await this.client?.endAsync();
  }

  async handleMessage(topic: string, raw: Buffer | string): Promise<void> {
    let payload: any;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      this.logger.warn(`${topic}: payload is not JSON`);
      return;
    }
    switch (topic) {
      case TOPICS.decoded:
      case TOPICS.alarm: {
        const r = parseGldReading(payload);
        if (!r.ok) {
          this.logger.warn(`${topic}: rejected — ${r.reason}`);
          return;
        }
        await this.ingestReading(r.value);
        return;
      }
      case TOPICS.topology: {
        const r = parseChTopology(payload);
        if (r.ok) await this.ingestTopology(r.value);
        return;
      }
      case TOPICS.gatewayStatus: {
        const r = parseGatewayStatus(payload);
        if (r.ok) await this.touchDevice(r.value.gatewayIdHex, r.value.receivedAt);
        return;
      }
      case TOPICS.integrity:
      case TOPICS.replay:
        await this.diagnostic('SECURITY', 'WARNING', payload.nodeIdHex ?? null,
          `${topic === TOPICS.replay ? 'Replayed record rejected' : 'Record failed authentication'} from ${payload.nodeIdHex ?? 'unknown node'}: ${payload.reason ?? 'no reason given'}`,
          payload);
        return;
      case TOPICS.gatewayError:
        await this.diagnostic('DIAGNOSTIC', 'INFO', null,
          `Gateway bridge/decode error: ${payload.error ?? payload.reason ?? payload.message ?? 'unknown'}`, payload);
        return;
      default:
        return; // gld/server/test and anything else: never stored as production data
    }
  }

  private async ingestReading(ev: GldReadingEvent): Promise<void> {
    const device = await this.prisma.device.findUnique({ where: { macAddress: ev.nodeIdHex } });
    if (!device) {
      await this.diagnostic('UNKNOWN_DEVICE', 'WARNING', ev.nodeIdHex,
        `Reading from unregistered GLD ${ev.nodeIdHex} ignored — add it to the device register`, { nodeIdHex: ev.nodeIdHex });
      return;
    }
    if (await this.prisma.gasReading.findUnique({ where: { sourceKey: ev.sourceKey } })) return;

    const settings = (await this.prisma.systemSettings.findFirst()) ?? { warningThreshold: 0.7, criticalThreshold: 0.8 };
    let riskLevel = riskLevelFor(ev.gasClass, ev.confidence, settings);
    // The GLD raised its own alarm for a gas class: never report it as LOW.
    if (ev.alarm && ev.gasClass !== 0 && riskLevel === 'LOW') riskLevel = 'MIDDLE';

    try {
      await this.prisma.gasReading.create({
        data: {
          deviceId: device.id,
          confidence: ev.confidence,
          aiClass: ev.gasClass,
          riskLevel,
          isDummy: device.isDummy,
          timestamp: ev.receivedAt,
          sourceKey: ev.sourceKey,
          seq: ev.seq,
          alarm: ev.alarm,
          batteryMv: ev.batteryMv,
          externalPower: ev.externalPower,
          gatewayId: ev.gatewayIdHex,
          clusterHeadId: ev.clusterHeadIdHex,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return; // same record delivered twice
      throw err;
    }

    const parent = ev.clusterHeadIdHex
      ? await this.prisma.device.findUnique({ where: { macAddress: ev.clusterHeadIdHex } })
      : null;
    const network = { ...this.json(device.networkStats), ...(ev.clusterHeadIdHex ? { parentMac: ev.clusterHeadIdHex } : {}) };
    const battery = ev.externalPower
      ? { voltage: ev.batteryMv ? ev.batteryMv / 1000 : 0, soc: 100, externalPower: true }
      : ev.batteryMv
        ? { voltage: ev.batteryMv / 1000, soc: socFromMv(ev.batteryMv), externalPower: false }
        : this.json(device.batteryStats);
    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        status: 'ONLINE',
        healthScore: 100,
        lastSeenAt: this.later(device.lastSeenAt, ev.receivedAt),
        batteryStats: JSON.stringify(battery),
        networkStats: JSON.stringify(network),
        ...(parent ? { parentId: parent.id } : {}),
      },
    });

    if (riskLevel === 'LOW' && !ev.alarm) return;
    const type = ev.alarm ? 'GAS_ALARM' : 'THRESHOLD_BREACH';
    const recent = await this.prisma.eventLog.findFirst({
      where: { deviceId: device.id, type, timestamp: { gte: new Date(Date.now() - EVENT_SUPPRESS_MS) } },
    });
    if (recent) return;
    await this.prisma.eventLog.create({
      data: {
        type,
        severity: riskLevel === 'HIGH' || ev.alarm ? 'CRITICAL' : 'WARNING',
        deviceId: device.id,
        ruId: device.ruId,
        message: `${device.name} — ${ev.alarm ? 'GLD alarm' : `${riskLevel} risk detected`} (${gasClassName(ev.gasClass)}, confidence ${ev.confidence.toFixed(2)})`,
        details: JSON.stringify({
          confidence: ev.confidence, aiClass: ev.gasClass, riskLevel, alarm: ev.alarm,
          macAddress: ev.nodeIdHex, deviceName: device.name, area: device.area,
          clusterHeadId: ev.clusterHeadIdHex, gatewayId: ev.gatewayIdHex, seq: ev.seq,
        }),
        timestamp: ev.receivedAt,
      },
    });
  }

  private async ingestTopology(ev: ChTopologyEvent): Promise<void> {
    const ch = await this.prisma.device.findUnique({ where: { macAddress: ev.clusterIdHex } });
    if (!ch) {
      await this.diagnostic('UNKNOWN_DEVICE', 'INFO', ev.clusterIdHex,
        `Topology report from unregistered CH ${ev.clusterIdHex} ignored`, { clusterIdHex: ev.clusterIdHex });
      return;
    }
    // Discovery reports are candidates; only installed routes change the parent.
    const parent = !ev.discoveryOnly && ev.parentIdHex
      ? await this.prisma.device.findUnique({ where: { macAddress: ev.parentIdHex } })
      : null;
    const network = {
      ...this.json(ch.networkStats),
      ...(ev.rssi !== null ? { rssi: ev.rssi, rssiMesh: ev.rssi } : {}),
      ...(ev.meshDepth !== null ? { hopsToGateway: ev.meshDepth } : {}),
      ...(parent ? { parentMac: parent.macAddress } : {}),
    };
    await this.prisma.device.update({
      where: { id: ch.id },
      data: {
        status: 'ONLINE',
        healthScore: 100,
        lastSeenAt: this.later(ch.lastSeenAt, ev.receivedAt),
        networkStats: JSON.stringify(network),
        ...(ev.batteryMv ? { batteryStats: JSON.stringify({ voltage: ev.batteryMv / 1000, soc: socFromMv(ev.batteryMv) }) } : {}),
        ...(parent ? { parentId: parent.id } : {}),
      },
    });
  }

  private async touchDevice(macAddress: string, seenAt: Date): Promise<void> {
    const d = await this.prisma.device.findUnique({ where: { macAddress } });
    if (!d) return;
    await this.prisma.device.update({
      where: { id: d.id },
      data: { status: 'ONLINE', healthScore: 100, lastSeenAt: this.later(d.lastSeenAt, seenAt) },
    });
  }

  /** Field devices that have gone quiet are shown OFFLINE (the dashboards log the change). */
  async markStaleOffline(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.offlineAfterMs);
    const r = await this.prisma.device.updateMany({
      where: { status: 'ONLINE', isDummy: false, lastSeenAt: { lt: cutoff } },
      data: { status: 'OFFLINE', healthScore: 0 },
    });
    return r.count;
  }

  private async diagnostic(type: string, severity: string, nodeIdHex: string | null, message: string, details: unknown): Promise<void> {
    const key = `${type}:${nodeIdHex ?? '-'}`;
    const last = this.lastDiagnostic.get(key) ?? 0;
    if (Date.now() - last < EVENT_SUPPRESS_MS) return;
    this.lastDiagnostic.set(key, Date.now());
    this.logger.warn(message);
    const device = nodeIdHex ? await this.prisma.device.findUnique({ where: { macAddress: nodeIdHex } }) : null;
    await this.prisma.eventLog.create({
      data: {
        type, severity, message,
        deviceId: device?.id,
        ruId: device?.ruId ?? process.env.RU_ID ?? undefined,
        details: JSON.stringify(details).slice(0, 4000),
      },
    });
  }

  private json(s: string | null | undefined): Record<string, unknown> {
    try { return JSON.parse(s || '{}'); } catch { return {}; }
  }

  private later(a: Date | null, b: Date): Date {
    return a && a > b ? a : b;
  }
}
