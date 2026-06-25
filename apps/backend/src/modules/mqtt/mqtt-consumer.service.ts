import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import mqtt, { MqttClient } from 'mqtt';
import { DeviceService } from '../devices/device.service';
import { PrismaService } from '../prisma/prisma.service';

// Decoded event shape published by the per-RU Node-RED bridge — see
// memory/pertamina_gld_protocol.md ("decoded event JSON shape") for the authoritative reference.
interface DecodedGldEvent {
  ok: boolean;
  kind: string;
  nodeIdHex: string;
  gasClass: number;
  gasName?: string;
  confidence: number; // 0-100 on the wire
  batteryMv?: number;
  alarm?: boolean;
  externalPower?: boolean;
  decryptOk: boolean;
}

interface GatewayStatusEvent {
  gatewayId?: string;
  online?: boolean;
}

interface GatewayErrorEvent {
  message?: string;
  nodeIdHex?: string;
}

const TOPICS = ['gld/server/decoded', 'gld/server/alarm', 'gld/gateway/status', 'gld/gateway/error'];

@Injectable()
export class MqttConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttConsumerService.name);
  private client?: MqttClient;

  constructor(
    private readonly deviceService: DeviceService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const settings = await this.prisma.systemSettings.findUnique({ where: { id: 1 } });
    const host = settings?.mqttBrokerHost || process.env.MQTT_BROKER_HOST || '127.0.0.1';
    const port = settings?.mqttBrokerPort || Number(process.env.MQTT_BROKER_PORT) || 1884;
    const url = `mqtt://${host}:${port}`;

    this.client = mqtt.connect(url, { reconnectPeriod: 5000 });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker at ${url}`);
      this.client!.subscribe(TOPICS, (err) => {
        if (err) this.logger.error(`Failed to subscribe to GLD topics: ${err.message}`);
      });
    });

    this.client.on('reconnect', () => this.logger.warn(`Reconnecting to MQTT broker at ${url}...`));
    this.client.on('error', (err) => this.logger.error(`MQTT connection error: ${err.message}`));

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload).catch((err) => {
        this.logger.error(`Failed to handle message on ${topic}: ${err.message}`);
      });
    });
  }

  async onModuleDestroy() {
    this.client?.end();
  }

  // Used by the commissioning wizard's "test pull" button — see memory/server_integration_plan.md §D.
  publish(topic: string, payload: object) {
    if (!this.client) {
      this.logger.warn(`Cannot publish to ${topic}: MQTT client not connected`);
      return;
    }
    this.client.publish(topic, JSON.stringify(payload));
  }

  private async handleMessage(topic: string, payload: Buffer) {
    let msg: unknown;
    try {
      msg = JSON.parse(payload.toString());
    } catch {
      this.logger.warn(`Ignoring non-JSON message on ${topic}`);
      return;
    }

    switch (topic) {
      case 'gld/server/decoded':
      case 'gld/server/alarm':
        await this.handleDecodedEvent(msg as DecodedGldEvent);
        break;
      case 'gld/gateway/status':
        await this.handleGatewayStatus(msg as GatewayStatusEvent);
        break;
      case 'gld/gateway/error':
        await this.handleGatewayError(msg as GatewayErrorEvent);
        break;
    }
  }

  // Normal + alarm readings share the same path — DeviceService.addReading() derives riskLevel
  // and applies the commissioning gate (see memory/commissioning_mode.md §3).
  private async handleDecodedEvent(msg: DecodedGldEvent) {
    if (!msg?.nodeIdHex || !msg.decryptOk) {
      this.logger.warn(`Discarding undecodable event: ${JSON.stringify(msg)}`);
      return;
    }
    const confidence01 = Math.max(0, Math.min(1, (msg.confidence ?? 0) / 100));
    const powerMode = msg.externalPower ? 'EXTERNAL' : 'BATTERY';
    await this.deviceService.addReading(msg.nodeIdHex, confidence01, msg.gasClass ?? 0, powerMode);
  }

  private async handleGatewayStatus(msg: GatewayStatusEvent) {
    if (!msg?.gatewayId) return;
    await this.prisma.device.updateMany({
      where: { macAddress: msg.gatewayId },
      data: { lastSeenAt: new Date(), status: msg.online === false ? 'OFFLINE' : 'ONLINE' },
    });
  }

  // Ops visibility for parse/decrypt failures surfaced by Node-RED — not a device alarm.
  private async handleGatewayError(msg: GatewayErrorEvent) {
    await this.prisma.eventLog.create({
      data: {
        type: 'GATEWAY_ERROR',
        severity: 'WARNING',
        message: msg?.message || 'Gateway/Node-RED reported a decode error',
        details: JSON.stringify(msg ?? {}),
      },
    });
  }
}
