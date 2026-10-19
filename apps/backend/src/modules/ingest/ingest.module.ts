import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttIngestService } from './mqtt-ingest.service';

@Module({
  providers: [MqttIngestService, PrismaService],
})
export class IngestModule {}
