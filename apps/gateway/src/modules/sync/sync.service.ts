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
      id: string;
      macAddress: string;
      name: string;
      ruId: string;
      type: string;
      parentMac?: string | null;
      location: { lat: number; lng: number };
      battery: { voltage: number; soc: number; cycles?: number | null; estimatedHours?: number | null };
      network: {
        rssi: number;
        rssiMesh?: number;
        rssiStar?: number;
        peersCount?: number | null;
        hopsToGateway?: number | null;
        qualityScore?: string | null;
        parentMac?: string | null;
      };
      healthScore: number;
      status: string;
    }>;
    readings: Array<{
      id: string;
      deviceId: string;
      confidence: number;
      aiClass: number;
      riskLevel: string;
      timestamp: string;
    }>;
    eventLogs: Array<{
      id: string;
      type: string;
      severity: string;
      deviceId?: string | null;
      ruId?: string | null;
      operatorId?: string | null;
      operatorEmail?: string | null;
      message: string;
      details?: string | null;
      acknowledged: boolean;
      acknowledgedBy?: string | null;
      acknowledgedAt?: string | null;
      ackNote?: string | null;
      timestamp: string;
    }>;
  };
}

const EPOCH = new Date(0).toISOString();
const REQUEST_TIMEOUT_MS = Number(process.env.SYNC_REQUEST_TIMEOUT_MS ?? 20_000);

function scopedId(ruId: string, sourceId: string): string {
  return `${ruId}:${sourceId}`;
}

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
      const sources = await this.prisma.ruSource.findMany({ orderBy: { id: 'asc' } });
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
      const parsedUrl = new URL(baseUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('RU source URL must use HTTP or HTTPS');
      const client = new GraphQLClient(baseUrl, {
        headers: { 'x-gateway-key': apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const result = await client.request<GatewayPullResponse>(GATEWAY_PULL_QUERY, { since });
      const { devices, readings, eventLogs, serverTime } = result.gatewayPull;
      const syncTime = new Date(serverTime);
      if (!Number.isFinite(syncTime.getTime())) throw new Error('RU returned an invalid serverTime');
      if (devices.some(device => device.ruId !== ruId)) {
        throw new Error(`RU source ${ruId} returned a device belonging to another RU`);
      }

      await this.prisma.$transaction(async tx => {
        for (const device of devices) {
          await tx.device.upsert({
            where: { ruId_sourceId: { ruId, sourceId: device.id } },
            create: {
              id: scopedId(ruId, device.id),
              sourceId: device.id,
              macAddress: device.macAddress,
              name: device.name,
              deviceType: device.type,
              ruId,
              location: JSON.stringify(device.location),
              batteryStats: JSON.stringify(device.battery),
              networkStats: JSON.stringify(device.network),
              healthScore: device.healthScore,
              status: device.status,
              registeredBy: 'sync',
              registeredAt: syncTime,
              updatedAt: syncTime,
            },
            update: {
              macAddress: device.macAddress,
              name: device.name,
              deviceType: device.type,
              location: JSON.stringify(device.location),
              batteryStats: JSON.stringify(device.battery),
              networkStats: JSON.stringify(device.network),
              healthScore: device.healthScore,
              status: device.status,
              updatedAt: syncTime,
            },
          });
        }

        const referencedSourceIds = [...new Set([
          ...readings.map(reading => reading.deviceId),
          ...eventLogs.flatMap(event => event.deviceId ? [event.deviceId] : []),
        ])];
        const mappedDevices = referencedSourceIds.length === 0 ? [] : await tx.device.findMany({
          where: { ruId, sourceId: { in: referencedSourceIds } },
          select: { id: true, sourceId: true },
        });
        const deviceIds = new Map(mappedDevices.map(device => [device.sourceId, device.id]));

        if (readings.length > 0) {
          const data = readings.map(reading => {
            const deviceId = deviceIds.get(reading.deviceId);
            if (!deviceId) throw new Error(`Reading ${reading.id} references unknown RU device ${reading.deviceId}`);
            return {
              id: scopedId(ruId, reading.id),
              sourceId: reading.id,
              ruId,
              deviceId,
              confidence: reading.confidence,
              aiClass: reading.aiClass,
              riskLevel: reading.riskLevel,
              timestamp: new Date(reading.timestamp),
            };
          });
          await tx.gasReading.createMany({ data, skipDuplicates: true });
        }

        for (const event of eventLogs) {
          const id = scopedId(ruId, event.id);
          const data = {
            sourceId: event.id,
            type: event.type,
            severity: event.severity,
            deviceId: event.deviceId ? deviceIds.get(event.deviceId) ?? scopedId(ruId, event.deviceId) : undefined,
            ruId,
            operatorId: event.operatorId ?? undefined,
            operatorEmail: event.operatorEmail ?? undefined,
            message: event.message,
            details: event.details ?? undefined,
            acknowledged: event.acknowledged,
            acknowledgedBy: event.acknowledgedBy ?? undefined,
            acknowledgedAt: event.acknowledgedAt ? new Date(event.acknowledgedAt) : undefined,
            ackNote: event.ackNote ?? undefined,
            timestamp: new Date(event.timestamp),
          };
          await tx.eventLog.upsert({ where: { id }, create: { id, ...data }, update: data });
        }

        await tx.ruSource.update({
          where: { id: ruId },
          data: { lastSyncAt: syncTime, lastError: null },
        });
      });

      this.logger.log(`Synced ${ruId}: ${devices.length} devices, ${readings.length} readings, ${eventLogs.length} event logs`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Sync failed for ${ruId}: ${message}`);
      await this.prisma.ruSource.update({
        where: { id: ruId },
        data: { lastError: message.slice(0, 500) },
      }).catch(() => undefined);
    }
  }
}
