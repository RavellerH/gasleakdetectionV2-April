import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GraphQLClient, gql } from 'graphql-request';
import { PrismaService } from '../prisma/prisma.service';

const GATEWAY_PULL_QUERY = gql`
  query GatewayPull($since: String!) {
    gatewayPull(since: $since) {
      serverTime
      devices {
        id
        macAddress
        name
        ruId
        type
        parentMac
        location { lat lng }
        battery { voltage soc cycles estimatedHours }
        network { rssi rssiMesh rssiStar peersCount hopsToGateway qualityScore parentMac }
        healthScore
        status
      }
      readings {
        id
        deviceId
        confidence
        aiClass
        riskLevel
        timestamp
      }
      eventLogs {
        id
        type
        severity
        deviceId
        ruId
        operatorId
        operatorEmail
        message
        details
        acknowledged
        acknowledgedBy
        acknowledgedAt
        ackNote
        timestamp
      }
    }
  }
`;

interface GatewayPullResponse {
  gatewayPull: {
    serverTime: string;
    devices: Array<{
      id: string; macAddress: string; name: string; ruId: string; type: string;
      parentMac?: string | null;
      location: { lat: number; lng: number };
      battery: { voltage: number; soc: number; cycles?: number | null; estimatedHours?: number | null };
      network: { rssi: number; rssiMesh?: number; rssiStar?: number; peersCount?: number | null; hopsToGateway?: number | null; qualityScore?: string | null; parentMac?: string | null };
      healthScore: number;
      status: string;
    }>;
    readings: Array<{ id: string; deviceId: string; confidence: number; aiClass: number; riskLevel: string; timestamp: string }>;
    eventLogs: Array<{
      id: string; type: string; severity: string; deviceId?: string | null; ruId?: string | null;
      operatorId?: string | null; operatorEmail?: string | null; message: string; details?: string | null;
      acknowledged: boolean; acknowledgedBy?: string | null; acknowledgedAt?: string | null; ackNote?: string | null;
      timestamp: string;
    }>;
  };
}

const EPOCH = new Date(0).toISOString();

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(process.env.SYNC_CRON_EXPRESSION || CronExpression.EVERY_30_SECONDS)
  async pullAll(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous sync cycle still running, skipping this tick');
      return;
    }
    this.running = true;
    try {
      const sources = await this.prisma.ruSource.findMany();
      for (const source of sources) {
        await this.pullOne(source.id, source.baseUrl, source.apiKey, source.lastSyncAt);
      }
    } finally {
      this.running = false;
    }
  }

  private async pullOne(ruId: string, baseUrl: string, apiKey: string, lastSyncAt: Date | null): Promise<void> {
    const since = (lastSyncAt ?? new Date(EPOCH)).toISOString();
    try {
      const client = new GraphQLClient(baseUrl, { headers: { 'x-gateway-key': apiKey } });
      const result = await client.request<GatewayPullResponse>(GATEWAY_PULL_QUERY, { since });
      const { devices, readings, eventLogs, serverTime } = result.gatewayPull;

      for (const d of devices) {
        await this.prisma.device.upsert({
          where: { macAddress: d.macAddress },
          create: {
            id: d.id,
            macAddress: d.macAddress,
            name: d.name,
            deviceType: d.type,
            ruId: d.ruId,
            location: JSON.stringify(d.location),
            batteryStats: JSON.stringify(d.battery),
            networkStats: JSON.stringify(d.network),
            healthScore: d.healthScore,
            status: d.status,
            registeredBy: 'sync',
            registeredAt: new Date(),
            updatedAt: new Date(),
          },
          update: {
            name: d.name,
            deviceType: d.type,
            ruId: d.ruId,
            location: JSON.stringify(d.location),
            batteryStats: JSON.stringify(d.battery),
            networkStats: JSON.stringify(d.network),
            healthScore: d.healthScore,
            status: d.status,
            updatedAt: new Date(),
          },
        });
      }

      // Fast path: createMany in one shot (no skipDuplicates on SQLite, but
      // the common case — a fresh pull with no id overlap — just works).
      // Fall back to per-row upsert only if that fails (re-run after a
      // partial sync, or an overlapping window).
      if (readings.length > 0) {
        const data = readings.map(r => ({
          id: r.id, deviceId: r.deviceId, confidence: r.confidence, aiClass: r.aiClass,
          riskLevel: r.riskLevel, timestamp: new Date(r.timestamp),
        }));
        try {
          await this.prisma.gasReading.createMany({ data });
        } catch {
          for (const row of data) {
            await this.prisma.gasReading.upsert({ where: { id: row.id }, create: row, update: {} });
          }
        }
      }

      if (eventLogs.length > 0) {
        const data = eventLogs.map(l => ({
          id: l.id, type: l.type, severity: l.severity, deviceId: l.deviceId ?? undefined,
          ruId: l.ruId ?? undefined, operatorId: l.operatorId ?? undefined, operatorEmail: l.operatorEmail ?? undefined,
          message: l.message, details: l.details ?? undefined, acknowledged: l.acknowledged,
          acknowledgedBy: l.acknowledgedBy ?? undefined,
          acknowledgedAt: l.acknowledgedAt ? new Date(l.acknowledgedAt) : undefined,
          ackNote: l.ackNote ?? undefined, timestamp: new Date(l.timestamp),
        }));
        try {
          await this.prisma.eventLog.createMany({ data });
        } catch {
          for (const row of data) {
            const { id, ...update } = row;
            await this.prisma.eventLog.upsert({ where: { id }, create: row, update });
          }
        }
      }

      await this.prisma.ruSource.update({
        where: { id: ruId },
        data: { lastSyncAt: new Date(serverTime), lastError: null },
      });
      this.logger.log(`Synced ${ruId}: ${devices.length} devices, ${readings.length} readings, ${eventLogs.length} event logs`);
    } catch (err: any) {
      this.logger.error(`Sync failed for ${ruId}: ${err.message}`);
      await this.prisma.ruSource.update({
        where: { id: ruId },
        data: { lastError: err.message?.slice(0, 500) ?? 'Unknown error' },
      }).catch(() => undefined);
    }
  }
}
