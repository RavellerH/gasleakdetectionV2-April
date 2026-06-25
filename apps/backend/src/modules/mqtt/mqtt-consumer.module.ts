import { Module } from '@nestjs/common';
import { MqttConsumerService } from './mqtt-consumer.service';
import { DeviceModule } from '../devices/device.module';

@Module({
  imports: [DeviceModule],
  providers: [MqttConsumerService],
  exports: [MqttConsumerService],
})
export class MqttConsumerModule {}
