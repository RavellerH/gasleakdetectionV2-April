import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

function retentionDays(name: string, fallback: number): number {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
    throw new Error(`${name} must be an integer between 1 and 3650`);
  }
  return parsed;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Daily at 02:15 server time. Device/source/user records are never purged.
  @Cron('0 15 2 * * *')
  async purgeExpiredData(): Promise<void> {
    const now = Date.now();
    const readingCutoff = new Date(now - retentionDays('READING_RETENTION_DAYS', 7) * 86_400_000);
    const eventCutoff = new Date(now - retentionDays('EVENT_RETENTION_DAYS', 7) * 86_400_000);
    const criticalCutoff = new Date(now - retentionDays('CRITICAL_EVENT_RETENTION_DAYS', 90) * 86_400_000);

    const [readings, events] = await this.prisma.$transaction([
      this.prisma.gasReading.deleteMany({ where: { timestamp: { lt: readingCutoff } } }),
      this.prisma.eventLog.deleteMany({
        where: {
          OR: [
            { severity: { not: 'CRITICAL' }, timestamp: { lt: eventCutoff } },
            { severity: 'CRITICAL', timestamp: { lt: criticalCutoff } },
          ],
        },
      }),
    ]);

    this.logger.log(`Retention removed ${readings.count} readings and ${events.count} events`);
  }
}
