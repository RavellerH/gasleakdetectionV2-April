import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Device, DeviceLocation, BatteryMetrics, NetworkMetrics, CreateDeviceInput, UpdateDeviceInput, GasReading, DashboardStats, RuStats, TimelineEntry, Alert, BatteryDistEntry, NetworkQualityEntry, SystemSettings, UpdateSettingsInput, User, CreateUserInput, UpdateUserInput, LoginResult, AnalyticsStats, WeeklyTrendEntry, HeatmapEntry, SiteRanking, EventLog, CreateEventLogInput, SensorTimeline, TrendPoint, RuComparisonEntry, HeatmapCell, TopSensorEntry, FleetBatteryBucket, FleetNetworkBucket, FleetHealthStats, GatewayPullResult } from './device.model';
import { gasClassName, riskLevelFor } from './gas-class';
import { PrismaService } from '../prisma/prisma.service';
import { signToken } from '../auth/auth';

const BCRYPT_ROUNDS = 12;
const isBcryptHash = (password: string): boolean => /^\$2[aby]\$/.test(password);

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(key);
    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(key, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW_MS });
      return true;
    }
    if (record.count >= this.MAX_LOGIN_ATTEMPTS) {
      return false;
    }
    record.count++;
    return true;
  }

  // --- ANALYTICS ---

  async getAnalytics(ruId?: string, hours: number = 24): Promise<AnalyticsStats> {
    const settings = await this.getSettings();
    const { warningThreshold: warning } = settings;

    const now = Date.now();
    const cutoff = new Date(now - hours * 3600000);
    const cutoff7d = new Date(now - 7 * 24 * 3600000);

    // Fetch all devices and all 7-day readings in one query each
    const allDevices = await this.prisma.device.findMany();
    const allReadings7d = await this.prisma.gasReading.findMany({
      where: { timestamp: { gte: cutoff7d } },
      orderBy: { timestamp: 'asc' },
    });

    // Scoped to the selected RU (for trend, topSensors, fleetHealth)
    const scopedDevices = ruId && ruId !== 'ALL'
      ? allDevices.filter(d => d.ruId === ruId)
      : allDevices;
    const scopedIds = new Set(scopedDevices.map(d => d.id));
    const scopedReadings7d = allReadings7d.filter(r => scopedIds.has(r.deviceId));
    const scopedReadings = scopedReadings7d.filter(r => new Date(r.timestamp).getTime() >= cutoff.getTime());

    // ── Trend data (scoped, hourly or daily) ─────────────────────────────
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
          avgConfidence: bucket.length > 0 ? Math.round(bucket.reduce((s, r) => s + r.confidence, 0) / bucket.length * 1000) / 1000 : 0,
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
          avgConfidence: bucket.length > 0 ? Math.round(bucket.reduce((s, r) => s + r.confidence, 0) / bucket.length * 1000) / 1000 : 0,
          breachCount: bucket.filter(r => r.riskLevel !== 'LOW').length,
        });
      }
    }

    // ── RU Comparison (always all RUs, 7d window) ─────────────────────────
    const ruIds = Array.from<string>(new Set(allDevices.map(d => d.ruId))).sort();
    const twoHoursAgo = new Date(now - 2 * 3600000);

    const ruComparison: RuComparisonEntry[] = ruIds.map(ru => {
      const ruDevs = allDevices.filter(d => d.ruId === ru);
      const ruIds7d = new Set(ruDevs.map(d => d.id));
      const ruR = allReadings7d.filter(r => ruIds7d.has(r.deviceId));
      const ruRScoped = ruR.filter(r => new Date(r.timestamp).getTime() >= cutoff.getTime());
      const avgConfidence = ruRScoped.length > 0 ? ruRScoped.reduce((s, r) => s + r.confidence, 0) / ruRScoped.length : 0;
      const maxConfidence = ruRScoped.length > 0 ? Math.max(...ruRScoped.map(r => r.confidence)) : 0;

      const socValues = ruDevs.map(d => {
        try { return (JSON.parse(d.batteryStats as string) as any).soc ?? 0; } catch { return 0; }
      });
      const avgHealth = socValues.length > 0 ? Math.round(socValues.reduce((s, v) => s + v, 0) / socValues.length) : 0;

      const recentDeviceIds = new Set(allReadings7d
        .filter(r => ruIds7d.has(r.deviceId) && new Date(r.timestamp).getTime() >= twoHoursAgo.getTime())
        .map(r => r.deviceId));

      return {
        ruId: ru,
        avgConfidence: Math.round(avgConfidence * 1000) / 1000,
        maxConfidence: Math.round(maxConfidence * 1000) / 1000,
        breachCount: ruRScoped.filter(r => r.riskLevel !== 'LOW').length,
        totalDevices: ruDevs.length,
        onlineDevices: recentDeviceIds.size,
        avgHealth,
      };
    });

    // ── Heatmap: hour-of-day × RU, avg PPM over 7 days ───────────────────
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
          detectionCount: hourReadings.filter(r => r.riskLevel !== 'LOW').length,
        });
      }
    }

    // ── Top risky sensors (scoped, selected time window) ──────────────────
    const sensorDevices = scopedDevices.filter(d => d.deviceType === 'SENSOR');
    const topSensors: TopSensorEntry[] = sensorDevices.map(sensor => {
      const sr = scopedReadings.filter(r => r.deviceId === sensor.id);
      const avgConfidence = sr.length > 0 ? sr.reduce((s, r) => s + r.confidence, 0) / sr.length : 0;
      const maxConfidence = sr.length > 0 ? Math.max(...sr.map(r => r.confidence)) : 0;
      return {
        deviceId: sensor.id,
        deviceName: sensor.name,
        ruId: sensor.ruId,
        avgConfidence: Math.round(avgConfidence * 1000) / 1000,
        maxConfidence: Math.round(maxConfidence * 1000) / 1000,
        breachCount: sr.filter(r => r.riskLevel !== 'LOW').length,
      };
    }).sort((a, b) => b.avgConfidence - a.avgConfidence).slice(0, 15);

    // ── Fleet health (scoped) ─────────────────────────────────────────────
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

    // ── Backwards-compat fields ───────────────────────────────────────────
    const weeklyTrends: WeeklyTrendEntry[] = trendData.map(t => ({
      day: t.label, avgConfidence: t.avgConfidence, alertCount: t.breachCount,
    }));
    const siteRankings: SiteRanking[] = ruComparison.map(r => ({
      ru: r.ruId, uptime: 97, incidents: r.breachCount, avgResponseTime: 3,
    }));

    return {
      weeklyTrends, incidentsHeatmap: [], siteRankings,
      trendData, ruComparison, heatmap, topSensors, fleetHealth,
    };
  }

  // --- USER MANAGEMENT ---

  async users(): Promise<User[]> {
    const userList = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return userList.map(u => this.toSafeUser(u));
  }

  async createUser(input: CreateUserInput, _creatorId: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const u = await this.prisma.user.create({
      data: { email: input.email.trim().toLowerCase(), name: input.name, password: hashedPassword, ruId: input.ruId, role: input.role }
    });
    return this.toSafeUser(u);
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.prisma.user.delete({ where: { id } });
    return true;
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const data: Record<string, unknown> = {};
    if (input.email !== undefined) data.email = input.email.trim().toLowerCase();
    if (input.name !== undefined) data.name = input.name;
    if (input.password !== undefined) data.password = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    if (input.ruId !== undefined) data.ruId = input.ruId;
    if (input.role !== undefined) data.role = input.role;
    const u = await this.prisma.user.update({ where: { id }, data });
    return this.toSafeUser(u);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!this.checkRateLimit(normalizedEmail)) {
      return { error: 'Too many login attempts. Try again in 15 minutes.' };
    }

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return { error: 'Invalid email or password' };

    let valid = false;
    if (isBcryptHash(user.password)) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      valid = password === user.password;
      if (valid) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { password: await bcrypt.hash(password, BCRYPT_ROUNDS) },
        });
      }
    }
    if (!valid) return { error: 'Invalid email or password' };

    this.rateLimitMap.delete(normalizedEmail);
    await this.prisma.eventLog.create({
      data: { type: 'LOGIN', severity: 'INFO', operatorId: user.id, operatorEmail: user.email, message: `Operator ${user.email} signed in` }
    });
    return {
      user: this.toSafeUser(user),
      token: signToken({ sub: user.id, email: user.email, role: user.role, ruId: user.ruId }),
    };
  }

  private toSafeUser(user: { id: string; email: string; name: string | null; ruId: string; role: string; createdAt: Date }): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      ruId: user.ruId,
      role: user.role,
      createdAt: user.createdAt,
    };
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

  async createEventLog(input: CreateEventLogInput): Promise<EventLog> {
    const log = await this.prisma.eventLog.create({
      data: {
        type: input.type,
        severity: input.severity || 'INFO',
        deviceId: input.deviceId,
        ruId: input.ruId,
        operatorId: input.operatorId,
        operatorEmail: input.operatorEmail,
        message: input.message,
        details: input.details,
      }
    });
    return this.serializeEvent(log);
  }

  async acknowledgeEvent(id: string, note: string, operatorId: string, operatorEmail: string): Promise<EventLog> {
    const log = await this.prisma.eventLog.update({
      where: { id },
      data: { acknowledged: true, ackNote: note, acknowledgedBy: operatorEmail, acknowledgedAt: new Date() }
    });
    await this.prisma.eventLog.create({
      data: {
        type: 'ACK',
        severity: 'INFO',
        ruId: log.ruId ?? undefined,
        operatorId,
        operatorEmail,
        message: `Event acknowledged by ${operatorEmail}: "${log.message.slice(0, 80)}"`,
        details: JSON.stringify({ originalEventId: id, ackNote: note }),
      }
    });
    return this.serializeEvent(log);
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
        hourlyMap.get(hour)!.push(r.aiClass === 0 ? 0 : r.confidence); // Clean Air is not a gas level
      });
      const data = Array.from(hourlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, vals]) => ({ hour, confidence: Math.max(...vals) })); // peak, so a short leak is not averaged away
      return { deviceId: s.id, deviceName: s.name, ruId: s.ruId, data };
    });
  }

  // --- SETTINGS ---

  async getSettings(): Promise<SystemSettings> {
    let settings = await this.prisma.systemSettings.findFirst();
    if (!settings) { settings = await this.prisma.systemSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }); }
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
    const [settings, allDevices, allReadings, alertEvents] = await Promise.all([
      this.getSettings(),
      this.prisma.device.findMany(),
      this.prisma.gasReading.findMany({ orderBy: { timestamp: 'desc' }, take: 500 }),
      // Alarm Console = gas events from the event log, so acknowledgement survives refreshes.
      this.prisma.eventLog.findMany({
        where: { type: { in: ['GAS_ALARM', 'THRESHOLD_BREACH'] } },
        orderBy: { timestamp: 'desc' },
        take: 15,
      }),
    ]);
    const alertStatus = (e: { acknowledged: boolean; ackNote: string | null }) =>
      !e.acknowledged ? 'ACTIVE' : e.ackNote === 'RESOLVED' ? 'RESOLVED' : 'ACKNOWLEDGED';

    const ruIds = Array.from<string>(new Set(allDevices.map(d => d.ruId))).sort();
    const ruData: RuStats[] = ruIds.map(ru => {
      const devices = allDevices.filter(d => d.ruId === ru);
      const devIds = new Set(devices.map(d => d.id));
      const alertsCount = alertEvents.filter(e => e.deviceId && devIds.has(e.deviceId) && alertStatus(e) === 'ACTIVE').length;
      
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

    const recentAlerts: Alert[] = alertEvents.map(e => {
      const device = allDevices.find(d => d.id === e.deviceId);
      const status = alertStatus(e);
      return {
        id: e.id,
        severity: e.severity,
        message: e.message,
        ru: e.ruId || device?.ruId || 'N/A',
        time: e.timestamp.toISOString(),
        device: device?.macAddress || 'Unknown',
        status,
        type: 'Gas',
        scenario: e.type === 'GAS_ALARM' ? 'GLD Alarm (push)' : 'Threshold Breach',
        resolvedAt: status === 'RESOLVED' ? e.acknowledgedAt?.toISOString() : undefined,
        notes: e.acknowledgedBy ? `${status === 'RESOLVED' ? 'Resolved' : 'Acknowledged'} by ${e.acknowledgedBy}` : undefined,
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
      totalAlerts: recentAlerts.filter(a => a.status === 'ACTIVE').length,
      avgHealth: allDevices.length > 0 ? Math.round(allDevices.reduce((s, d) => s + d.healthScore, 0) / allDevices.length) : 0
    };
  }

  // --- DEVICE OPERATIONS ---

  private readonly RU_SITES = ['RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];

  async getRuSites(): Promise<{ id: string }[]> {
    const devices = await this.prisma.device.findMany({ select: { ruId: true }, distinct: ['ruId'] });
    const ruIds = devices.map(d => d.ruId);
    return [...new Set([...this.RU_SITES, ...ruIds])].map(id => ({ id }));
  }

  // --- GATEWAY SYNC (VPS pull endpoint) ---

  async getGatewayPull(since: Date): Promise<GatewayPullResult> {
    const serverTime = new Date().toISOString();
    const [devices, readings, eventLogs] = await Promise.all([
      this.prisma.device.findMany({
        where: { OR: [{ registeredAt: { gt: since } }, { updatedAt: { gt: since } }] },
        include: { readings: { orderBy: { timestamp: 'desc' }, take: 1 } },
      }),
      this.prisma.gasReading.findMany({ where: { timestamp: { gt: since } } }),
      this.prisma.eventLog.findMany({ where: { timestamp: { gt: since } } }),
    ]);
    return {
      devices: devices.map(d => this.mapToDevice(d)),
      readings: readings.map(r => ({
        id: r.id, deviceId: r.deviceId, confidence: r.confidence, aiClass: r.aiClass, gasName: gasClassName(r.aiClass), riskLevel: r.riskLevel, timestamp: r.timestamp,
      })),
      eventLogs: eventLogs.map(l => this.serializeEvent(l)),
      serverTime,
    };
  }

  async addReading(macAddress: string, confidence: number, aiClass = 0): Promise<GasReading> {
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1 || !Number.isFinite(confidence)) {
      throw new HttpException('Invalid confidence value: must be between 0.0 and 1.0', HttpStatus.BAD_REQUEST);
    }
    const device = await this.prisma.device.findUnique({ where: { macAddress } });
    if (!device) throw new HttpException(`Device with MAC ${macAddress} not found`, HttpStatus.NOT_FOUND);
    const settings = await this.getSettings();
    const riskLevel = riskLevelFor(aiClass, confidence, settings);
    const r = await this.prisma.gasReading.create({
      data: { deviceId: device.id, confidence, aiClass, riskLevel, isDummy: device.isDummy }
    });
    if (riskLevel !== 'LOW') {
      const recent = await this.prisma.eventLog.findFirst({
        where: { deviceId: device.id, type: 'THRESHOLD_BREACH', timestamp: { gte: new Date(Date.now() - 15 * 60 * 1000) } }
      });
      if (!recent) {
        await this.prisma.eventLog.create({
          data: {
            type: 'THRESHOLD_BREACH',
            severity: riskLevel === 'HIGH' ? 'CRITICAL' : 'WARNING',
            deviceId: device.id,
            ruId: device.ruId,
            message: `${device.name} — ${riskLevel} risk detected (${gasClassName(aiClass)}, confidence ${confidence.toFixed(2)})`,
            details: JSON.stringify({ confidence, aiClass, riskLevel, macAddress, deviceName: device.name }),
          }
        });
      }
    }
    return { id: r.id, deviceId: r.deviceId, confidence: r.confidence, aiClass: r.aiClass, gasName: gasClassName(r.aiClass), riskLevel: r.riskLevel, timestamp: r.timestamp };
  }

  async create(input: CreateDeviceInput): Promise<Device> {
    const d = await this.prisma.device.create({
      data: {
        macAddress: input.macAddress,
        name: input.name || input.macAddress,
        deviceType: input.deviceType,
        ruId: input.ruId,
        area: input.area?.trim() ?? '',
        location: JSON.stringify(input.location),
        registeredBy: input.registeredBy,
        batteryStats: JSON.stringify({ voltage: 4.0, soc: 100 }), 
        networkStats: JSON.stringify({ rssi: -50, qualityScore: 'A' }),
        healthScore: 100,
        status: 'ONLINE',
        isDummy: false
      }
    });
    return this.mapToDevice(d);
  }

  async findAll(ruId: string): Promise<Device[]> {
    const where = ruId === 'ALL' ? {} : { ruId };
    const devices = await this.prisma.device.findMany({
      where,
      include: { readings: { orderBy: { timestamp: 'desc' }, take: 1 } }
    });
    return devices.map(d => this.mapToDevice(d));
  }

  async deleteDevice(id: string): Promise<boolean> {
    await this.prisma.device.delete({ where: { id } });
    return true;
  }

  async updateDevice(id: string, input: UpdateDeviceInput): Promise<Device> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.deviceType !== undefined) data.deviceType = input.deviceType;
    if (input.ruId !== undefined) data.ruId = input.ruId;
    if (input.area !== undefined) data.area = input.area.trim();
    if (input.status !== undefined) data.status = input.status;
    const d = await this.prisma.device.update({ where: { id }, data });
    return this.mapToDevice(d);
  }

  async updateLocation(deviceId: string, location: { lat: number; lng: number }): Promise<Device | null> {
    const d = await this.prisma.device.update({ where: { id: deviceId }, data: { location: JSON.stringify(location) } });
    return this.mapToDevice(d);
  }

  async updateName(deviceId: string, name: string): Promise<Device | null> {
    const d = await this.prisma.device.update({ where: { id: deviceId }, data: { name } });
    return this.mapToDevice(d);
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
        area: d.area ?? '',
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
        latestGasClass: d.readings?.[0]?.aiClass ?? null,
        latestGasName: d.readings?.[0] ? gasClassName(d.readings[0].aiClass) : null,
        status: d.status
      };
    } catch (e) {
      console.error('[mapToDevice] Error mapping device:', d.id, e);
      return {
        id: d.id, macAddress: d.macAddress, name: d.macAddress, ruId: d.ruId, area: d.area ?? '', type: d.deviceType, location: { lat: 0, lng: 0 },
        battery: { voltage: 0, soc: 0 }, network: { rssi: -100 }, healthScore: 0, status: 'ERROR'
      };
    }
  }
}
