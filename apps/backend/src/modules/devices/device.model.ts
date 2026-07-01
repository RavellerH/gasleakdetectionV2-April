import { Field, ID, InputType, Int, ObjectType, Float } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString } from 'class-validator';

@InputType()
export class CoordinatesInput {
  @Field(() => Float)
  @IsNumber()
  lat!: number;

  @Field(() => Float)
  @IsNumber()
  lng!: number;
}

@ObjectType()
export class BatteryMetrics {
  @Field(() => Float)
  voltage!: number;

  @Field(() => Int)
  soc!: number;

  @Field(() => Int, { nullable: true })
  cycles?: number | null;

  @Field(() => Int, { nullable: true })
  estimatedHours?: number | null;
}

@ObjectType()
export class NetworkMetrics {
  @Field(() => Int)
  rssi!: number;

  @Field(() => Int, { nullable: true })
  rssiMesh?: number;

  @Field(() => Int, { nullable: true })
  rssiStar?: number;

  @Field(() => Int, { nullable: true })
  peersCount?: number | null;

  @Field(() => Int, { nullable: true })
  hopsToGateway?: number | null;

  @Field(() => String, { nullable: true })
  qualityScore?: string | null;

  @Field(() => String, { nullable: true })
  parentMac?: string | null;
}

@ObjectType()
export class DeviceLocation {
  @Field(() => Float)
  lat!: number;

  @Field(() => Float)
  lng!: number;
}

@InputType()
export class CreateDeviceInput {
  @Field()
  @IsString()
  macAddress!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field()
  @IsString()
  deviceType!: string;

  @Field()
  @IsString()
  ruId!: string;

  @Field(() => CoordinatesInput)
  location!: CoordinatesInput;

  @Field()
  @IsString()
  registeredBy!: string;
}

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field({ nullable: true })
  name?: string;

  @Field()
  ruId!: string;

  @Field()
  role!: string;

  @Field(() => String)
  createdAt!: Date;
}

@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  email!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field()
  @IsString()
  password!: string;

  @Field()
  @IsString()
  ruId!: string;

  @Field()
  @IsString()
  role!: string;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  email?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  password?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  ruId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  role?: string;
}

@InputType()
export class UpdateDeviceInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  deviceType?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  ruId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  status?: string;
}

@ObjectType()
export class LoginResult {
  @Field(() => User, { nullable: true })
  user?: User;

  @Field({ nullable: true })
  error?: string;
}

@ObjectType()
export class SystemSettings {
  @Field(() => Int)
  id!: number;

  @Field(() => Float)
  warningThreshold!: number;

  @Field(() => Float)
  criticalThreshold!: number;

  @Field(() => Int)
  refreshInterval!: number;
}

@InputType()
export class UpdateSettingsInput {
  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  warningThreshold?: number;

  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  criticalThreshold?: number;

  @Field(() => Int, { nullable: true })
  @IsNumber()
  @IsOptional()
  refreshInterval?: number;
}

@ObjectType()
export class WeeklyTrendEntry {
  @Field()
  day!: string;
  @Field(() => Float)
  avgPpm!: number;
  @Field(() => Int)
  alertCount!: number;
}

@ObjectType()
export class HeatmapEntry {
  @Field()
  day!: string;
  @Field(() => Int)
  hour!: number;
  @Field(() => Int)
  value!: number;
}

@ObjectType()
export class SiteRanking {
  @Field()
  ru!: string;
  @Field(() => Float)
  uptime!: number;
  @Field(() => Int)
  incidents!: number;
  @Field(() => Float)
  avgResponseTime!: number;
}

@ObjectType()
export class TrendPoint {
  @Field() label!: string;
  @Field(() => Float) avgPpm!: number;
  @Field(() => Int) breachCount!: number;
}

@ObjectType()
export class RuComparisonEntry {
  @Field() ruId!: string;
  @Field(() => Float) avgPpm!: number;
  @Field(() => Float) maxPpm!: number;
  @Field(() => Int) breachCount!: number;
  @Field(() => Int) totalDevices!: number;
  @Field(() => Int) onlineDevices!: number;
  @Field(() => Int) avgHealth!: number;
}

@ObjectType()
export class HeatmapCell {
  @Field(() => Int) hour!: number;
  @Field() ruId!: string;
  @Field(() => Float) avgPpm!: number;
}

@ObjectType()
export class TopSensorEntry {
  @Field() deviceId!: string;
  @Field() deviceName!: string;
  @Field() ruId!: string;
  @Field(() => Float) avgPpm!: number;
  @Field(() => Float) maxPpm!: number;
  @Field(() => Int) breachCount!: number;
}

@ObjectType()
export class FleetBatteryBucket {
  @Field() range!: string;
  @Field(() => Int) count!: number;
}

@ObjectType()
export class FleetNetworkBucket {
  @Field() grade!: string;
  @Field(() => Int) count!: number;
}

@ObjectType()
export class FleetHealthStats {
  @Field(() => Int) online!: number;
  @Field(() => Int) offline!: number;
  @Field(() => Int) total!: number;
  @Field(() => [FleetBatteryBucket]) batteryDist!: FleetBatteryBucket[];
  @Field(() => [FleetNetworkBucket]) networkDist!: FleetNetworkBucket[];
}

