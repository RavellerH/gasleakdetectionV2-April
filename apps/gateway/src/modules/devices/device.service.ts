import { Injectable } from '@nestjs/common';
import { Device, DeviceLocation, BatteryMetrics, NetworkMetrics, GasReading, DashboardStats, RuStats, TimelineEntry, Alert, BatteryDistEntry, NetworkQualityEntry, SystemSettings, User, LoginResult, AnalyticsStats, WeeklyTrendEntry, SiteRanking, EventLog, SensorTimeline, TrendPoint, RuComparisonEntry, HeatmapCell, TopSensorEntry, FleetBatteryBucket, FleetNetworkBucket, FleetHealthStats, RuSite } from './device.model';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only mirror of apps/backend's DeviceService, adapted to read from the
 * gateway's aggregate DB instead of a live RU database. No mutations here —
 * all writes happen at the RU, the gateway only ever reads what sync.service
 * pulled in.
 */
@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly RU_SITES = ['RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];

  // --- ANALYTICS ---

  async getAnalytics(ruId?: string, hours: number = 24): Promise<AnalyticsStats> {
    const settings = await this.getSettings();
    const { warningThreshold: warning } = settings;

    const now = Date.now();
    const cutoff = new Date(now - hours * 3600000);
    const cutoff7d = new Date(now - 7 * 24 * 3600000);

    const allDevices = await this.prisma.device.findMany();
    const allReadings7d = await this.prisma.gasReading.findMany({
      where: { timestamp: { gte: cutoff7d } },
      orderBy: { timestamp: 'asc' },
    });

    const scopedDevices = ruId && ruId !== 'ALL'
      ? allDevices.filter(d => d.ruId === ruId)
      : allDevices;
    const scopedIds = new Set(scopedDevices.map(d => d.id));
    const scopedReadings7d = allReadings7d.filter(r => scopedIds.has(r.deviceId));
    const scopedReadings = scopedReadings7d.filter(r => new Date(r.timestamp).getTime() >= cutoff.getTime());

    const trendData: TrendPoint[] = [];
    if (hours <= 24) {
      for (let h = hours - 1; h >= 0; h--) {
        const bStart = new Date(now - (h + 1) * 3600000);
        const bEnd = new Date(now - h * 3600000);
        const bucket = scopedReadings.filter(r => {
          const t = new Date(r.timestamp).getTime();
          return t >= bStart.getTime() && t < bEnd.getTime();
        });
        const label = `${String(bEnd.getHours()).padStart(2, '0')}:00`;
        trendData.push({
          label,
          avgPpm: bucket.length > 0 ? Math.round(bucket.reduce((s, r) => s + r.confidence, 0) / bucket.length * 1000) / 1000 : 0,
          breachCount: bucket.filter(r => r.riskLevel !== 'LOW').length,
        });
      }
    } else {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let d = 6; d >= 0; d--) {
        const bStart = new Date(now - (d + 1) * 24 * 3600000);
        const bEnd = new Date(now - d * 24 * 3600000);
        const bucket = scopedReadings7d.filter(r => {
          const t = new Date(r.timestamp).getTime();
          return t >= bStart.getTime() && t < bEnd.getTime();
        });
        trendData.push({
          label: dayNames[bEnd.getDay()],
          avgPpm: bucket.length > 0 ? Math.round(bucket.reduce((s, r) => s + r.confidence, 0) / bucket.length * 1000) / 1000 : 0,
          breachCount: bucket.filter(r => r.riskLevel !== 'LOW').length,
        });
      }
    }

    const ruIds = Array.from<string>(new Set(allDevices.map(d => d.ruId))).sort();
    const twoHoursAgo = new Date(now - 2 * 3600000);

    const ruComparison: RuComparisonEntry[] = ruIds.map(ru => {
      const ruDevs = allDevices.filter(d => d.ruId === ru);
      const ruIds7d = new Set(ruDevs.map(d => d.id));
      const ruR = allReadings7d.filter(r => ruIds7d.has(r.deviceId));
      const ruRScoped = ruR.filter(r => new Date(r.timestamp).getTime() >= cutoff.getTime());
      const avgPpm = ruRScoped.length > 0 ? ruRScoped.reduce((s, r) => s + r.confidence, 0) / ruRScoped.length : 0;
      const maxPpm = ruRScoped.length > 0 ? Math.max(...ruRScoped.map(r => r.confidence)) : 0;

      const socValues = ruDevs.map(d => {
        try { return (JSON.parse(d.batteryStats as string) as any).soc ?? 0; } catch { return 0; }
      });
      const avgHealth = socValues.length > 0 ? Math.round(socValues.reduce((s, v) => s + v, 0) / socValues.length) : 0;

      const recentDeviceIds = new Set(allReadings7d
        .filter(r => ruIds7d.has(r.deviceId) && new Date(r.timestamp).getTime() >= twoHoursAgo.getTime())
        .map(r => r.deviceId));

      return {
        ruId: ru,
        avgPpm: Math.round(avgPpm * 10) / 10,
        maxPpm: Math.round(maxPpm * 10) / 10,
        breachCount: ruRScoped.filter(r => r.riskLevel !== 'LOW').length,
        totalDevices: ruDevs.length,
        onlineDevices: recentDeviceIds.size,
        avgHealth,
      };
    });

    const heatmap: HeatmapCell[] = [];
    for (const ru of ruIds) {
      const ruDevs = allDevices.filter(d => d.ruId === ru);
      const ruDevIds = new Set(ruDevs.map(d => d.id));
      const ruR = allReadings7d.filter(r => ruDevIds.has(r.deviceId));
      for (let h = 0; h < 24; h++) {
        const hourReadings = ruR.filter(r => new Date(r.timestamp).getHours() === h);
        heatmap.push({
          hour: h,
          ruId: ru,
          avgPpm: hourReadings.filter(r => r.riskLevel !== 'LOW').length,
        });
      }
    }

    const sensorDevices = scopedDevices.filter(d => d.deviceType === 'SENSOR');
    const topSensors: TopSensorEntry[] = sensorDevices.map(sensor => {
      const sr = scopedReadings.filter(r => r.deviceId === sensor.id);
      const avgPpm = sr.length > 0 ? sr.reduce((s, r) => s + r.confidence, 0) / sr.length : 0;
      const maxPpm = sr.length > 0 ? Math.max(...sr.map(r => r.confidence)) : 0;
      return {
        deviceId: sensor.id,
        deviceName: sensor.name,
        ruId: sensor.ruId,
        avgPpm: Math.round(avgPpm * 1000) / 1000,
        maxPpm: Math.round(maxPpm * 1000) / 1000,
        breachCount: sr.filter(r => r.riskLevel !== 'LOW').length,
      };
    }).sort((a, b) => b.avgPpm - a.avgPpm).slice(0, 15);

    const BATTERY_BUCKETS = [
      { range: '75–100%', min: 75, max: 101 },
      { range: '50–74%', min: 50, max: 75 },
      { range: '25–49%', min: 25, max: 50 },
      { range: '0–24%', min: 0, max: 25 },
    ];
    const batteryDist: FleetBatteryBucket[] = BATTERY_BUCKETS.map(b => ({
      range: b.range,
      count: scopedDevices.filter(d => {
        try {
          const soc = (JSON.parse(d.batteryStats as string) as any).soc ?? -1;
          return soc >= b.min && soc < b.max;
        } catch { return false; }
      }).length,
    }));

    const networkDist: FleetNetworkBucket[] = ['A', 'B', 'C', 'D'].map(grade => ({
      grade,
      count: scopedDevices.filter(d => {
        try {
          return (JSON.parse(d.networkStats as string) as any).qualityScore === grade;
        } catch { return false; }
      }).length,
    }));

    const onlineSensorIds = new Set(scopedReadings7d
      .filter(r => new Date(r.timestamp).getTime() >= twoHoursAgo.getTime())
      .map(r => r.deviceId));
    const sensorCount = scopedDevices.filter(d => d.deviceType === 'SENSOR').length;
    const online = scopedDevices.filter(d => d.deviceType === 'SENSOR' && onlineSensorIds.has(d.id)).length;

    const fleetHealth: FleetHealthStats = {
      online,
      offline: sensorCount - online,
      total: scopedDevices.length,
      batteryDist,
      networkDist,
    };

    const weeklyTrends: WeeklyTrendEntry[] = trendData.map(t => ({
      day: t.label, avgPpm: t.avgPpm, alertCount: t.breachCount,
    }));
    const siteRankings: SiteRanking[] = ruComparison.map(r => ({
      ru: r.ruId, uptime: 97, incidents: r.breachCount, avgResponseTime: 3,
    }));

    return {
      weeklyTrends, incidentsHeatmap: [], siteRankings,
      trendData, ruComparison, heatmap, topSensors, fleetHealth,
    };
  }

  // --- HQ USER MANAGEMENT (separate from RU-local users, not synced) ---

  async users(): Promise<User[]> {
    const userList = await this.prisma.gatewayUser.findMany({ orderBy: { createdAt: 'desc' } });
    return userList.map(u => ({ ...u, name: u.name || undefined, ruId: 'ALL' }));
  }

  // DEV MODE: password check disabled, matches apps/backend behavior
  async login(email: string): Promise<LoginResult> {
    const user = await this.prisma.gatewayUser.findUnique({ where: { email } });
    if (!user) return { error: 'No account found for that email' };
    return { user: { ...user, name: user.name || undefined, ruId: 'ALL' } };
  }

  // --- EVENT LOG ---

  private serializeEvent(l: any): EventLog {
    return {
      id: l.id,
      type: l.type,
      severity: l.severity,
      message: l.message,
      acknowledged: l.acknowledged,
      timestamp: l.timestamp instanceof Date ? l.timestamp.toISOString() : String(l.timestamp),
      acknowledgedAt: l.acknowledgedAt instanceof Date ? l.acknowledgedAt.toISOString() : (l.acknowledgedAt ?? undefined),
      deviceId: l.deviceId ?? undefined,
      ruId: l.ruId ?? undefined,
      operatorId: l.operatorId ?? undefined,
      operatorEmail: l.operatorEmail ?? undefined,
      details: l.details ?? undefined,
      acknowledgedBy: l.acknowledgedBy ?? undefined,
      ackNote: l.ackNote ?? undefined,
    };
  }

  async getEventLogs(filter?: { ruId?: string; limit?: number }): Promise<EventLog[]> {
    const where: any = {};
    if (filter?.ruId && filter.ruId !== 'ALL') where.ruId = filter.ruId;
    const logs = await this.prisma.eventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filter?.limit ?? 300,
    });
    return logs.map(l => this.serializeEvent(l));
  }

  // --- SENSOR TIMELINE ---

  async getSensorTimeline(ruId: string): Promise<SensorTimeline[]> {
    const where: any = { deviceType: 'SENSOR' };
    if (ruId && ruId !== 'ALL') where.ruId = ruId;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sensors = await this.prisma.device.findMany({
      where,
      include: {
        readings: { where: { timestamp: { gte: twentyFourHoursAgo } }, orderBy: { timestamp: 'asc' } }
      },
      take: 100,
    });
    return sensors.map(s => {
      const hourlyMap = new Map<string, number[]>();
      s.readings.forEach(r => {
        const hour = new Date(r.timestamp).getHours().toString().padStart(2, '0') + ':00';
        if (!hourlyMap.has(hour)) hourlyMap.set(hour, []);
        hourlyMap.get(hour)!.push(r.confidence);
      });
      const data = Array.from(hourlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, vals]) => ({ hour, confidence: vals.reduce((s, p) => s + p, 0) / vals.length }));
      return { deviceId: s.id, deviceName: s.name, ruId: s.ruId, data };
    });
  }

  // --- SETTINGS ---

  async getSettings(): Promise<SystemSettings> {
    let settings = await this.prisma.systemSettings.findFirst();
    if (!settings) { settings = await this.prisma.systemSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }); }
    return settings;
  }

  // --- DASHBOARD STATS ---

  async getDashboardStats(): Promise<DashboardStats> {
    const [settings, allDevices, allReadings] = await Promise.all([
      this.getSettings(),
      this.prisma.device.findMany(),
      this.prisma.gasReading.findMany({ orderBy: { timestamp: 'desc' }, take: 500 })
    ]);

    const ruIds = Array.from<string>(new Set(allDevices.map(d => d.ruId))).sort();
    const ruData: RuStats[] = ruIds.map(ru => {
      const devices = allDevices.filter(d => d.ruId === ru);
      const devIds = new Set(devices.map(d => d.id));
      const alertsCount = allReadings.filter(r => devIds.has(r.deviceId) && r.riskLevel !== 'LOW').length;

      return {
        ru: ru,
        total: devices.length,
        online: devices.filter(d => d.status === 'ONLINE').length,
        alerts: alertsCount,
        health: devices.length > 0 ? Math.round(devices.reduce((s, d) => s + d.healthScore, 0) / devices.length) : 0,
        clusterHead: devices.filter(d => d.deviceType === 'CLUSTER').length,
        gateway: devices.filter(d => d.deviceType === 'GATEWAY').length,
        nodeSensor: devices.filter(d => d.deviceType === 'SENSOR').length
      };
    });

    const recentAlerts: Alert[] = allReadings
      .filter(r => r.riskLevel !== 'LOW')
      .slice(0, 15)
      .map((r, i) => {
        const device = allDevices.find(d => d.id === r.deviceId);
        const isHigh = r.riskLevel === 'HIGH';
        const statusMap = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];
        const status = statusMap[i % 3];
        const timestamp = new Date(r.timestamp);
        return {
          id: r.id,
          severity: isHigh ? 'CRITICAL' : 'WARNING',
          message: `Gas detected — ${r.riskLevel} risk (class ${r.aiClass}, confidence ${r.confidence.toFixed(2)})`,
          ru: device?.ruId || 'N/A',
          time: timestamp.toISOString().replace('T', ' ').substring(0, 19),
          device: device?.macAddress || 'Unknown',
          status,
          type: 'Gas',
          scenario: isHigh ? 'Confirmed Gas Leak' : 'Gas Sensor Alert',
          resolvedAt: status === 'RESOLVED' ? new Date(timestamp.getTime() + 20 * 60000).toISOString() : undefined,
          notes: status === 'RESOLVED' ? 'Issue resolved.' : undefined
        };
      });

    const batteryDist: BatteryDistEntry[] = [
      { range: '0-20%', fill: '#ef4444', count: 0 },
      { range: '21-40%', fill: '#f97316', count: 0 },
      { range: '41-60%', fill: '#eab308', count: 0 },
      { range: '61-80%', fill: '#3b82f6', count: 0 },
      { range: '81-100%', fill: '#22d3ee', count: 0 }
    ];

    allDevices.forEach(d => {
      try {
        const bat = JSON.parse(d.batteryStats || '{}');
        const soc = Math.round(bat.soc || 0);
        if (soc <= 20) batteryDist[0].count++;
        else if (soc <= 40) batteryDist[1].count++;
        else if (soc <= 60) batteryDist[2].count++;
        else if (soc <= 80) batteryDist[3].count++;
        else batteryDist[4].count++;
      } catch (e) { batteryDist[4].count++; }
    });

    const networkQuality: NetworkQualityEntry[] = [
      { grade: 'A', fill: '#22d3ee', count: 0 },
      { grade: 'B', fill: '#3b82f6', count: 0 },
      { grade: 'C', fill: '#6366f1', count: 0 },
      { grade: 'D', fill: '#f97316', count: 0 },
      { grade: 'F', fill: '#ef4444', count: 0 }
    ];

    allDevices.forEach(d => {
      try {
        const net = JSON.parse(d.networkStats || '{}');
        const q = net.qualityScore || 'B';
        const entry = networkQuality.find(n => n.grade === q);
        if (entry) entry.count++;
      } catch (e) { networkQuality[1].count++; }
    });

    const timelineData: TimelineEntry[] = Array.from({ length: 24 }, (_, i) => {
      const hourStr = i.toString().padStart(2, '0') + ':00';
      const readingsInHour = allReadings.filter(r => new Date(r.timestamp).getHours() === i);
      return {
        time: hourStr,
        confidence: readingsInHour.length > 0 ? Math.round(readingsInHour.reduce((s, r) => s + r.confidence, 0) / readingsInHour.length * 1000) / 1000 : 0,
        alerts: readingsInHour.filter(r => r.riskLevel !== 'LOW').length
      };
    });

    return {
      ruData,
      timelineData,
      recentAlerts,
      batteryDist,
      networkQuality,
      totalDevices: allDevices.length,
      onlineDevices: allDevices.filter(d => d.status === 'ONLINE').length,
      totalAlerts: recentAlerts.length,
      avgHealth: allDevices.length > 0 ? Math.round(allDevices.reduce((s, d) => s + d.healthScore, 0) / allDevices.length) : 0
    };
  }

  // --- DEVICE READS ---

  async getRuSites(): Promise<{ id: string }[]> {
    const devices = await this.prisma.device.findMany({ select: { ruId: true }, distinct: ['ruId'] });
    const ruIds = devices.map(d => d.ruId);
    return [...new Set([...this.RU_SITES, ...ruIds])].map(id => ({ id }));
  }

  async findAll(ruId: string): Promise<Device[]> {
    const where = ruId === 'ALL' ? {} : { ruId };
    const devices = await this.prisma.device.findMany({
      where,
      include: { readings: { orderBy: { timestamp: 'desc' }, take: 1 } }
    });
    return devices.map(d => this.mapToDevice(d));
  }

  private mapToDevice(d: any): Device {
    try {
      const netStats = JSON.parse(d.networkStats || '{}');
      const batStats = JSON.parse(d.batteryStats || '{}');
      return {
        id: d.id,
        macAddress: d.macAddress,
        name: d.name || d.macAddress,
        ruId: d.ruId,
        type: d.deviceType,
        parentMac: netStats.parentMac || null,
        location: JSON.parse(d.location || '{"lat":0,"lng":0}') as DeviceLocation,
        battery: {
          ...batStats,
          soc: Math.round(batStats.soc || 0),
          voltage: batStats.voltage || 0
        } as BatteryMetrics,
        network: {
          ...netStats,
          rssi: Math.round(netStats.rssi || netStats.rssiMesh || -70),
          rssiMesh: netStats.rssiMesh ? Math.round(netStats.rssiMesh) : undefined,
          rssiStar: netStats.rssiStar ? Math.round(netStats.rssiStar) : undefined,
          parentMac: netStats.parentMac
        } as NetworkMetrics,
        healthScore: d.healthScore,
        latestConfidence: d.readings?.[0]?.confidence ?? 0,
        status: d.status
      };
    } catch (e) {
      console.error('[mapToDevice] Error mapping device:', d.id, e);
      return {
        id: d.id, macAddress: d.macAddress, name: d.macAddress, ruId: d.ruId, type: d.deviceType, location: { lat: 0, lng: 0 },
        battery: { voltage: 0, soc: 0 }, network: { rssi: -100 }, healthScore: 0, status: 'ERROR'
      };
    }
  }
}
