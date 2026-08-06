import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    await this.prisma.$queryRaw`SELECT 1`;
    const sources = await this.prisma.ruSource.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, lastSyncAt: true, lastError: true },
    });
    const healthy = sources.length === 6 && sources.every(source => source.lastSyncAt && !source.lastError);
    return {
      status: healthy ? 'ok' : 'degraded',
      database: 'ok',
      checkedAt: new Date().toISOString(),
      sources,
    };
  }
}