@ObjectType()
export class AnalyticsStats {
  @Field(() => [WeeklyTrendEntry]) weeklyTrends!: WeeklyTrendEntry[];
  @Field(() => [HeatmapEntry]) incidentsHeatmap!: HeatmapEntry[];
  @Field(() => [SiteRanking]) siteRankings!: SiteRanking[];

  @Field(() => [TrendPoint]) trendData!: TrendPoint[];
  @Field(() => [RuComparisonEntry]) ruComparison!: RuComparisonEntry[];
  @Field(() => [HeatmapCell]) heatmap!: HeatmapCell[];
  @Field(() => [TopSensorEntry]) topSensors!: TopSensorEntry[];
  @Field(() => FleetHealthStats) fleetHealth!: FleetHealthStats;
}

@ObjectType()
export class RuStats {
  @Field()
  ru!: string;

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  online!: number;

  @Field(() => Int)
  alerts!: number;

  @Field(() => Int)
  health!: number;

  @Field(() => Int)
  clusterHead!: number;

  @Field(() => Int)
  gateway!: number;

  @Field(() => Int)
  nodeSensor!: number;
}

@ObjectType()
export class Alert {
  @Field(() => ID)
  id!: string;
  @Field()
  severity!: string;
  @Field()
  message!: string;
  @Field()
  ru!: string;
  @Field()
  time!: string;
  @Field()
  device!: string;
  @Field()
  status!: string;
  @Field()
  type!: string;
  @Field()
  scenario!: string;
  @Field({ nullable: true })
  resolvedAt?: string;
  @Field({ nullable: true })
  notes?: string;
}

@ObjectType()
export class BatteryDistEntry {
  @Field()
  range!: string;
  @Field(() => Int)
  count!: number;
  @Field()
  fill!: string;
}

@ObjectType()
export class NetworkQualityEntry {
  @Field()
  grade!: string;
  @Field(() => Int)
  count!: number;
  @Field()
  fill!: string;
}

@ObjectType()
export class DashboardStats {
  @Field(() => [RuStats])
  ruData!: RuStats[];

  @Field(() => [TimelineEntry])
  timelineData!: TimelineEntry[];

  @Field(() => [Alert])
  recentAlerts!: Alert[];

  @Field(() => [BatteryDistEntry])
  batteryDist!: BatteryDistEntry[];

  @Field(() => [NetworkQualityEntry])
  networkQuality!: NetworkQualityEntry[];

  @Field(() => Int)
  totalDevices!: number;

  @Field(() => Int)
  onlineDevices!: number;

  @Field(() => Int)
  totalAlerts!: number;

  @Field(() => Int)
  avgHealth!: number;
}

@ObjectType()
export class TimelineEntry {
  @Field()
  time!: string;

  @Field(() => Float)
  confidence!: number;

  @Field(() => Int)
  alerts!: number;
}

@ObjectType()
export class RuSite {
  @Field()
  id!: string;
}

@ObjectType()
export class EventLog {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field()
  severity!: string;

  @Field({ nullable: true })
  deviceId?: string;

  @Field({ nullable: true })
  ruId?: string;

  @Field({ nullable: true })
  operatorId?: string;

  @Field({ nullable: true })
  operatorEmail?: string;

  @Field()
  message!: string;

  @Field({ nullable: true })
  details?: string;

  @Field(() => Boolean)
  acknowledged!: boolean;

  @Field({ nullable: true })
  acknowledgedBy?: string;

  @Field({ nullable: true })
  acknowledgedAt?: string;

  @Field({ nullable: true })
  ackNote?: string;

  @Field(() => String)
  timestamp!: Date;
}

@InputType()
export class CreateEventLogInput {
  @Field()
  @IsString()
  type!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  severity?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  ruId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  operatorId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  operatorEmail?: string;

  @Field()
  @IsString()
  message!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  details?: string;
}

@ObjectType()
export class SensorDataPoint {
  @Field()
  hour!: string;

  @Field(() => Float)
  confidence!: number;
}

@ObjectType()
export class SensorTimeline {
  @Field()
  deviceId!: string;

  @Field()
  deviceName!: string;

  @Field()
  ruId!: string;

  @Field(() => [SensorDataPoint])
  data!: SensorDataPoint[];
}

@ObjectType()
export class GasReading {
  @Field(() => ID)
  id!: string;

  @Field()
  deviceId!: string;

  @Field(() => Float)
  confidence!: number;

  @Field(() => Int)
  aiClass!: number;

  @Field()
  riskLevel!: string;

  @Field(() => Date)
  timestamp!: Date;
}

@ObjectType()
export class Device {
  @Field(() => ID)
  id!: string;

  @Field()
  macAddress!: string;

  @Field()
  name!: string;

  @Field()
  ruId!: string;

  @Field({ nullable: true })
  parentMac?: string;

  @Field(() => String)
  type!: string;

  @Field(() => DeviceLocation)
  location!: DeviceLocation;

  @Field(() => BatteryMetrics)
  battery!: BatteryMetrics;

  @Field(() => NetworkMetrics)
  network!: NetworkMetrics;

  @Field(() => Int)
  healthScore!: number;

  @Field(() => Float, { nullable: true })
  latestConfidence?: number;

  @Field()
  status!: string;
}

