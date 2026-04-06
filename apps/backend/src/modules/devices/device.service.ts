import { Injectable } from '@nestjs/common';
import { Device, DeviceLocation, BatteryMetrics, NetworkMetrics, CreateDeviceInput, GasReading, DashboardStats, RuStats, TimelineEntry, Alert, BatteryDistEntry, NetworkQualityEntry, SystemSettings, UpdateSettingsInput, User, CreateUserInput, LoginResult, AnalyticsStats, WeeklyTrendEntry, HeatmapEntry, SiteRanking } from './device.model';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  // --- ANALYTICS ---

  async getAnalytics(): Promise<AnalyticsStats> {
    const settings = await this.getSettings();
    const allDevices = await this.prisma.device.findMany();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const readings = await this.prisma.gasReading.findMany({
      where: { timestamp: { gte: sevenDaysAgo } }
    });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const weeklyTrends: WeeklyTrendEntry[] = days.map((day, idx) => {
      const dayReadings = readings.filter(r => new Date(r.timestamp).getDay() === idx);
      return {
        day,
        avgPpm: dayReadings.length > 0 ? dayReadings.reduce((s, r) => s + r.ppm, 0) / dayReadings.length : 0,
        alertCount: dayReadings.filter(r => r.ppm >= settings.warningThreshold).length
      };
    });

    const incidentsHeatmap: HeatmapEntry[] = [];
    days.forEach(day => {
      for (let h = 0; h < 24; h += 2) {
        incidentsHeatmap.push({ day, hour: h, value: Math.floor(Math.random() * 5) });
      }
    });

    const ruIds = ['RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];
    const siteRankings: SiteRanking[] = ruIds.map(ru => {
      const ruDevices = allDevices.filter(d => d.ruId === ru);
      const ruReadings = readings.filter(r => ruDevices.some(d => d.id === r.deviceId));
      return {
        ru,
        uptime: 95 + Math.random() * 4.5,
        incidents: ruReadings.filter(r => r.ppm >= settings.warningThreshold).length,
        avgResponseTime: 2 + Math.random() * 8
      };
    });

    return { weeklyTrends, incidentsHeatmap, siteRankings };
  }

  // --- USER MANAGEMENT ---

  async users(): Promise<User[]> {
    const userList = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return userList.map(u => ({ ...u, name: u.name || undefined }));
  }

  async createUser(input: CreateUserInput, creatorId: string): Promise<User> {
    const u = await this.prisma.user.create({
      data: { email: input.email, name: input.name, password: input.password, ruId: input.ruId, role: input.role }
    });
    return { ...u, name: u.name || undefined };
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.prisma.user.delete({ where: { id } });
    return true;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { error: 'User not found' };
    if (user.password !== password) return { error: 'Invalid password' };
    return { user: { ...user, name: user.name || undefined } };
  }

  // --- SETTINGS ---

  async getSettings(): Promise<SystemSettings> {
    let settings = await this.prisma.systemSettings.findFirst();
    if (!settings) { settings = await this.prisma.systemSettings.create({ data: {} }); }
    return settings;
  }

  async updateSettings(input: UpdateSettingsInput): Promise<SystemSettings> {
    const current = await this.getSettings();
    return this.prisma.systemSettings.update({
      where: { id: current.id },
      data: {
        warningThreshold: input.warningThreshold ?? undefined,
        criticalThreshold: input.criticalThreshold ?? undefined,
        refreshInterval: input.refreshInterval ?? undefined,
      }
    });
  }

  // --- DASHBOARD STATS ---

  async getDashboardStats(): Promise<DashboardStats> {
    const [settings, allDevices, allReadings] = await Promise.all([
      this.getSettings(),
      this.prisma.device.findMany(),
      this.prisma.gasReading.findMany({ orderBy: { timestamp: 'desc' }, take: 500 })
    ]);

    const ruIds = ['RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];
    const ruData: RuStats[] = ruIds.map(ru => {
      const devices = allDevices.filter(d => d.ruId === ru);
      const devIds = new Set(devices.map(d => d.id));
      const alertsCount = allReadings.filter(r => devIds.has(r.deviceId) && r.ppm >= settings.warningThreshold).length;
      
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
      .filter(r => r.ppm >= settings.warningThreshold)
      .slice(0, 15)
      .map((r, i) => {
        const device = allDevices.find(d => d.id === r.deviceId);
        const isCritical = r.ppm >= settings.criticalThreshold;
        const statusMap = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];
        const status = statusMap[i % 3];
        const timestamp = new Date(r.timestamp);
        return {
          id: r.id,
          severity: isCritical ? 'CRITICAL' : 'WARNING',
          message: `Gas concentration ${r.ppm.toFixed(1)} ppm exceeds threshold`,
          ru: device?.ruId || 'N/A',
          time: timestamp.toISOString().replace('T', ' ').substring(0, 19),
          device: device?.macAddress || 'Unknown',
          status,
          type: 'Gas',
          scenario: isCritical ? 'Confirmed Gas Leak' : 'Gas Sensor Alert',
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
        ppm: readingsInHour.length > 0 ? Math.round(readingsInHour.reduce((s, r) => s + r.ppm, 0) / readingsInHour.length) : 0,
        alerts: readingsInHour.filter(r => r.ppm >= settings.warningThreshold).length
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

  // --- DEVICE OPERATIONS ---

  async addReading(macAddress: string, ppm: number): Promise<GasReading> {
    const device = await this.prisma.device.findUnique({ where: { macAddress } });
    if (!device) throw new Error(`Device with MAC ${macAddress} not found`);
    const r = await this.prisma.gasReading.create({ data: { deviceId: device.id, ppm, isDummy: device.isDummy } });
    return { id: r.id, deviceId: r.deviceId, ppm: r.ppm, timestamp: r.timestamp };
  }

  async create(input: CreateDeviceInput): Promise<Device> {
    const d = await this.prisma.device.create({
      data: {
        macAddress: input.macAddress,
        deviceType: input.deviceType,
        ruId: input.ruId,
        location: JSON.stringify(input.location),
        registeredBy: input.registeredBy,
        batteryStats: JSON.stringify({ voltage: 4.0, soc: 100 }), 
        networkStats: JSON.stringify({ rssi: -50, qualityScore: 'A' }),
        healthScore: 100,
        status: 'ONLINE',
        isDummy: true
      }
    });
    return this.mapToDevice(d);
  }

  async findAll(ruId: string): Promise<Device[]> {
    const devices = await this.prisma.device.findMany({
      where: { ruId },
      include: { readings: { orderBy: { timestamp: 'desc' }, take: 1 } }
    });
    return devices.map(d => this.mapToDevice(d));
  }

  async updateLocation(deviceId: string, location: { lat: number; lng: number }): Promise<Device | null> {
    const d = await this.prisma.device.update({ where: { id: deviceId }, data: { location: JSON.stringify(location) } });
    return this.mapToDevice(d);
  }

  private mapToDevice(d: any): Device {
    try {
      const netStats = JSON.parse(d.networkStats || '{}');
      const batStats = JSON.parse(d.batteryStats || '{}');
      return {
        id: d.id,
        name: d.macAddress,
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
        latestPpm: d.readings?.[0]?.ppm || 0,
        status: d.status
      };
    } catch (e) {
      console.error('[mapToDevice] Error mapping device:', d.id, e);
      return {
        id: d.id, name: d.macAddress, ruId: d.ruId, type: d.deviceType, location: { lat: 0, lng: 0 },
        battery: { voltage: 0, soc: 0 }, network: { rssi: -100 }, healthScore: 0, status: 'ERROR'
      };
    }
  }
}
