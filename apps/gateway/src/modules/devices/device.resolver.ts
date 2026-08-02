import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Device, DashboardStats, SystemSettings, RuSite, SensorTimeline, AnalyticsStats, User, LoginResult, EventLog } from './device.model';
import { DeviceService } from './device.service';

/**
 * Read-only GraphQL API — deliberately mirrors apps/backend's query shapes
 * (devices, getDashboardStats, getAnalytics, eventLogs, sensorTimeline,
 * getSettings, users, login) so apps/frontend needs zero code changes,
 * only NEXT_PUBLIC_GRAPHQL_URL pointed at this service. No mutations are
 * exposed — RU sites are the only writers.
 */
@Resolver(() => Device)
export class DeviceResolver {
  constructor(private readonly deviceService: DeviceService) {}

  @Query(() => DashboardStats)
  async getDashboardStats(): Promise<DashboardStats> {
    return this.deviceService.getDashboardStats();
  }

  @Query(() => SystemSettings)
  async getSettings(): Promise<SystemSettings> {
    return this.deviceService.getSettings();
  }

  @Query(() => [Device])
  async devices(
    @Args('ruId', { type: () => String }) ruId: string
  ): Promise<Device[]> {
    return this.deviceService.findAll(ruId);
  }

  @Query(() => [SensorTimeline])
  async sensorTimeline(
    @Args('ruId', { type: () => String }) ruId: string,
  ): Promise<SensorTimeline[]> {
    return this.deviceService.getSensorTimeline(ruId);
  }

  @Query(() => [RuSite])
  async ruSites(): Promise<{ id: string }[]> {
    return this.deviceService.getRuSites();
  }

  @Query(() => AnalyticsStats)
  async getAnalytics(
    @Args('ruId', { type: () => String, nullable: true }) ruId?: string,
    @Args('hours', { type: () => Int, nullable: true }) hours?: number,
  ): Promise<AnalyticsStats> {
    return this.deviceService.getAnalytics(ruId, hours ?? 24);
  }

  @Query(() => [User])
  async users(): Promise<User[]> {
    return this.deviceService.users();
  }

  @Query(() => LoginResult)
  async login(
    @Args('email', { type: () => String }) email: string,
  ): Promise<LoginResult> {
    return this.deviceService.login(email);
  }

  @Query(() => [EventLog])
  async eventLogs(
    @Args('ruId', { type: () => String, nullable: true }) ruId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<EventLog[]> {
    return this.deviceService.getEventLogs({ ruId, limit });
  }
}
