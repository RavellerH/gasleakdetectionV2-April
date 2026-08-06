import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';
import { RetentionService } from './retention.service';

@Module({
  controllers: [HealthController],
  providers: [SyncService, RetentionService, PrismaService]
})
export class SyncModule {}
