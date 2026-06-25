import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { randomUUID } from 'crypto';
import { Device, CommissionDeviceInput } from '../devices/device.model';
import { DeviceService } from '../devices/device.service';
import { MqttConsumerService } from '../mqtt/mqtt-consumer.service';

@Resolver(() => Device)
export class CommissioningResolver {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly mqttConsumer: MqttConsumerService,
  ) {}

  @Query(() => [Device])
  async pendingDevices(
    @Args('ruId', { type: () => String, nullable: true }) ruId?: string,
  ): Promise<Device[]> {
    return this.deviceService.getPendingDevices(ruId);
  }

  @Mutation(() => Device)
  async commissionDevice(
    @Args('input') input: CommissionDeviceInput,
    @Args('operatorId', { type: () => String }) operatorId: string,
  ): Promise<Device> {
    return this.deviceService.commissionDevice(input, operatorId);
  }

  // Publishes a gld/gateway/cmd/pull request so a technician doesn't have to wait for the
  // node's normal TX interval during install — see memory/commissioning_mode.md §5 step 4.
  @Mutation(() => Boolean)
  async sendTestPull(
    @Args('deviceId', { type: () => String }) deviceId: string,
  ): Promise<boolean> {
    const device = await this.deviceService.markCommissioningInProgress(deviceId);
    this.mqttConsumer.publish('gld/gateway/cmd/pull', {
      requestId: randomUUID(),
      nodeId: device.macAddress,
    });
    return true;
  }
}
