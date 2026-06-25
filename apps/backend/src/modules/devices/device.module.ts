import { Module } from '@nestjs/common';
import { DeviceResolver } from './device.resolver';
import { UserResolver } from './user.resolver';
import { DeviceService } from './device.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [DeviceResolver, UserResolver, DeviceService, PrismaService],
  exports: [DeviceService, PrismaService]
})
export class DeviceModule {}

