import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString } from 'class-validator';

@InputType()
export class CoordinatesInput {
  @Field(() => Number)
  @IsNumber()
  lat!: number;

  @Field(() => Number)
  @IsNumber()
  lng!: number;
}

@ObjectType()
export class BatteryMetrics {
  @Field(() => Number)
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
  @Field(() => Number)
  lat!: number;

  @Field(() => Number)
  lng!: number;
}

@InputType()
export class CreateDeviceInput {
  @Field()
  @IsString()
  macAddress!: string;

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

  @Field(() => Number)
  warningThreshold!: number;

  @Field(() => Number)
  criticalThreshold!: number;

  @Field(() => Int)
  refreshInterval!: number;
}

@InputType()
export class UpdateSettingsInput {
  @Field(() => Number, { nullable: true })
  @IsNumber()
  @IsOptional()
  warningThreshold?: number;

  @Field(() => Number, { nullable: true })
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
  @Field(() => Number)
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
  @Field(() => Number)
  uptime!: number;
  @Field(() => Int)
  incidents!: number;
  @Field(() => Number)
  avgResponseTime!: number;
}

@ObjectType()
export class AnalyticsStats {
  @Field(() => [WeeklyTrendEntry])
  weeklyTrends!: WeeklyTrendEntry[];

  @Field(() => [HeatmapEntry])
  incidentsHeatmap!: HeatmapEntry[];

  @Field(() => [SiteRanking])
  siteRankings!: SiteRanking[];
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

  @Field(() => Number)
  ppm!: number;

  @Field(() => Int)
  alerts!: number;
}

@ObjectType()
export class GasReading {
  @Field(() => ID)
  id!: string;

  @Field()
  deviceId!: string;

  @Field(() => Number)
  ppm!: number;

  @Field(() => Date)
  timestamp!: Date;
}

@ObjectType()
export class Device {
  @Field(() => ID)
  id!: string;

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

  @Field(() => Number, { nullable: true })
  latestPpm?: number;

  @Field()
  status!: string;
}

