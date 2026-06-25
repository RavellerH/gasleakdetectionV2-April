import { Module } from '@nestjs/common';
import { CommissioningResolver } from './commissioning.resolver';
import { DeviceModule } from '../devices/device.module';
import { MqttConsumerModule } from '../mqtt/mqtt-consumer.module';

@Module({
  imports: [DeviceModule, MqttConsumerModule],
  providers: [CommissioningResolver],
})
export class CommissioningModule {}
